import { useCallback, useEffect, useState } from "react";
import { getSupabaseClient, isSupabaseConfigured } from "../lib/supabase";

export interface StudyflowMetricSession {
  id: string;
  subject_id: string | null;
  topic_id: string | null;
  net_minutes: number;
  questions_answered: number;
  questions_correct: number;
  session_date: string;
}

export function useStudyflowPlanMetrics(planId: string | undefined) {
  const [sessions, setSessions] = useState<StudyflowMetricSession[]>([]);
  const [loading, setLoading] = useState(false);
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
        .select("id, subject_id, topic_id, net_minutes, questions_answered, questions_correct, session_date")
        .eq("study_plan_id", planId)
        .eq("session_status", "completed")
        .order("session_date", { ascending: false });

      if (loadError) throw loadError;

      setSessions((data ?? []) as StudyflowMetricSession[]);
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? `Falha ao carregar métricas: ${caughtError.message}`
          : "Falha ao carregar métricas.",
      );
    } finally {
      setLoading(false);
    }
  }, [planId]);

  useEffect(() => {
    load();
  }, [load]);

  return {
    sessions,
    loading,
    error,
    reload: load,
  };
}
