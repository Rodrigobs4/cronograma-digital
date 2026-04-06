import { useEffect, useState } from "react";
import { cycleDays as localCycleDays } from "../data/cycleDays";
import { disciplines as localDisciplines } from "../data/disciplines";
import { getSupabaseClient, isSupabaseConfigured } from "../lib/supabase";
import type { CatalogStatus, CycleDay, Discipline } from "../types";

interface UseExamCatalogResult extends CatalogStatus {
  cycleDays: CycleDay[];
  disciplines: Discipline[];
}

const PMAL_EXAM_SLUG = "pmal-2026";
const PMAL_CYCLE_TEMPLATE_CODE = "ciclo-base";

function buildFallback(error: string | null = null): UseExamCatalogResult {
  return {
    cycleDays: localCycleDays,
    disciplines: localDisciplines,
    loading: false,
    source: "local",
    error,
  };
}

export function useExamCatalog(): UseExamCatalogResult {
  const [state, setState] = useState<UseExamCatalogResult>(() =>
    isSupabaseConfigured
      ? {
          cycleDays: localCycleDays,
          disciplines: localDisciplines,
          loading: true,
          source: "local",
          error: null,
        }
      : buildFallback("Catálogo online não configurado nas variáveis do ambiente."),
  );

  useEffect(() => {
    if (!isSupabaseConfigured) {
      return;
    }

    let active = true;

    async function loadCatalog() {
      try {
        const client = getSupabaseClient();

        const { data: exam, error: examError } = await client
          .from("exams")
          .select("id")
          .eq("slug", PMAL_EXAM_SLUG)
          .single();

        if (examError) {
          throw examError;
        }

        const { data: disciplineRows, error: disciplinesError } = await client
          .from("disciplines")
          .select(
            "id, code, name, short_name, emoji, estimated_questions, question_bank_count, subject_type, sessions_per_cycle, display_order",
          )
          .eq("exam_id", exam.id)
          .order("display_order", { ascending: true });

        if (disciplinesError) {
          throw disciplinesError;
        }

        const { data: cycleTemplate, error: templateError } = await client
          .from("cycle_templates")
          .select("id")
          .eq("exam_id", exam.id)
          .eq("code", PMAL_CYCLE_TEMPLATE_CODE)
          .single();

        if (templateError) {
          throw templateError;
        }

        const { data: dayRows, error: dayError } = await client
          .from("cycle_template_days")
          .select("id, day_code, day_index")
          .eq("cycle_template_id", cycleTemplate.id)
          .order("day_index", { ascending: true });

        if (dayError) {
          throw dayError;
        }

        const dayIds = dayRows.map((day) => day.id);
        let sessionRows: {
          cycle_template_day_id: string;
          discipline_id: string;
          session_order: number;
        }[] = [];

        if (dayIds.length > 0) {
          const { data, error: sessionError } = await client
            .from("cycle_template_sessions")
            .select("cycle_template_day_id, discipline_id, session_order")
            .in("cycle_template_day_id", dayIds)
            .order("session_order", { ascending: true });

          if (sessionError) {
            throw sessionError;
          }

          sessionRows = data ?? [];
        }

        const disciplines: Discipline[] = disciplineRows.map((item) => ({
          id: item.code,
          name: item.name,
          shortName: item.short_name,
          emoji: item.emoji ?? "",
          estimatedQuestions: item.estimated_questions,
          bankCount: item.question_bank_count,
          type: item.subject_type,
          sessionsPerCycle: item.sessions_per_cycle,
        }));

        const disciplineCodeById = new Map(
          disciplineRows.map((item) => [item.id, item.code]),
        );

        const cycleDays: CycleDay[] = dayRows.map((day) => ({
          id: day.day_code as CycleDay["id"],
          sessions: sessionRows
            .filter((session) => session.cycle_template_day_id === day.id)
            .map((session) => disciplineCodeById.get(session.discipline_id))
            .filter((value): value is string => Boolean(value)),
        }));

        if (!active) {
          return;
        }

        setState({
          cycleDays: cycleDays.length > 0 ? cycleDays : localCycleDays,
          disciplines: disciplines.length > 0 ? disciplines : localDisciplines,
          loading: false,
          source: "supabase",
          error: null,
        });
      } catch (error) {
        if (!active) {
          return;
        }

        const message =
          error instanceof Error
            ? error.message
            : "Falha ao carregar catálogo online.";

        setState(buildFallback(message));
      }
    }

    loadCatalog();

    return () => {
      active = false;
    };
  }, []);

  return state;
}
