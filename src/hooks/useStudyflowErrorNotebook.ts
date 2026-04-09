import { useCallback, useEffect, useState } from "react";
import { getSupabaseClient, isSupabaseConfigured } from "../lib/supabase";

export interface StudyflowErrorNotebookEntry {
  id: string;
  study_plan_id: string;
  subject_id: string | null;
  topic_id: string | null;
  source_session_id: string | null;
  source_question_review_task_id: string | null;
  title: string;
  prompt_snapshot: string | null;
  user_error_reason: string | null;
  correct_reason: string | null;
  avoidance_note: string | null;
  entry_status: "open" | "reviewing" | "mastered" | "archived";
  error_count: number;
  favorite: boolean;
  tags: string[] | null;
  last_error_at: string;
  last_reviewed_at: string | null;
  next_review_at: string | null;
}

interface CreateErrorNotebookEntryInput {
  subjectId: string | null;
  topicId?: string | null;
  sourceSessionId?: string | null;
  sourceQuestionReviewTaskId?: string | null;
  title: string;
  promptSnapshot?: string;
  userErrorReason?: string;
  correctReason?: string;
  avoidanceNote?: string;
  favorite?: boolean;
  tags?: string[];
  nextReviewAt?: string | null;
}

interface UpdateErrorNotebookEntryInput {
  entryId: string;
  entryStatus?: StudyflowErrorNotebookEntry["entry_status"];
  favorite?: boolean;
  userErrorReason?: string;
  correctReason?: string;
  avoidanceNote?: string;
  nextReviewAt?: string | null;
}

function getErrorMessage(caughtError: unknown, fallback: string) {
  if (caughtError instanceof Error) {
    return `${fallback}: ${caughtError.message}`;
  }

  if (
    typeof caughtError === "object" &&
    caughtError !== null &&
    "message" in caughtError &&
    typeof caughtError.message === "string"
  ) {
    return `${fallback}: ${caughtError.message}`;
  }

  return fallback;
}

export function useStudyflowErrorNotebook(planId: string | undefined) {
  const [entries, setEntries] = useState<StudyflowErrorNotebookEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!planId || !isSupabaseConfigured) {
      setEntries([]);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const client = getSupabaseClient();
      const { data, error: loadError } = await client
        .from("error_notebook_entries")
        .select(
          "id, study_plan_id, subject_id, topic_id, source_session_id, source_question_review_task_id, title, prompt_snapshot, user_error_reason, correct_reason, avoidance_note, entry_status, error_count, favorite, tags, last_error_at, last_reviewed_at, next_review_at",
        )
        .eq("study_plan_id", planId)
        .order("favorite", { ascending: false })
        .order("last_error_at", { ascending: false });

      if (loadError) throw loadError;
      setEntries((data ?? []) as StudyflowErrorNotebookEntry[]);
    } catch (caughtError) {
      setError(getErrorMessage(caughtError, "Falha ao carregar caderno de erros"));
    } finally {
      setLoading(false);
    }
  }, [planId]);

  useEffect(() => {
    load();
  }, [load]);

  const createEntry = useCallback(
    async (payload: CreateErrorNotebookEntryInput) => {
      if (!planId || !payload.title.trim() || !isSupabaseConfigured) {
        return;
      }

      setSaving(true);
      setError(null);

      try {
        const client = getSupabaseClient();
        const nowIso = new Date().toISOString();

        const { error: insertError } = await client.from("error_notebook_entries").insert({
          study_plan_id: planId,
          subject_id: payload.subjectId,
          topic_id: payload.topicId ?? null,
          source_session_id: payload.sourceSessionId ?? null,
          source_question_review_task_id: payload.sourceQuestionReviewTaskId ?? null,
          title: payload.title.trim(),
          prompt_snapshot: payload.promptSnapshot?.trim() || null,
          user_error_reason: payload.userErrorReason?.trim() || null,
          correct_reason: payload.correctReason?.trim() || null,
          avoidance_note: payload.avoidanceNote?.trim() || null,
          favorite: payload.favorite ?? false,
          tags: payload.tags ?? [],
          last_error_at: nowIso,
          next_review_at: payload.nextReviewAt ?? null,
        });

        if (insertError) throw insertError;
        await load();
    } catch (caughtError) {
      setError(getErrorMessage(caughtError, "Falha ao criar anotação de erro"));
      } finally {
        setSaving(false);
      }
    },
    [load, planId],
  );

  const updateEntry = useCallback(
    async (payload: UpdateErrorNotebookEntryInput) => {
      if (!isSupabaseConfigured) {
        return;
      }

      setSaving(true);
      setError(null);

      try {
        const client = getSupabaseClient();
        const patch: Record<string, unknown> = {};

        if (payload.entryStatus) patch.entry_status = payload.entryStatus;
        if (payload.favorite != null) patch.favorite = payload.favorite;
        if (payload.userErrorReason != null) {
          patch.user_error_reason = payload.userErrorReason.trim() || null;
        }
        if (payload.correctReason != null) {
          patch.correct_reason = payload.correctReason.trim() || null;
        }
        if (payload.avoidanceNote != null) {
          patch.avoidance_note = payload.avoidanceNote.trim() || null;
        }
        if ("nextReviewAt" in payload) patch.next_review_at = payload.nextReviewAt ?? null;

        if (payload.entryStatus === "reviewing" || payload.entryStatus === "mastered") {
          patch.last_reviewed_at = new Date().toISOString();
        }

        const { error: updateError } = await client
          .from("error_notebook_entries")
          .update(patch)
          .eq("id", payload.entryId);

        if (updateError) throw updateError;
        await load();
    } catch (caughtError) {
      setError(getErrorMessage(caughtError, "Falha ao atualizar caderno de erros"));
      } finally {
        setSaving(false);
      }
    },
    [load],
  );

  const removeEntry = useCallback(
    async (entryId: string) => {
      if (!isSupabaseConfigured) {
        return;
      }

      setSaving(true);
      setError(null);

      try {
        const client = getSupabaseClient();
        const { error: deleteError } = await client
          .from("error_notebook_entries")
          .delete()
          .eq("id", entryId);

        if (deleteError) throw deleteError;
        await load();
    } catch (caughtError) {
      setError(getErrorMessage(caughtError, "Falha ao excluir anotação de erro"));
      } finally {
        setSaving(false);
      }
    },
    [load],
  );

  return {
    entries,
    loading,
    saving,
    error,
    createEntry,
    updateEntry,
    removeEntry,
    reload: load,
  };
}
