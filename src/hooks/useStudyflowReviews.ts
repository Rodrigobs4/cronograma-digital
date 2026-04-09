import { useCallback, useEffect, useState } from "react";
import { getSupabaseClient, isSupabaseConfigured } from "../lib/supabase";

interface ReviewPresetStep {
  offset_minutes?: number;
  offset_hours?: number;
  offset_days?: number;
}

interface ReviewPresetRow {
  id: string;
  code: string;
  steps: ReviewPresetStep[];
}

const defaultEvidencePresetSteps: ReviewPresetStep[] = [
  { offset_hours: 24 },
  { offset_days: 7 },
  { offset_days: 30 },
  { offset_days: 60 },
  { offset_days: 90 },
];

export interface StudyflowReviewItem {
  id: string;
  study_plan_id: string;
  subject_id: string | null;
  topic_id: string | null;
  source_session_id: string | null;
  review_status: "pending" | "completed" | "late" | "snoozed" | "archived";
  next_review_at: string | null;
  last_studied_at: string | null;
  last_reviewed_at: string | null;
  priority_score: number;
  interval_days: number;
  success_streak: number;
  lapse_count: number;
  ease_factor: number;
}

interface SyncReviewInput {
  sessionId: string;
  subjectId: string | null;
  topicId: string | null;
  completedAt: string;
}

function buildNextReviewDate(baseIso: string, step?: ReviewPresetStep) {
  const baseDate = new Date(baseIso);

  if (step?.offset_minutes) {
    baseDate.setMinutes(baseDate.getMinutes() + step.offset_minutes);
  }

  if (step?.offset_hours) {
    baseDate.setHours(baseDate.getHours() + step.offset_hours);
  }

  if (step?.offset_days) {
    baseDate.setDate(baseDate.getDate() + step.offset_days);
  }

  return baseDate.toISOString();
}

function getInitialIntervalDays(step?: ReviewPresetStep) {
  if (step?.offset_days) return step.offset_days;
  if (step?.offset_hours) return Math.max(1, Math.round(step.offset_hours / 24));
  if (step?.offset_minutes) return 1;
  return 1;
}

function getEvidenceBasedNextInterval(
  currentItem: StudyflowReviewItem,
  reviewOutcome: "fail" | "hard" | "good" | "easy",
) {
  const currentInterval = Math.max(1, currentItem.interval_days || 1);
  const nextStreak =
    reviewOutcome === "fail" ? 0 : Math.max(0, currentItem.success_streak) + 1;

  if (reviewOutcome === "fail") {
    return 1;
  }

  if (reviewOutcome === "hard") {
    return nextStreak <= 1 ? 3 : Math.max(3, Math.round(currentInterval * 1.2));
  }

  if (reviewOutcome === "easy") {
    if (nextStreak <= 1) return 7;
    if (nextStreak === 2) return 30;
    if (nextStreak === 3) return 60;
    return Math.min(120, Math.round(currentInterval * Math.max(1.8, currentItem.ease_factor * 0.7)));
  }

  if (nextStreak <= 1) return 7;
  if (nextStreak === 2) return 30;
  if (nextStreak === 3) return 60;
  return Math.min(120, Math.round(currentInterval * Math.max(1.5, currentItem.ease_factor * 0.65)));
}

function getNextEaseFactor(
  currentEaseFactor: number,
  reviewOutcome: "fail" | "hard" | "good" | "easy",
) {
  if (reviewOutcome === "fail") return Math.max(1.3, currentEaseFactor - 0.25);
  if (reviewOutcome === "hard") return Math.max(1.4, currentEaseFactor - 0.1);
  if (reviewOutcome === "easy") return Math.min(3.2, currentEaseFactor + 0.15);
  return currentEaseFactor;
}

export function useStudyflowReviews(
  planId: string | undefined,
  reviewMethodCode: string | undefined,
) {
  const [reviewItems, setReviewItems] = useState<StudyflowReviewItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!planId || !isSupabaseConfigured) {
      setReviewItems([]);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const client = getSupabaseClient();
      const { data, error: loadError } = await client
        .from("review_items")
        .select(
          "id, study_plan_id, subject_id, topic_id, source_session_id, review_status, next_review_at, last_studied_at, last_reviewed_at, priority_score, interval_days, success_streak, lapse_count, ease_factor",
        )
        .eq("study_plan_id", planId)
        .order("next_review_at", { ascending: true });

      if (loadError) throw loadError;

      setReviewItems((data ?? []) as StudyflowReviewItem[]);
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? `Falha ao carregar revisões: ${caughtError.message}`
          : "Falha ao carregar revisões.",
      );
    } finally {
      setLoading(false);
    }
  }, [planId]);

  useEffect(() => {
    load();
  }, [load]);

  const syncReviewForSession = useCallback(
    async (payload: SyncReviewInput) => {
      if (!planId || !reviewMethodCode || !isSupabaseConfigured) {
        return;
      }

      setSaving(true);
      setError(null);

      try {
        const client = getSupabaseClient();
        const { data: preset, error: presetError } = await client
          .from("review_presets")
          .select("id, code, steps")
          .eq("code", reviewMethodCode)
          .maybeSingle();

        if (presetError) throw presetError;

        const firstStep =
          (preset as ReviewPresetRow | null)?.steps?.[0] ?? defaultEvidencePresetSteps[0];
        const nextReviewAt = buildNextReviewDate(payload.completedAt, firstStep);
        const intervalDays = getInitialIntervalDays(firstStep);

        const { data: existingItem, error: existingError } = await client
          .from("review_items")
          .select("id")
          .eq("source_session_id", payload.sessionId)
          .maybeSingle();

        if (existingError) throw existingError;

        const reviewPayload = {
          study_plan_id: planId,
          subject_id: payload.subjectId,
          topic_id: payload.topicId,
          source_session_id: payload.sessionId,
          preset_id: (preset as ReviewPresetRow | null)?.id ?? null,
          review_status: "pending",
          last_studied_at: payload.completedAt,
          next_review_at: nextReviewAt,
          interval_days: intervalDays,
          ease_factor: 2.5,
          lapse_count: 0,
          success_streak: 0,
          priority_score: 1,
        };

        if (existingItem) {
          const { error: updateError } = await client
            .from("review_items")
            .update(reviewPayload)
            .eq("id", existingItem.id);

          if (updateError) throw updateError;
        } else {
          const { error: insertError } = await client
            .from("review_items")
            .insert(reviewPayload);

          if (insertError) throw insertError;
        }

        await load();
      } catch (caughtError) {
        setError(
          caughtError instanceof Error
            ? `Falha ao sincronizar revisão: ${caughtError.message}`
            : "Falha ao sincronizar revisão.",
        );
      } finally {
        setSaving(false);
      }
    },
    [load, planId, reviewMethodCode],
  );

  const completeReview = useCallback(
    async (reviewItemId: string, reviewOutcome: "fail" | "hard" | "good" | "easy") => {
      if (!isSupabaseConfigured) {
        return;
      }

      setSaving(true);
      setError(null);

      try {
        const client = getSupabaseClient();
        const currentItem = reviewItems.find((item) => item.id === reviewItemId);

        if (!currentItem) {
          return;
        }

        const nowIso = new Date().toISOString();
        const nextInterval = getEvidenceBasedNextInterval(currentItem, reviewOutcome);
        const nextReviewAt = buildNextReviewDate(nowIso, { offset_days: nextInterval });

        const { error: logError } = await client.from("review_logs").insert({
          review_item_id: reviewItemId,
          review_outcome: reviewOutcome,
          response_quality:
            reviewOutcome === "fail"
              ? 1
              : reviewOutcome === "hard"
                ? 2
                : reviewOutcome === "good"
                  ? 4
                  : 5,
        });

        if (logError) throw logError;

        const { error: updateError } = await client
          .from("review_items")
          .update({
            review_status: "pending",
            last_reviewed_at: nowIso,
            next_review_at: nextReviewAt,
            interval_days: nextInterval,
            success_streak:
              reviewOutcome === "fail" ? 0 : Math.max(0, currentItem.success_streak) + 1,
            lapse_count:
              reviewOutcome === "fail"
                ? currentItem.lapse_count + 1
                : currentItem.lapse_count,
            priority_score: reviewOutcome === "fail" ? 2 : 1,
            ease_factor: getNextEaseFactor(currentItem.ease_factor, reviewOutcome),
          })
          .eq("id", reviewItemId);

        if (updateError) throw updateError;

        await load();
      } catch (caughtError) {
        setError(
          caughtError instanceof Error
            ? `Falha ao concluir revisão: ${caughtError.message}`
            : "Falha ao concluir revisão.",
        );
      } finally {
        setSaving(false);
      }
    },
    [load, reviewItems],
  );

  const removeReview = useCallback(
    async (reviewItemId: string) => {
      if (!isSupabaseConfigured) {
        return;
      }

      setSaving(true);
      setError(null);

      try {
        const client = getSupabaseClient();
        const { error: deleteError } = await client
          .from("review_items")
          .delete()
          .eq("id", reviewItemId);

        if (deleteError) throw deleteError;

        await load();
      } catch (caughtError) {
        setError(
          caughtError instanceof Error
            ? `Falha ao excluir revisão: ${caughtError.message}`
            : "Falha ao excluir revisão.",
        );
      } finally {
        setSaving(false);
      }
    },
    [load],
  );

  return {
    reviewItems,
    loading,
    saving,
    error,
    syncReviewForSession,
    completeReview,
    removeReview,
    reload: load,
  };
}
