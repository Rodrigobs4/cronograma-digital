import { useCallback, useEffect, useState } from "react";
import type {
  CustomDiscipline,
  Discipline,
  DisciplineProgress,
  PlannerSettings,
  TrackerEntry,
} from "../types";
import { getSupabaseClient, isSupabaseConfigured } from "../lib/supabase";

interface WorkspaceRecord {
  id: string;
  user_id: string;
  title: string;
  exam_date: string | null;
  plan_start_date: string;
  target_daily_hours: number;
  target_disciplines_per_day: number;
  preferred_session_minutes: number;
  experience_level: PlannerSettings["experienceLevel"];
  metadata: {
    active_discipline_ids?: string[];
    user_name?: string;
    [key: string]: unknown;
  } | null;
}

function isSchemaAvailabilityError(error: unknown) {
  if (!error || typeof error !== "object") {
    return false;
  }

  const candidate = error as { code?: string; message?: string };

  return (
    candidate.code === "42P01" ||
    candidate.code === "42703" ||
    candidate.code === "PGRST116" ||
    candidate.message?.toLowerCase().includes("does not exist") === true ||
    candidate.message?.toLowerCase().includes("could not find") === true ||
    candidate.message?.toLowerCase().includes("schema cache") === true
  );
}

export function useWorkspace(userId: string | undefined) {
  const [workspace, setWorkspace] = useState<WorkspaceRecord | null>(null);
  const [customDisciplines, setCustomDisciplines] = useState<CustomDiscipline[]>([]);
  const [disciplineProgress, setDisciplineProgress] = useState<
    Record<string, DisciplineProgress>
  >({});
  const [trackerEntries, setTrackerEntries] = useState<Record<number, TrackerEntry>>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadWorkspace = useCallback(async () => {
    if (!userId || !isSupabaseConfigured) {
      setWorkspace(null);
      setCustomDisciplines([]);
      setDisciplineProgress({});
      setTrackerEntries({});
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const client = getSupabaseClient();

      const { data: existingWorkspaceRow, error: workspaceError } = await client
        .from("exam_workspaces")
        .select(
          "id, user_id, title, exam_date, plan_start_date, target_daily_hours, target_disciplines_per_day, preferred_session_minutes, experience_level, metadata",
        )
        .eq("user_id", userId)
        .eq("status", "active")
        .limit(1)
        .maybeSingle();

      if (workspaceError) {
        throw workspaceError;
      }

      let workspaceRow = existingWorkspaceRow;

      if (!workspaceRow) {
        const { data: createdRow, error: createError } = await client
          .from("exam_workspaces")
          .insert({
            user_id: userId,
            exam_id: null,
            title: "Meu concurso",
            exam_date: null,
            plan_start_date: new Date().toISOString().slice(0, 10),
            metadata: {
              active_discipline_ids: [],
            },
          })
          .select(
            "id, user_id, title, exam_date, plan_start_date, target_daily_hours, target_disciplines_per_day, preferred_session_minutes, experience_level, metadata",
          )
          .single();

        if (createError) {
          throw createError;
        }

        workspaceRow = createdRow;
      }

      let disciplineRows:
        | Array<{
            id: string;
            code: string;
            name: string;
            short_name: string;
            emoji: string | null;
            estimated_questions: number;
            question_bank_count: number;
            subject_type: Discipline["type"];
            sessions_per_cycle: number;
            source: "catalog" | "custom" | "pdf" | "manual";
            current_cycle?: number | null;
            skip_completed_topics?: boolean | null;
            notes?: string | null;
            selected_topic?: string | null;
            mastery_level?: DisciplineProgress["masteryLevel"] | null;
          }>
        | null = null;

      {
        const { data, error: disciplineError } = await client
          .from("workspace_disciplines")
          .select(
            "id, code, name, short_name, emoji, estimated_questions, question_bank_count, subject_type, sessions_per_cycle, source, current_cycle, skip_completed_topics, notes, selected_topic, mastery_level",
          )
          .eq("workspace_id", workspaceRow.id)
          .order("display_order", { ascending: true });

        if (disciplineError && !isSchemaAvailabilityError(disciplineError)) {
          throw disciplineError;
        }

        if (disciplineError && isSchemaAvailabilityError(disciplineError)) {
          const { data: fallbackData, error: fallbackError } = await client
            .from("workspace_disciplines")
            .select(
              "id, code, name, short_name, emoji, estimated_questions, question_bank_count, subject_type, sessions_per_cycle, source",
            )
            .eq("workspace_id", workspaceRow.id)
            .order("display_order", { ascending: true });

          if (fallbackError) {
            throw fallbackError;
          }

          disciplineRows = fallbackData ?? [];
        } else {
          disciplineRows = data ?? [];
        }
      }

      const disciplineIds = (disciplineRows ?? []).map((item) => item.id);
      const topicsByDiscipline = new Map<string, string[]>();

      if (disciplineIds.length > 0) {
        const { data: topicRows, error: topicError } = await client
          .from("workspace_topics")
          .select("workspace_discipline_id, title, topic_order")
          .in("workspace_discipline_id", disciplineIds)
          .order("topic_order", { ascending: true });

        if (topicError && !isSchemaAvailabilityError(topicError)) {
          throw topicError;
        }

        if (!topicError) {
          for (const disciplineId of disciplineIds) {
            topicsByDiscipline.set(
              disciplineId,
              (topicRows ?? [])
                .filter((topic) => topic.workspace_discipline_id === disciplineId)
                .map((topic) => topic.title),
            );
          }
        }
      }

      let trackerRows:
        | Array<{
            day_number: number;
            cycle_completed: boolean;
            disciplines_studied: string | null;
            hours_invested: number | null;
            observations: string | null;
          }>
        | null = null;

      {
        const { data, error: trackerError } = await client
          .from("workspace_tracker_entries")
          .select(
            "day_number, cycle_completed, disciplines_studied, hours_invested, observations",
          )
          .eq("workspace_id", workspaceRow.id);

        if (trackerError && !isSchemaAvailabilityError(trackerError)) {
          throw trackerError;
        }

        trackerRows = trackerError ? [] : (data ?? []);
      }

      setWorkspace(workspaceRow);
      setDisciplineProgress(
        Object.fromEntries(
          (disciplineRows ?? []).map((item) => [
            item.code,
            {
              disciplineId: item.code,
              currentCycle: item.current_cycle ?? 1,
              skipCompletedTopics: item.skip_completed_topics ?? false,
              notes: item.notes ?? "",
              selectedTopic: item.selected_topic ?? "",
              customTopics: topicsByDiscipline.get(item.id) ?? [],
              masteryLevel: item.mastery_level ?? "nao_estudada",
            },
          ]),
        ),
      );
      setCustomDisciplines(
        (disciplineRows ?? [])
          .filter((item) => item.source === "custom")
          .map((item) => ({
            id: item.code,
            name: item.name,
            shortName: item.short_name,
            emoji: item.emoji ?? "📘",
            estimatedQuestions: item.estimated_questions,
            bankCount: item.question_bank_count,
            type: item.subject_type,
            sessionsPerCycle: item.sessions_per_cycle,
            source: "custom",
            topics: topicsByDiscipline.get(item.id) ?? [],
          })),
      );
      setTrackerEntries(
        Object.fromEntries(
          (trackerRows ?? []).map((item) => [
            item.day_number,
            {
              dayNumber: item.day_number,
              cycleCompleted: item.cycle_completed,
              disciplinesStudied: item.disciplines_studied ?? "",
              hoursInvested:
                item.hours_invested == null ? "" : String(item.hours_invested),
              observations: item.observations ?? "",
            },
          ]),
        ),
      );
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? `Falha ao carregar seus dados online: ${caughtError.message}`
          : "Falha ao carregar seus dados online.",
      );
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    loadWorkspace();
  }, [loadWorkspace]);

  const saveWorkspace = useCallback(
    async (
      plannerSettings: PlannerSettings,
      activeDisciplineIds: string[],
      customItems: CustomDiscipline[],
      allDisciplines: Discipline[],
      progressMap: Record<string, DisciplineProgress>,
      trackerMap: Record<number, TrackerEntry>,
    ) => {
      if (!workspace || !isSupabaseConfigured) {
        return;
      }

      setSaving(true);
      setError(null);

      try {
        const client = getSupabaseClient();

        const { error: workspaceError } = await client
          .from("exam_workspaces")
          .update({
            title: plannerSettings.examTitle,
            exam_date: plannerSettings.examDate,
            plan_start_date: plannerSettings.planStartDate,
            target_daily_hours: plannerSettings.dailyStudyHours,
            target_disciplines_per_day: plannerSettings.disciplinesPerDay,
            preferred_session_minutes: Math.max(
              Math.round(
                (plannerSettings.dailyStudyHours * 60) /
                  plannerSettings.disciplinesPerDay,
              ),
              25,
            ),
            experience_level: plannerSettings.experienceLevel,
            metadata: {
              ...(workspace.metadata ?? {}),
              active_discipline_ids: activeDisciplineIds,
              user_name: plannerSettings.userName,
            },
          })
          .eq("id", workspace.id);

        if (workspaceError) {
          throw workspaceError;
        }

        const disciplinesPayload = allDisciplines.map((discipline, index) => {
          const progress = progressMap[discipline.id];

          return {
            workspace_id: workspace.id,
            code: discipline.id,
            name: discipline.name,
            short_name: discipline.shortName,
            emoji: discipline.emoji,
            estimated_questions: discipline.estimatedQuestions,
            question_bank_count: discipline.bankCount,
            subject_type: discipline.type,
            sessions_per_cycle: discipline.sessionsPerCycle,
            display_order: index + 1,
            source: discipline.source ?? "catalog",
            is_active: activeDisciplineIds.includes(discipline.id),
            current_cycle: progress?.currentCycle ?? 1,
            skip_completed_topics: progress?.skipCompletedTopics ?? false,
            notes: progress?.notes ?? "",
            selected_topic: progress?.selectedTopic ?? "",
            mastery_level: progress?.masteryLevel ?? "nao_estudada",
          };
        });

        const { data: upsertedDisciplines, error: disciplinesError } = await client
          .from("workspace_disciplines")
          .upsert(disciplinesPayload, {
            onConflict: "workspace_id,code",
          })
          .select("id, code, source");

        if (disciplinesError) {
          throw disciplinesError;
        }

        const customDisciplineIds =
          upsertedDisciplines
            ?.filter((item) => item.source === "custom")
            .map((item) => item.id) ?? [];

        if (customDisciplineIds.length > 0) {
          await client
            .from("workspace_topics")
            .delete()
            .in("workspace_discipline_id", customDisciplineIds)
            .eq("source", "custom");
        }

        const topicsPayload =
          upsertedDisciplines?.flatMap((discipline) => {
            const matched = customItems.find((item) => item.id === discipline.code);

            return (matched?.topics ?? []).map((topic, index) => ({
              workspace_discipline_id: discipline.id,
              title: topic,
              topic_order: index + 1,
              source: "custom",
            }));
          }) ?? [];

        if (topicsPayload.length > 0) {
          const { error: topicsError } = await client
            .from("workspace_topics")
            .insert(topicsPayload);

          if (topicsError) {
            throw topicsError;
          }
        }

        const trackerPayload = Object.values(trackerMap).map((entry) => ({
          workspace_id: workspace.id,
          user_id: workspace.user_id,
          day_number: entry.dayNumber,
          cycle_completed: entry.cycleCompleted,
          disciplines_studied: entry.disciplinesStudied || null,
          hours_invested:
            entry.hoursInvested.trim() === "" ? null : Number(entry.hoursInvested),
          observations: entry.observations || null,
        }));

        if (trackerPayload.length > 0) {
          const { error: trackerError } = await client
            .from("workspace_tracker_entries")
            .upsert(trackerPayload, {
              onConflict: "workspace_id,day_number",
            });

          if (trackerError) {
            throw trackerError;
          }
        }

        await loadWorkspace();
      } catch (caughtError) {
        setError(
          caughtError instanceof Error
            ? caughtError.message
            : "Falha ao salvar workspace.",
        );
      } finally {
        setSaving(false);
      }
    },
    [loadWorkspace, workspace],
  );

  return {
    workspace,
    customDisciplines,
    disciplineProgress,
    trackerEntries,
    loading,
    saving,
    error,
    saveWorkspace,
    reload: loadWorkspace,
  };
}
