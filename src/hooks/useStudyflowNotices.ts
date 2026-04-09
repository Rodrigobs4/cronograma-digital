import { useCallback, useEffect, useState } from "react";
import { getSupabaseClient, isSupabaseConfigured } from "../lib/supabase";

export interface StudyflowExamNotice {
  id: string;
  workspace_id: string;
  study_plan_id: string | null;
  title: string;
  organization: string | null;
  exam_date: string | null;
  source_type: "manual" | "pdf" | "url" | "template";
  file_url: string | null;
}

interface CreateNoticeInput {
  title: string;
  organization: string;
  examDate: string;
  fileUrl: string;
}

export function useStudyflowNotices(
  workspaceId: string | undefined,
  planId: string | undefined,
) {
  const [notices, setNotices] = useState<StudyflowExamNotice[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!workspaceId || !isSupabaseConfigured) {
      setNotices([]);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const client = getSupabaseClient();
      const { data, error: loadError } = await client
        .from("exam_notices")
        .select("id, workspace_id, study_plan_id, title, organization, exam_date, source_type, file_url")
        .eq("workspace_id", workspaceId)
        .order("created_at", { ascending: false });

      if (loadError) throw loadError;

      setNotices((data ?? []) as StudyflowExamNotice[]);
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? `Falha ao carregar editais: ${caughtError.message}`
          : "Falha ao carregar editais.",
      );
    } finally {
      setLoading(false);
    }
  }, [workspaceId]);

  useEffect(() => {
    load();
  }, [load]);

  const createManualNotice = useCallback(
    async (payload: CreateNoticeInput) => {
      if (!workspaceId || !isSupabaseConfigured) {
        return;
      }

      setSaving(true);
      setError(null);

      try {
        const client = getSupabaseClient();
        const sourceType = payload.fileUrl.trim() ? "url" : "manual";

        const { error: insertError } = await client.from("exam_notices").insert({
          workspace_id: workspaceId,
          study_plan_id: planId ?? null,
          title: payload.title.trim(),
          organization: payload.organization.trim() || null,
          exam_date: payload.examDate || null,
          source_type: sourceType,
          file_url: payload.fileUrl.trim() || null,
        });

        if (insertError) throw insertError;

        await load();
      } catch (caughtError) {
        setError(
          caughtError instanceof Error
            ? `Falha ao criar edital: ${caughtError.message}`
            : "Falha ao criar edital.",
        );
      } finally {
        setSaving(false);
      }
    },
    [load, planId, workspaceId],
  );

  const removeNotice = useCallback(
    async (noticeId: string) => {
      if (!isSupabaseConfigured) {
        return;
      }

      setSaving(true);
      setError(null);

      try {
        const client = getSupabaseClient();
        const { error: deleteError } = await client
          .from("exam_notices")
          .delete()
          .eq("id", noticeId);

        if (deleteError) throw deleteError;

        await load();
      } catch (caughtError) {
        setError(
          caughtError instanceof Error
            ? `Falha ao excluir edital: ${caughtError.message}`
            : "Falha ao excluir edital.",
        );
      } finally {
        setSaving(false);
      }
    },
    [load],
  );

  return {
    notices,
    loading,
    saving,
    error,
    createManualNotice,
    removeNotice,
    reload: load,
  };
}
