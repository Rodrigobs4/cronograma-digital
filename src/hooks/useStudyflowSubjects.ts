import { useCallback, useEffect, useState } from "react";
import { getSupabaseClient, isSupabaseConfigured } from "../lib/supabase";

export interface StudyflowSubject {
  id: string;
  study_plan_id: string;
  code: string;
  name: string;
  color_hex: string | null;
  priority_weight: number;
  difficulty_perception: "low" | "medium" | "high";
  target_minutes: number;
  is_active: boolean;
}

export interface StudyflowTopic {
  id: string;
  subject_id: string;
  title: string;
  status: "not_started" | "in_progress" | "reviewing" | "completed";
  order_index: number;
}

interface NewSubjectInput {
  name: string;
  difficulty: "low" | "medium" | "high";
  priorityWeight: number;
  targetMinutes: number;
}

interface NewTopicInput {
  subjectId: string;
  title: string;
}

interface UpdateSubjectInput {
  subjectId: string;
  name?: string;
  difficulty?: "low" | "medium" | "high";
  priorityWeight?: number;
  targetMinutes?: number;
  isActive?: boolean;
}

interface UpdateTopicInput {
  topicId: string;
  status: StudyflowTopic["status"];
}

function slugify(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function useStudyflowSubjects(planId: string | undefined) {
  const [subjects, setSubjects] = useState<StudyflowSubject[]>([]);
  const [topics, setTopics] = useState<StudyflowTopic[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!planId || !isSupabaseConfigured) {
      setSubjects([]);
      setTopics([]);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const client = getSupabaseClient();

      const [{ data: subjectRows, error: subjectError }, { data: topicRows, error: topicError }] =
        await Promise.all([
          client
            .from("subjects")
            .select(
              "id, study_plan_id, code, name, color_hex, priority_weight, difficulty_perception, target_minutes, is_active",
            )
            .eq("study_plan_id", planId)
            .order("created_at", { ascending: true }),
          client
            .from("topics")
            .select("id, subject_id, title, status, order_index")
            .in(
              "subject_id",
              (
                await client
                  .from("subjects")
                  .select("id")
                  .eq("study_plan_id", planId)
              ).data?.map((item) => item.id) ?? [""],
            )
            .order("order_index", { ascending: true }),
        ]);

      if (subjectError) throw subjectError;
      if (topicError) throw topicError;

      setSubjects((subjectRows ?? []) as StudyflowSubject[]);
      setTopics((topicRows ?? []) as StudyflowTopic[]);
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? `Falha ao carregar disciplinas: ${caughtError.message}`
          : "Falha ao carregar disciplinas.",
      );
    } finally {
      setLoading(false);
    }
  }, [planId]);

  useEffect(() => {
    load();
  }, [load]);

  const addSubject = useCallback(
    async (payload: NewSubjectInput) => {
      if (!planId || !isSupabaseConfigured) return;

      setSaving(true);
      setError(null);

      try {
        const client = getSupabaseClient();
        const baseCode = slugify(payload.name) || "disciplina";
        const existingCodes = new Set(subjects.map((subject) => subject.code));
        let finalCode = baseCode;
        let counter = 2;

        while (existingCodes.has(finalCode)) {
          finalCode = `${baseCode}-${counter}`;
          counter += 1;
        }

        const { error: insertError } = await client.from("subjects").insert({
          study_plan_id: planId,
          code: finalCode,
          name: payload.name.trim(),
          difficulty_perception: payload.difficulty,
          priority_weight: payload.priorityWeight,
          target_minutes: payload.targetMinutes,
          is_active: true,
        });

        if (insertError) throw insertError;

        await load();
      } catch (caughtError) {
        setError(
          caughtError instanceof Error
            ? `Falha ao criar disciplina: ${caughtError.message}`
            : "Falha ao criar disciplina.",
        );
      } finally {
        setSaving(false);
      }
    },
    [load, planId, subjects],
  );

  const removeSubject = useCallback(
    async (subjectId: string) => {
      if (!isSupabaseConfigured) return;

      setSaving(true);
      setError(null);

      try {
        const client = getSupabaseClient();
        const { error: deleteError } = await client.from("subjects").delete().eq("id", subjectId);

        if (deleteError) throw deleteError;

        await load();
      } catch (caughtError) {
        setError(
          caughtError instanceof Error
            ? `Falha ao excluir disciplina: ${caughtError.message}`
            : "Falha ao excluir disciplina.",
        );
      } finally {
        setSaving(false);
      }
    },
    [load],
  );

  const updateSubject = useCallback(
    async (payload: UpdateSubjectInput) => {
      if (!isSupabaseConfigured) return;

      setSaving(true);
      setError(null);

      try {
        const client = getSupabaseClient();
        const patch: Record<string, unknown> = {};

        if (payload.name != null) patch.name = payload.name.trim();
        if (payload.difficulty) patch.difficulty_perception = payload.difficulty;
        if (payload.priorityWeight != null) patch.priority_weight = payload.priorityWeight;
        if (payload.targetMinutes != null) patch.target_minutes = payload.targetMinutes;
        if (payload.isActive != null) patch.is_active = payload.isActive;

        const { error: updateError } = await client
          .from("subjects")
          .update(patch)
          .eq("id", payload.subjectId);

        if (updateError) throw updateError;

        await load();
      } catch (caughtError) {
        setError(
          caughtError instanceof Error
            ? `Falha ao atualizar disciplina: ${caughtError.message}`
            : "Falha ao atualizar disciplina.",
        );
      } finally {
        setSaving(false);
      }
    },
    [load],
  );

  const addTopic = useCallback(
    async (payload: NewTopicInput) => {
      if (!isSupabaseConfigured) return;

      setSaving(true);
      setError(null);

      try {
        const client = getSupabaseClient();
        const nextOrder =
          topics
            .filter((topic) => topic.subject_id === payload.subjectId)
            .reduce((max, topic) => Math.max(max, topic.order_index), 0) + 1;

        const { error: insertError } = await client.from("topics").insert({
          subject_id: payload.subjectId,
          title: payload.title.trim(),
          order_index: nextOrder,
          status: "not_started",
        });

        if (insertError) throw insertError;

        await load();
      } catch (caughtError) {
        setError(
          caughtError instanceof Error
            ? `Falha ao criar tópico: ${caughtError.message}`
            : "Falha ao criar tópico.",
        );
      } finally {
        setSaving(false);
      }
    },
    [load, topics],
  );

  const removeTopic = useCallback(
    async (topicId: string) => {
      if (!isSupabaseConfigured) return;

      setSaving(true);
      setError(null);

      try {
        const client = getSupabaseClient();
        const { error: deleteError } = await client.from("topics").delete().eq("id", topicId);

        if (deleteError) throw deleteError;

        await load();
      } catch (caughtError) {
        setError(
          caughtError instanceof Error
            ? `Falha ao excluir tópico: ${caughtError.message}`
            : "Falha ao excluir tópico.",
        );
      } finally {
        setSaving(false);
      }
    },
    [load],
  );

  const updateTopic = useCallback(
    async (payload: UpdateTopicInput) => {
      if (!isSupabaseConfigured) return;

      setSaving(true);
      setError(null);

      try {
        const client = getSupabaseClient();
        const { error: updateError } = await client
          .from("topics")
          .update({ status: payload.status })
          .eq("id", payload.topicId);

        if (updateError) throw updateError;

        await load();
      } catch (caughtError) {
        setError(
          caughtError instanceof Error
            ? `Falha ao atualizar tópico: ${caughtError.message}`
            : "Falha ao atualizar tópico.",
        );
      } finally {
        setSaving(false);
      }
    },
    [load],
  );

  return {
    subjects,
    topics,
    loading,
    saving,
    error,
    addSubject,
    updateSubject,
    removeSubject,
    addTopic,
    updateTopic,
    removeTopic,
    reload: load,
  };
}
