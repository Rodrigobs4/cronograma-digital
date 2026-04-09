import { useCallback, useEffect, useState } from "react";
import { getSupabaseClient, isSupabaseConfigured } from "../lib/supabase";

export interface StudyflowQuestionReviewTask {
  id: string;
  study_plan_id: string;
  subject_id: string | null;
  topic_id: string | null;
  source_session_id: string | null;
  status: "pending" | "completed" | "skipped" | "archived";
  minimum_questions: number;
  questions_answered: number;
  questions_correct: number;
  questions_wrong: number;
  due_at: string | null;
  completed_at: string | null;
  last_practiced_at: string | null;
}

interface SyncQuestionReviewInput {
  subjectId: string | null;
  topicId: string | null;
  sourceSessionId?: string | null;
  minimumQuestions?: number;
}

interface CompleteQuestionReviewInput {
  taskId: string;
  questionsAnswered: number;
  questionsCorrect: number;
}

export function useStudyflowQuestionReviews(planId: string | undefined) {
  const [tasks, setTasks] = useState<StudyflowQuestionReviewTask[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!planId || !isSupabaseConfigured) {
      setTasks([]);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const client = getSupabaseClient();
      const { data, error: loadError } = await client
        .from("question_review_tasks")
        .select(
          "id, study_plan_id, subject_id, topic_id, source_session_id, status, minimum_questions, questions_answered, questions_correct, questions_wrong, due_at, completed_at, last_practiced_at",
        )
        .eq("study_plan_id", planId)
        .order("last_practiced_at", { ascending: true, nullsFirst: true })
        .order("created_at", { ascending: true });

      if (loadError) throw loadError;
      setTasks((data ?? []) as StudyflowQuestionReviewTask[]);
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? `Falha ao carregar revisões por questões: ${caughtError.message}`
          : "Falha ao carregar revisões por questões.",
      );
    } finally {
      setLoading(false);
    }
  }, [planId]);

  useEffect(() => {
    load();
  }, [load]);

  const syncQuestionReviewForSession = useCallback(
    async (payload: SyncQuestionReviewInput) => {
      if (!planId || !payload.subjectId || !isSupabaseConfigured) {
        return;
      }

      setSaving(true);
      setError(null);

      try {
        const client = getSupabaseClient();

        const { data: existingTask, error: existingError } = await client
          .from("question_review_tasks")
          .select("id, minimum_questions")
          .eq("study_plan_id", planId)
          .eq("subject_id", payload.subjectId)
          .eq("topic_id", payload.topicId ?? null)
          .eq("status", "pending")
          .limit(1)
          .maybeSingle();

        if (existingError) throw existingError;

        const minimumQuestions = Math.max(5, payload.minimumQuestions ?? 5);

        if (existingTask) {
          const { error: updateError } = await client
            .from("question_review_tasks")
            .update({
              minimum_questions: Math.max(existingTask.minimum_questions ?? 5, minimumQuestions),
              source_session_id: payload.sourceSessionId ?? null,
            })
            .eq("id", existingTask.id);

          if (updateError) throw updateError;
        } else {
          const { error: insertError } = await client.from("question_review_tasks").insert({
            study_plan_id: planId,
            subject_id: payload.subjectId,
            topic_id: payload.topicId ?? null,
            source_session_id: payload.sourceSessionId ?? null,
            status: "pending",
            minimum_questions: minimumQuestions,
            due_at: null,
          });

          if (insertError) throw insertError;
        }

        await load();
      } catch (caughtError) {
        setError(
          caughtError instanceof Error
            ? `Falha ao sincronizar revisão por questões: ${caughtError.message}`
            : "Falha ao sincronizar revisão por questões.",
        );
      } finally {
        setSaving(false);
      }
    },
    [load, planId],
  );

  const completeQuestionReview = useCallback(
    async (payload: CompleteQuestionReviewInput) => {
      if (!isSupabaseConfigured) {
        return;
      }

      setSaving(true);
      setError(null);

      try {
        const client = getSupabaseClient();
        const nowIso = new Date().toISOString();
        const safeAnswered = Math.max(0, payload.questionsAnswered);
        const safeCorrect = Math.max(0, Math.min(payload.questionsCorrect, safeAnswered));

        const { error: updateError } = await client
          .from("question_review_tasks")
          .update({
            status: "completed",
            questions_answered: safeAnswered,
            questions_correct: safeCorrect,
            questions_wrong: Math.max(0, safeAnswered - safeCorrect),
            completed_at: nowIso,
            last_practiced_at: nowIso,
          })
          .eq("id", payload.taskId);

        if (updateError) throw updateError;

        await load();
      } catch (caughtError) {
        setError(
          caughtError instanceof Error
            ? `Falha ao concluir revisão por questões: ${caughtError.message}`
            : "Falha ao concluir revisão por questões.",
        );
      } finally {
        setSaving(false);
      }
    },
    [load],
  );

  const removeQuestionReviewTask = useCallback(
    async (taskId: string) => {
      if (!isSupabaseConfigured) {
        return;
      }

      setSaving(true);
      setError(null);

      try {
        const client = getSupabaseClient();
        const { error: deleteError } = await client
          .from("question_review_tasks")
          .delete()
          .eq("id", taskId);

        if (deleteError) throw deleteError;
        await load();
      } catch (caughtError) {
        setError(
          caughtError instanceof Error
            ? `Falha ao excluir revisão por questões: ${caughtError.message}`
            : "Falha ao excluir revisão por questões.",
        );
      } finally {
        setSaving(false);
      }
    },
    [load],
  );

  return {
    tasks,
    loading,
    saving,
    error,
    syncQuestionReviewForSession,
    completeQuestionReview,
    removeQuestionReviewTask,
    reload: load,
  };
}
