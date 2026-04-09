import { useCallback, useEffect, useState } from "react";
import { getSupabaseClient, isSupabaseConfigured } from "../lib/supabase";

export interface StudyflowSession {
  id: string;
  study_plan_id: string;
  daily_plan_item_id: string | null;
  subject_id: string | null;
  topic_id: string | null;
  session_date: string;
  session_status: "planned" | "running" | "completed" | "cancelled" | "skipped";
  net_minutes: number;
  pages_read: number;
  lessons_watched: number;
  questions_answered: number;
  questions_correct: number;
  questions_wrong: number;
  notes: string | null;
}

interface CompleteSessionInput {
  dailyPlanItemId: string;
  subjectId: string | null;
  topicId?: string | null;
  plannedMinutes: number;
  sessionDate: string;
  netMinutes?: number;
  pagesRead?: number;
  lessonsWatched?: number;
  questionsAnswered?: number;
  questionsCorrect?: number;
  questionsWrong?: number;
  notes?: string;
}

interface CompleteSessionResult {
  id: string;
  completedAt: string;
}

export function useStudyflowSessions(
  planId: string | undefined,
  sessionDate: string,
) {
  const [sessions, setSessions] = useState<StudyflowSession[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!planId || !isSupabaseConfigured) {
      setSessions([]);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const client = getSupabaseClient();
      const { data, error: loadError } = await client
        .from("study_sessions")
        .select(
          "id, study_plan_id, daily_plan_item_id, subject_id, topic_id, session_date, session_status, net_minutes, pages_read, lessons_watched, questions_answered, questions_correct, questions_wrong, notes",
        )
        .eq("study_plan_id", planId)
        .eq("session_date", sessionDate)
        .order("created_at", { ascending: true });

      if (loadError) throw loadError;

      setSessions((data ?? []) as StudyflowSession[]);
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? `Falha ao carregar sessões: ${caughtError.message}`
          : "Falha ao carregar sessões.",
      );
    } finally {
      setLoading(false);
    }
  }, [planId, sessionDate]);

  useEffect(() => {
    load();
  }, [load]);

  const completePlannedSession = useCallback(
    async (payload: CompleteSessionInput): Promise<CompleteSessionResult | null> => {
      if (!planId || !isSupabaseConfigured) {
        return null;
      }

      setSaving(true);
      setError(null);

      try {
        const client = getSupabaseClient();
        const nowIso = new Date().toISOString();

        const { data: existingSession, error: existingError } = await client
          .from("study_sessions")
          .select(
            "id, study_plan_id, daily_plan_item_id, subject_id, topic_id, session_date, session_status, net_minutes, pages_read, lessons_watched, questions_answered, questions_correct, questions_wrong, notes",
          )
          .eq("daily_plan_item_id", payload.dailyPlanItemId)
          .maybeSingle();

        if (existingError) throw existingError;

        const sessionPayload = {
          study_plan_id: planId,
          daily_plan_item_id: payload.dailyPlanItemId,
          subject_id: payload.subjectId,
          topic_id: payload.topicId ?? null,
          session_source: "planned",
          session_status: "completed",
          session_date: payload.sessionDate,
          started_at: nowIso,
          ended_at: nowIso,
          net_minutes: payload.netMinutes ?? payload.plannedMinutes,
          pages_read: payload.pagesRead ?? 0,
          lessons_watched: payload.lessonsWatched ?? 0,
          questions_answered: payload.questionsAnswered ?? 0,
          questions_correct: payload.questionsCorrect ?? 0,
          questions_wrong: payload.questionsWrong ?? 0,
          notes: payload.notes?.trim() || null,
        };

        if (existingSession) {
          const { data: updatedSession, error: updateSessionError } = await client
            .from("study_sessions")
            .update(sessionPayload)
            .eq("id", existingSession.id)
            .select("id")
            .single();

          if (updateSessionError) throw updateSessionError;

          const { error: itemError } = await client
            .from("daily_plan_items")
            .update({ status: "completed" })
            .eq("id", payload.dailyPlanItemId);

          if (itemError) throw itemError;

          await load();
          return {
            id: updatedSession.id,
            completedAt: nowIso,
          };
        } else {
          const { data: insertedSession, error: insertSessionError } = await client
            .from("study_sessions")
            .insert(sessionPayload)
            .select("id")
            .single();

          if (insertSessionError) throw insertSessionError;

          const { error: itemError } = await client
            .from("daily_plan_items")
            .update({ status: "completed" })
            .eq("id", payload.dailyPlanItemId);

          if (itemError) throw itemError;

          await load();
          return {
            id: insertedSession.id,
            completedAt: nowIso,
          };
        }
      } catch (caughtError) {
        setError(
          caughtError instanceof Error
            ? `Falha ao registrar sessão: ${caughtError.message}`
            : "Falha ao registrar sessão.",
        );
        return null;
      } finally {
        setSaving(false);
      }
    },
    [load, planId],
  );

  const reopenPlannedSession = useCallback(
    async (dailyPlanItemId: string) => {
      if (!isSupabaseConfigured) {
        return;
      }

      setSaving(true);
      setError(null);

      try {
        const client = getSupabaseClient();

        const { error: itemError } = await client
          .from("daily_plan_items")
          .update({ status: "planned" })
          .eq("id", dailyPlanItemId);

        if (itemError) throw itemError;

        const { data: linkedSessions, error: linkedSessionsError } = await client
          .from("study_sessions")
          .select("id")
          .eq("daily_plan_item_id", dailyPlanItemId);

        if (linkedSessionsError) throw linkedSessionsError;

        const linkedSessionIds = (linkedSessions ?? []).map((sessionItem) => sessionItem.id);

        if (linkedSessionIds.length > 0) {
          const { error: questionReviewError } = await client
            .from("question_review_tasks")
            .delete()
            .in("source_session_id", linkedSessionIds);

          if (questionReviewError) throw questionReviewError;

          const { error: errorNotebookError } = await client
            .from("error_notebook_entries")
            .delete()
            .in("source_session_id", linkedSessionIds);

          if (errorNotebookError) throw errorNotebookError;

          const { error: reviewError } = await client
            .from("review_items")
            .delete()
            .in("source_session_id", linkedSessionIds);

          if (reviewError) throw reviewError;
        }

        const { error: sessionError } = await client
          .from("study_sessions")
          .delete()
          .eq("daily_plan_item_id", dailyPlanItemId);

        if (sessionError) throw sessionError;

        await load();
      } catch (caughtError) {
        setError(
          caughtError instanceof Error
            ? `Falha ao reabrir sessão: ${caughtError.message}`
            : "Falha ao reabrir sessão.",
        );
      } finally {
        setSaving(false);
      }
    },
    [load],
  );

  return {
    sessions,
    loading,
    saving,
    error,
    completePlannedSession,
    reopenPlannedSession,
    reload: load,
  };
}
