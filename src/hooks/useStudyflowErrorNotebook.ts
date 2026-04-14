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
  entry_type: "error" | "rule" | "insight" | "trap" | "commentary";
  source_kind: "question" | "class" | "teacher_comment" | "book" | "manual" | "mock_exam";
  source_label: string | null;
  prompt_snapshot: string | null;
  user_error_reason: string | null;
  correct_reason: string | null;
  avoidance_note: string | null;
  teacher_comment: string | null;
  review_note: string | null;
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
  entryType?: StudyflowErrorNotebookEntry["entry_type"];
  sourceKind?: StudyflowErrorNotebookEntry["source_kind"];
  sourceLabel?: string;
  promptSnapshot?: string;
  userErrorReason?: string;
  correctReason?: string;
  avoidanceNote?: string;
  teacherComment?: string;
  reviewNote?: string;
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
  teacherComment?: string;
  reviewNote?: string;
  sourceLabel?: string;
  nextReviewAt?: string | null;
}

const legacyErrorNotebookSelect =
  "id, study_plan_id, subject_id, topic_id, source_session_id, source_question_review_task_id, title, prompt_snapshot, user_error_reason, correct_reason, avoidance_note, entry_status, error_count, favorite, tags, last_error_at, last_reviewed_at, next_review_at";

const enhancedErrorNotebookSelect =
  "id, study_plan_id, subject_id, topic_id, source_session_id, source_question_review_task_id, title, entry_type, source_kind, source_label, prompt_snapshot, user_error_reason, correct_reason, avoidance_note, teacher_comment, review_note, entry_status, error_count, favorite, tags, last_error_at, last_reviewed_at, next_review_at";

function isMissingColumnError(caughtError: unknown) {
  if (
    typeof caughtError === "object" &&
    caughtError !== null &&
    "message" in caughtError &&
    typeof caughtError.message === "string"
  ) {
    return (
      caughtError.message.includes("column error_notebook_entries.") &&
      caughtError.message.includes("does not exist")
    );
  }

  return false;
}

function withLegacyDefaults(
  rows: Array<Record<string, unknown>> | null | undefined,
): StudyflowErrorNotebookEntry[] {
  return (rows ?? []).map((row) => ({
    id: String(row.id),
    study_plan_id: String(row.study_plan_id),
    subject_id: typeof row.subject_id === "string" ? row.subject_id : null,
    topic_id: typeof row.topic_id === "string" ? row.topic_id : null,
    source_session_id: typeof row.source_session_id === "string" ? row.source_session_id : null,
    source_question_review_task_id:
      typeof row.source_question_review_task_id === "string"
        ? row.source_question_review_task_id
        : null,
    title: typeof row.title === "string" ? row.title : "",
    entry_type:
      row.entry_type === "rule" ||
      row.entry_type === "insight" ||
      row.entry_type === "trap" ||
      row.entry_type === "commentary"
        ? row.entry_type
        : "error",
    source_kind:
      row.source_kind === "question" ||
      row.source_kind === "class" ||
      row.source_kind === "teacher_comment" ||
      row.source_kind === "book" ||
      row.source_kind === "mock_exam"
        ? row.source_kind
        : "manual",
    source_label: typeof row.source_label === "string" ? row.source_label : null,
    prompt_snapshot: typeof row.prompt_snapshot === "string" ? row.prompt_snapshot : null,
    user_error_reason:
      typeof row.user_error_reason === "string" ? row.user_error_reason : null,
    correct_reason: typeof row.correct_reason === "string" ? row.correct_reason : null,
    avoidance_note: typeof row.avoidance_note === "string" ? row.avoidance_note : null,
    teacher_comment:
      typeof row.teacher_comment === "string" ? row.teacher_comment : null,
    review_note: typeof row.review_note === "string" ? row.review_note : null,
    entry_status:
      row.entry_status === "reviewing" ||
      row.entry_status === "mastered" ||
      row.entry_status === "archived"
        ? row.entry_status
        : "open",
    error_count: typeof row.error_count === "number" ? row.error_count : 1,
    favorite: row.favorite === true,
    tags: Array.isArray(row.tags) ? (row.tags as string[]) : null,
    last_error_at:
      typeof row.last_error_at === "string" ? row.last_error_at : new Date().toISOString(),
    last_reviewed_at:
      typeof row.last_reviewed_at === "string" ? row.last_reviewed_at : null,
    next_review_at: typeof row.next_review_at === "string" ? row.next_review_at : null,
  }));
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
  const [supportsEnhancedSchema, setSupportsEnhancedSchema] = useState(true);

  const load = useCallback(async () => {
    if (!planId || !isSupabaseConfigured) {
      setEntries([]);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const client = getSupabaseClient();
      const loadQuery = (selectClause: string) =>
        client
          .from("error_notebook_entries")
          .select(selectClause)
          .eq("study_plan_id", planId)
          .order("favorite", { ascending: false })
          .order("last_error_at", { ascending: false });

      const { data, error: loadError } = await loadQuery(enhancedErrorNotebookSelect);

      if (loadError) {
        if (!isMissingColumnError(loadError)) {
          throw loadError;
        }

        const { data: legacyData, error: legacyLoadError } = await loadQuery(
          legacyErrorNotebookSelect,
        );

        if (legacyLoadError) throw legacyLoadError;
        setSupportsEnhancedSchema(false);
        setEntries(
          withLegacyDefaults(legacyData as unknown as Array<Record<string, unknown>>),
        );
        return;
      }

      setSupportsEnhancedSchema(true);
      setEntries(withLegacyDefaults(data as unknown as Array<Record<string, unknown>>));
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
        const basePayload = {
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
        };
        const enhancedPayload = {
          ...basePayload,
          entry_type: payload.entryType ?? "error",
          source_kind: payload.sourceKind ?? "manual",
          source_label: payload.sourceLabel?.trim() || null,
          teacher_comment: payload.teacherComment?.trim() || null,
          review_note: payload.reviewNote?.trim() || null,
        };

        const { error: insertError } = await client
          .from("error_notebook_entries")
          .insert(supportsEnhancedSchema ? enhancedPayload : basePayload);

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
        if (supportsEnhancedSchema && payload.teacherComment != null) {
          patch.teacher_comment = payload.teacherComment.trim() || null;
        }
        if (supportsEnhancedSchema && payload.reviewNote != null) {
          patch.review_note = payload.reviewNote.trim() || null;
        }
        if (supportsEnhancedSchema && payload.sourceLabel != null) {
          patch.source_label = payload.sourceLabel.trim() || null;
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
    [load, supportsEnhancedSchema],
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
