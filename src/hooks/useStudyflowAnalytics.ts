import { useCallback, useEffect, useState } from "react";
import { getSupabaseClient, isSupabaseConfigured } from "../lib/supabase";

export interface PlanDashboardSummary {
  study_plan_id: string;
  title: string;
  study_type: "concurso" | "vestibular" | "enem" | "faculdade" | "livre";
  status: "draft" | "active" | "paused" | "completed" | "archived";
  target_date: string | null;
  active_subjects: number;
  total_topics: number;
  completed_topics: number;
  total_minutes: number;
  total_questions: number;
  total_correct: number;
  pending_reviews: number;
}

export interface DifficultyMapRow {
  id: string;
  subject_id: string | null;
  topic_id: string | null;
  self_perception: "low" | "medium" | "high";
  inferred_difficulty: "low" | "medium" | "high";
  recommendation: "advance" | "maintain" | "review" | "reinforce";
  confidence_score: number;
}

interface SessionAnalyticsInput {
  sessionDate: string;
  subjectId: string | null;
  topicId: string | null;
  studiedMinutes: number;
  questionsAnswered: number;
  questionsCorrect: number;
}

interface ReviewAnalyticsInput {
  sessionDate: string;
  subjectId: string | null;
  topicId: string | null;
  outcome: "fail" | "hard" | "good" | "easy";
}

function deriveDifficulty(answered: number, correct: number) {
  if (answered <= 0) return "medium" as const;
  const accuracy = correct / answered;

  if (accuracy < 0.5) return "high" as const;
  if (accuracy < 0.75) return "medium" as const;
  return "low" as const;
}

function deriveRecommendation(answered: number, correct: number) {
  if (answered <= 0) return "maintain" as const;
  const accuracy = correct / answered;

  if (accuracy < 0.5) return "reinforce" as const;
  if (accuracy < 0.75) return "review" as const;
  if (accuracy < 0.9) return "maintain" as const;
  return "advance" as const;
}

function mapOutcomeToRecommendation(outcome: ReviewAnalyticsInput["outcome"]) {
  if (outcome === "fail") return "reinforce" as const;
  if (outcome === "hard") return "review" as const;
  if (outcome === "easy") return "advance" as const;
  return "maintain" as const;
}

function mapOutcomeToDifficulty(outcome: ReviewAnalyticsInput["outcome"]) {
  if (outcome === "fail") return "high" as const;
  if (outcome === "hard") return "medium" as const;
  return "low" as const;
}

function applyNullableEq<TQuery>(
  query: TQuery,
  column: "subject_id" | "topic_id",
  value: string | null,
) {
  const builder = query as {
    eq: (column: string, value: string) => TQuery;
    is: (column: string, value: null) => TQuery;
  };

  return value ? builder.eq(column, value) : builder.is(column, null);
}

export function useStudyflowAnalytics(planId: string | undefined) {
  const [dashboard, setDashboard] = useState<PlanDashboardSummary | null>(null);
  const [difficultyMaps, setDifficultyMaps] = useState<DifficultyMapRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!planId || !isSupabaseConfigured) {
      setDashboard(null);
      setDifficultyMaps([]);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const client = getSupabaseClient();
      const [{ data: dashboardRow, error: dashboardError }, { data: mapsRow, error: mapsError }] =
        await Promise.all([
          client
            .from("v_plan_dashboard")
            .select(
              "study_plan_id, title, study_type, status, target_date, active_subjects, total_topics, completed_topics, total_minutes, total_questions, total_correct, pending_reviews",
            )
            .eq("study_plan_id", planId)
            .maybeSingle(),
          client
            .from("difficulty_maps")
            .select(
              "id, subject_id, topic_id, self_perception, inferred_difficulty, recommendation, confidence_score",
            )
            .eq("study_plan_id", planId),
        ]);

      if (dashboardError) throw dashboardError;
      if (mapsError) throw mapsError;

      setDashboard((dashboardRow as PlanDashboardSummary | null) ?? null);
      setDifficultyMaps((mapsRow ?? []) as DifficultyMapRow[]);
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? `Falha ao carregar analytics: ${caughtError.message}`
          : "Falha ao carregar analytics.",
      );
    } finally {
      setLoading(false);
    }
  }, [planId]);

  useEffect(() => {
    load();
  }, [load]);

  const syncSessionAnalytics = useCallback(
    async (payload: SessionAnalyticsInput) => {
      if (!planId || !isSupabaseConfigured) {
        return;
      }

      setSaving(true);
      setError(null);

      try {
        const client = getSupabaseClient();

        const snapshotQuery = applyNullableEq(
          applyNullableEq(
            client
              .from("performance_snapshots")
              .select("id, studied_minutes, questions_answered, questions_correct")
              .eq("study_plan_id", planId),
            "subject_id",
            payload.subjectId,
          ),
          "topic_id",
          payload.topicId,
        ).eq("snapshot_date", payload.sessionDate);

        const { data: snapshotRow, error: snapshotFindError } = await snapshotQuery.maybeSingle();

        if (snapshotFindError) throw snapshotFindError;

        const { data: difficultyRow, error: difficultyFindError } = await applyNullableEq(
          applyNullableEq(
            client
              .from("difficulty_maps")
              .select("id")
              .eq("study_plan_id", planId),
            "subject_id",
            payload.subjectId,
          ),
          "topic_id",
          payload.topicId,
        ).maybeSingle();

        if (difficultyFindError) throw difficultyFindError;

        const inferredDifficulty = deriveDifficulty(
          payload.questionsAnswered,
          payload.questionsCorrect,
        );
        const recommendation = deriveRecommendation(
          payload.questionsAnswered,
          payload.questionsCorrect,
        );

        if (!payload.subjectId) {
          await load();
          return;
        }

        const snapshotPayload = {
          study_plan_id: planId,
          subject_id: payload.subjectId,
          topic_id: payload.topicId,
          snapshot_date: payload.sessionDate,
          studied_minutes: (snapshotRow?.studied_minutes ?? 0) + payload.studiedMinutes,
          questions_answered:
            (snapshotRow?.questions_answered ?? 0) + payload.questionsAnswered,
          questions_correct:
            (snapshotRow?.questions_correct ?? 0) + payload.questionsCorrect,
          consistency_score: payload.studiedMinutes > 0 ? 1 : 0,
        };

        if (snapshotRow) {
          const { error: updateSnapshotError } = await client
            .from("performance_snapshots")
            .update(snapshotPayload)
            .eq("id", snapshotRow.id);

          if (updateSnapshotError) throw updateSnapshotError;
        } else {
          const { error: insertSnapshotError } = await client
            .from("performance_snapshots")
            .insert(snapshotPayload);

          if (insertSnapshotError) throw insertSnapshotError;
        }

        const difficultyPayload = {
            study_plan_id: planId,
            subject_id: payload.subjectId,
            topic_id: payload.topicId,
            inferred_difficulty: inferredDifficulty,
            recommendation,
            confidence_score:
              payload.questionsAnswered > 0
                ? Number(
                    (
                      (payload.questionsCorrect / Math.max(payload.questionsAnswered, 1)) *
                      100
                    ).toFixed(2),
                  )
                : 0,
        };

        if (difficultyRow) {
          const { error: updateDifficultyError } = await client
            .from("difficulty_maps")
            .update(difficultyPayload)
            .eq("id", difficultyRow.id);

          if (updateDifficultyError) throw updateDifficultyError;
        } else {
          const { error: insertDifficultyError } = await client
            .from("difficulty_maps")
            .insert(difficultyPayload);

          if (insertDifficultyError) throw insertDifficultyError;
        }

        await load();
      } catch (caughtError) {
        setError(
          caughtError instanceof Error
            ? `Falha ao sincronizar analytics: ${caughtError.message}`
            : "Falha ao sincronizar analytics.",
        );
      } finally {
        setSaving(false);
      }
    },
    [load, planId],
  );

  const syncReviewAnalytics = useCallback(
    async (payload: ReviewAnalyticsInput) => {
      if (!planId || !isSupabaseConfigured) {
        return;
      }

      setSaving(true);
      setError(null);

      try {
        const client = getSupabaseClient();

        if (!payload.subjectId) {
          await load();
          return;
        }

        const { data: difficultyRow, error: findError } = await applyNullableEq(
          applyNullableEq(
            client
              .from("difficulty_maps")
              .select("id, confidence_score")
              .eq("study_plan_id", planId),
            "subject_id",
            payload.subjectId,
          ),
          "topic_id",
          payload.topicId,
        ).maybeSingle();

        if (findError) throw findError;

        const difficultyPayload = {
          study_plan_id: planId,
          subject_id: payload.subjectId,
          topic_id: payload.topicId,
          inferred_difficulty: mapOutcomeToDifficulty(payload.outcome),
          recommendation: mapOutcomeToRecommendation(payload.outcome),
          confidence_score:
            payload.outcome === "easy"
              ? 90
              : payload.outcome === "good"
                ? 75
                : payload.outcome === "hard"
                  ? 55
                  : 35,
        };

        if (difficultyRow) {
          const { error: updateError } = await client
            .from("difficulty_maps")
            .update(difficultyPayload)
            .eq("id", difficultyRow.id);

          if (updateError) throw updateError;
        } else {
          const { error: insertError } = await client
            .from("difficulty_maps")
            .insert(difficultyPayload);

          if (insertError) throw insertError;
        }

        const { data: snapshotRow, error: snapshotFindError } = await applyNullableEq(
          applyNullableEq(
            client
              .from("performance_snapshots")
              .select("id, reviews_done")
              .eq("study_plan_id", planId),
            "subject_id",
            payload.subjectId,
          ),
          "topic_id",
          payload.topicId,
        )
          .eq("snapshot_date", payload.sessionDate)
          .maybeSingle();

        if (snapshotFindError) throw snapshotFindError;

        if (snapshotRow) {
          const { error: updateSnapshotError } = await client
            .from("performance_snapshots")
            .update({
              reviews_done: (snapshotRow.reviews_done ?? 0) + 1,
            })
            .eq("id", snapshotRow.id);

          if (updateSnapshotError) throw updateSnapshotError;
        } else {
          const { error: insertSnapshotError } = await client
            .from("performance_snapshots")
            .insert({
              study_plan_id: planId,
              subject_id: payload.subjectId,
              topic_id: payload.topicId,
              snapshot_date: payload.sessionDate,
              reviews_done: 1,
            });

          if (insertSnapshotError) throw insertSnapshotError;
        }

        await load();
      } catch (caughtError) {
        setError(
          caughtError instanceof Error
            ? `Falha ao atualizar mapa de dificuldade: ${caughtError.message}`
            : "Falha ao atualizar mapa de dificuldade.",
        );
      } finally {
        setSaving(false);
      }
    },
    [load, planId],
  );

  return {
    dashboard,
    difficultyMaps,
    loading,
    saving,
    error,
    syncSessionAnalytics,
    syncReviewAnalytics,
    reload: load,
  };
}
