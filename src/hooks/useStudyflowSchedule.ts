import { useCallback, useEffect, useState } from "react";
import { getSupabaseClient, isSupabaseConfigured } from "../lib/supabase";
import type { PlannedStudyBlock } from "../lib/studyflowEngine";

export interface StudyflowWeeklyPlan {
  id: string;
  study_plan_id: string;
  week_start_date: string;
  total_planned_minutes: number;
  total_completed_minutes: number;
  auto_generated: boolean;
}

export interface StudyflowDailyPlanItem {
  id: string;
  weekly_plan_id: string;
  study_plan_id: string;
  study_date: string;
  sequence_number: number;
  subject_id: string | null;
  topic_id: string | null;
  task_type: "study" | "review" | "questions" | "essay" | "simulado";
  source_mode: "automatic" | "manual" | "hybrid";
  planned_minutes: number;
  planned_questions: number;
  priority_score: number;
  status: "planned" | "running" | "completed" | "cancelled" | "skipped";
}

interface RescheduleItemInput {
  itemId: string;
  currentStudyDate: string;
  direction: "previous" | "next";
}

interface ReorderItemInput {
  itemId: string;
  currentStudyDate: string;
  direction: "up" | "down";
}

interface UpdateItemPositionInput {
  itemId: string;
  targetStudyDate: string;
}

interface UpdateItemStatusInput {
  itemId: string;
  status: StudyflowDailyPlanItem["status"];
}

interface CreateItemInput {
  studyDate: string;
  subjectId: string;
  topicId?: string | null;
  plannedMinutes: number;
  taskType: StudyflowDailyPlanItem["task_type"];
}

interface UpdateItemInput {
  itemId: string;
  subjectId?: string | null;
  topicId?: string | null;
  plannedMinutes?: number;
  taskType?: StudyflowDailyPlanItem["task_type"];
}

function mapTaskType(mode: PlannedStudyBlock["recommendedMode"]) {
  if (mode === "review") return "review";
  if (mode === "questions") return "questions";
  return "study";
}

export function useStudyflowSchedule(
  planId: string | undefined,
  weekStartDate: string,
) {
  const [weeklyPlan, setWeeklyPlan] = useState<StudyflowWeeklyPlan | null>(null);
  const [items, setItems] = useState<StudyflowDailyPlanItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!planId || !isSupabaseConfigured) {
      setWeeklyPlan(null);
      setItems([]);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const client = getSupabaseClient();

      const { data: weeklyPlanRow, error: weeklyPlanError } = await client
        .from("weekly_plans")
        .select(
          "id, study_plan_id, week_start_date, total_planned_minutes, total_completed_minutes, auto_generated",
        )
        .eq("study_plan_id", planId)
        .eq("week_start_date", weekStartDate)
        .maybeSingle();

      if (weeklyPlanError) throw weeklyPlanError;

      if (!weeklyPlanRow) {
        setWeeklyPlan(null);
        setItems([]);
        return;
      }

      const { data: itemRows, error: itemError } = await client
        .from("daily_plan_items")
        .select(
          "id, weekly_plan_id, study_plan_id, study_date, sequence_number, subject_id, topic_id, task_type, source_mode, planned_minutes, planned_questions, priority_score, status",
        )
        .eq("weekly_plan_id", weeklyPlanRow.id)
        .order("study_date", { ascending: true })
        .order("sequence_number", { ascending: true });

      if (itemError) throw itemError;

      setWeeklyPlan(weeklyPlanRow as StudyflowWeeklyPlan);
      setItems((itemRows ?? []) as StudyflowDailyPlanItem[]);
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? `Falha ao carregar cronograma: ${caughtError.message}`
          : "Falha ao carregar cronograma.",
      );
    } finally {
      setLoading(false);
    }
  }, [planId, weekStartDate]);

  useEffect(() => {
    load();
  }, [load]);

  const ensureWeeklyPlan = useCallback(async () => {
    if (!planId || !isSupabaseConfigured) {
      return null;
    }

    if (weeklyPlan) {
      return weeklyPlan;
    }

    const client = getSupabaseClient();
    const { data: weeklyPlanRow, error: weeklyPlanError } = await client
      .from("weekly_plans")
      .upsert(
        {
          study_plan_id: planId,
          week_start_date: weekStartDate,
          status: "active",
          total_planned_minutes: 0,
          total_completed_minutes: 0,
          auto_generated: false,
        },
        {
          onConflict: "study_plan_id,week_start_date",
        },
      )
      .select(
        "id, study_plan_id, week_start_date, total_planned_minutes, total_completed_minutes, auto_generated",
      )
      .single();

    if (weeklyPlanError) throw weeklyPlanError;

    return weeklyPlanRow as StudyflowWeeklyPlan;
  }, [planId, weekStartDate, weeklyPlan]);

  const regenerateSchedule = useCallback(
    async (blocks: PlannedStudyBlock[]) => {
      if (!planId || !isSupabaseConfigured) {
        return;
      }

      setSaving(true);
      setError(null);

      try {
        const client = getSupabaseClient();
        const totalPlannedMinutes = blocks.reduce(
          (sum, block) => sum + block.plannedMinutes,
          0,
        );

        const { data: weeklyPlanRow, error: weeklyPlanError } = await client
          .from("weekly_plans")
          .upsert(
            {
              study_plan_id: planId,
              week_start_date: weekStartDate,
              status: "active",
              total_planned_minutes: totalPlannedMinutes,
              total_completed_minutes: 0,
              auto_generated: true,
            },
            {
              onConflict: "study_plan_id,week_start_date",
            },
          )
          .select(
            "id, study_plan_id, week_start_date, total_planned_minutes, total_completed_minutes, auto_generated",
          )
          .single();

        if (weeklyPlanError) throw weeklyPlanError;

        const { error: deleteItemsError } = await client
          .from("daily_plan_items")
          .delete()
          .eq("weekly_plan_id", weeklyPlanRow.id);

        if (deleteItemsError) throw deleteItemsError;

        if (blocks.length > 0) {
          const sequenceByDate = new Map<string, number>();
          const payload = blocks.map((block) => {
            const nextSequence = (sequenceByDate.get(block.date) ?? 0) + 1;
            sequenceByDate.set(block.date, nextSequence);

            return {
              weekly_plan_id: weeklyPlanRow.id,
              study_plan_id: planId,
              study_date: block.date,
              sequence_number: nextSequence,
              subject_id: block.subjectId,
              topic_id: null,
              task_type: mapTaskType(block.recommendedMode),
              source_mode: "automatic",
              planned_minutes: block.plannedMinutes,
              planned_questions: 0,
              priority_score: block.priorityScore,
              status: "planned",
            };
          });

          const { error: insertItemsError } = await client
            .from("daily_plan_items")
            .insert(payload);

          if (insertItemsError) throw insertItemsError;
        }

        await load();
      } catch (caughtError) {
        setError(
          caughtError instanceof Error
            ? `Falha ao gerar cronograma: ${caughtError.message}`
            : "Falha ao gerar cronograma.",
        );
      } finally {
        setSaving(false);
      }
    },
    [load, planId, weekStartDate],
  );

  const skipItem = useCallback(
    async (itemId: string) => {
      if (!isSupabaseConfigured) {
        return;
      }

      setSaving(true);
      setError(null);

      try {
        const client = getSupabaseClient();
        const { error: updateError } = await client
          .from("daily_plan_items")
          .update({ status: "skipped" })
          .eq("id", itemId);

        if (updateError) throw updateError;

        await load();
      } catch (caughtError) {
        setError(
          caughtError instanceof Error
            ? `Falha ao pular bloco: ${caughtError.message}`
            : "Falha ao pular bloco.",
        );
      } finally {
        setSaving(false);
      }
    },
    [load],
  );

  const moveItem = useCallback(
    async ({ itemId, currentStudyDate, direction }: RescheduleItemInput) => {
      if (!isSupabaseConfigured || !weeklyPlan) {
        return;
      }

      setSaving(true);
      setError(null);

      try {
        const client = getSupabaseClient();
        const targetDate = new Date(`${currentStudyDate}T12:00:00`);
        targetDate.setDate(targetDate.getDate() + (direction === "next" ? 1 : -1));
        const targetDateIso = targetDate.toISOString().slice(0, 10);

        const weekStartIso = weeklyPlan.week_start_date;

        const weekEnd = new Date(`${weeklyPlan.week_start_date}T12:00:00`);
        weekEnd.setDate(weekEnd.getDate() + 6);
        const weekEndIso = weekEnd.toISOString().slice(0, 10);
        const safeTargetDate =
          targetDateIso < weekStartIso
            ? weekStartIso
            : targetDateIso > weekEndIso
              ? weekEndIso
              : targetDateIso;

        const { data: sameDayItems, error: sameDayError } = await client
          .from("daily_plan_items")
          .select("sequence_number")
          .eq("weekly_plan_id", weeklyPlan.id)
          .eq("study_date", safeTargetDate)
          .order("sequence_number", { ascending: false })
          .limit(1);

        if (sameDayError) throw sameDayError;

        const nextSequence = (sameDayItems?.[0]?.sequence_number ?? 0) + 1;

        const { error: updateError } = await client
          .from("daily_plan_items")
          .update({
            study_date: safeTargetDate,
            sequence_number: nextSequence,
            status: "planned",
          })
          .eq("id", itemId);

        if (updateError) throw updateError;

        await load();
      } catch (caughtError) {
        setError(
          caughtError instanceof Error
            ? `Falha ao remanejar bloco: ${caughtError.message}`
            : "Falha ao remanejar bloco.",
        );
      } finally {
        setSaving(false);
      }
    },
    [load, weeklyPlan],
  );

  const updateItemPosition = useCallback(
    async ({ itemId, targetStudyDate }: UpdateItemPositionInput) => {
      if (!isSupabaseConfigured || !weeklyPlan) {
        return;
      }

      setSaving(true);
      setError(null);

      try {
        const client = getSupabaseClient();
        const { data: sameDayItems, error: sameDayError } = await client
          .from("daily_plan_items")
          .select("sequence_number")
          .eq("weekly_plan_id", weeklyPlan.id)
          .eq("study_date", targetStudyDate)
          .neq("id", itemId)
          .order("sequence_number", { ascending: false })
          .limit(1);

        if (sameDayError) throw sameDayError;

        const nextSequence = (sameDayItems?.[0]?.sequence_number ?? 0) + 1;

        const { error: updateError } = await client
          .from("daily_plan_items")
          .update({
            study_date: targetStudyDate,
            sequence_number: nextSequence,
            status: "planned",
          })
          .eq("id", itemId);

        if (updateError) throw updateError;

        await load();
      } catch (caughtError) {
        setError(
          caughtError instanceof Error
            ? `Falha ao reposicionar bloco: ${caughtError.message}`
            : "Falha ao reposicionar bloco.",
        );
      } finally {
        setSaving(false);
      }
    },
    [load, weeklyPlan],
  );

  const reorderItem = useCallback(
    async ({ itemId, currentStudyDate, direction }: ReorderItemInput) => {
      if (!isSupabaseConfigured || !weeklyPlan) {
        return;
      }

      const currentItem = items.find((item) => item.id === itemId);
      const sameDayItems = items
        .filter((item) => item.study_date === currentStudyDate)
        .sort((left, right) => left.sequence_number - right.sequence_number);
      const currentIndex = sameDayItems.findIndex((item) => item.id === itemId);
      const targetIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1;
      const targetItem = sameDayItems[targetIndex];

      if (!currentItem || !targetItem) {
        return;
      }

      setSaving(true);
      setError(null);

      try {
        const client = getSupabaseClient();
        const temporarySequence = -Date.now();

        const { error: firstError } = await client
          .from("daily_plan_items")
          .update({ sequence_number: temporarySequence })
          .eq("id", currentItem.id);

        if (firstError) throw firstError;

        const { error: secondError } = await client
          .from("daily_plan_items")
          .update({ sequence_number: currentItem.sequence_number })
          .eq("id", targetItem.id);

        if (secondError) throw secondError;

        const { error: thirdError } = await client
          .from("daily_plan_items")
          .update({ sequence_number: targetItem.sequence_number })
          .eq("id", currentItem.id);

        if (thirdError) throw thirdError;

        await load();
      } catch (caughtError) {
        setError(
          caughtError instanceof Error
            ? `Falha ao reordenar bloco: ${caughtError.message}`
            : "Falha ao reordenar bloco.",
        );
      } finally {
        setSaving(false);
      }
    },
    [items, load, weeklyPlan],
  );

  const updateItemStatus = useCallback(
    async ({ itemId, status }: UpdateItemStatusInput) => {
      if (!isSupabaseConfigured) {
        return;
      }

      setSaving(true);
      setError(null);

      try {
        const client = getSupabaseClient();
        const { error: updateError } = await client
          .from("daily_plan_items")
          .update({ status })
          .eq("id", itemId);

        if (updateError) throw updateError;

        await load();
      } catch (caughtError) {
        setError(
          caughtError instanceof Error
            ? `Falha ao atualizar bloco: ${caughtError.message}`
            : "Falha ao atualizar bloco.",
        );
      } finally {
        setSaving(false);
      }
    },
    [load],
  );

  const createItem = useCallback(
    async (payload: CreateItemInput) => {
      if (!planId || !isSupabaseConfigured) {
        return;
      }

      setSaving(true);
      setError(null);

      try {
        const client = getSupabaseClient();
        const weeklyPlanRow = await ensureWeeklyPlan();

        if (!weeklyPlanRow) {
          return;
        }

        const { data: sameDayItems, error: sameDayError } = await client
          .from("daily_plan_items")
          .select("sequence_number")
          .eq("weekly_plan_id", weeklyPlanRow.id)
          .eq("study_date", payload.studyDate)
          .order("sequence_number", { ascending: false })
          .limit(1);

        if (sameDayError) throw sameDayError;

        const nextSequence = (sameDayItems?.[0]?.sequence_number ?? 0) + 1;

        const { error: insertError } = await client.from("daily_plan_items").insert({
          weekly_plan_id: weeklyPlanRow.id,
          study_plan_id: planId,
          study_date: payload.studyDate,
          sequence_number: nextSequence,
          subject_id: payload.subjectId,
          topic_id: payload.topicId ?? null,
          task_type: payload.taskType,
          source_mode: "manual",
          planned_minutes: payload.plannedMinutes,
          planned_questions: 0,
          priority_score: 1,
          status: "planned",
        });

        if (insertError) throw insertError;

        await load();
      } catch (caughtError) {
        setError(
          caughtError instanceof Error
            ? `Falha ao criar bloco: ${caughtError.message}`
            : "Falha ao criar bloco.",
        );
      } finally {
        setSaving(false);
      }
    },
    [ensureWeeklyPlan, load, planId],
  );

  const updateItem = useCallback(
    async (payload: UpdateItemInput) => {
      if (!isSupabaseConfigured) {
        return;
      }

      setSaving(true);
      setError(null);

      try {
        const client = getSupabaseClient();
        const patch: Record<string, unknown> = {};

        if ("subjectId" in payload) patch.subject_id = payload.subjectId;
        if ("topicId" in payload) patch.topic_id = payload.topicId;
        if (payload.plannedMinutes != null) patch.planned_minutes = payload.plannedMinutes;
        if (payload.taskType) patch.task_type = payload.taskType;

        const { error: updateError } = await client
          .from("daily_plan_items")
          .update(patch)
          .eq("id", payload.itemId);

        if (updateError) throw updateError;

        await load();
      } catch (caughtError) {
        setError(
          caughtError instanceof Error
            ? `Falha ao editar bloco: ${caughtError.message}`
            : "Falha ao editar bloco.",
        );
      } finally {
        setSaving(false);
      }
    },
    [load],
  );

  const deleteItem = useCallback(
    async (itemId: string) => {
      if (!isSupabaseConfigured) {
        return;
      }

      setSaving(true);
      setError(null);

      try {
        const client = getSupabaseClient();
        const { error: deleteError } = await client
          .from("daily_plan_items")
          .delete()
          .eq("id", itemId);

        if (deleteError) throw deleteError;

        await load();
      } catch (caughtError) {
        setError(
          caughtError instanceof Error
            ? `Falha ao excluir bloco: ${caughtError.message}`
            : "Falha ao excluir bloco.",
        );
      } finally {
        setSaving(false);
      }
    },
    [load],
  );

  return {
    weeklyPlan,
    items,
    loading,
    saving,
    error,
    regenerateSchedule,
    skipItem,
    moveItem,
    updateItemPosition,
    reorderItem,
    updateItemStatus,
    createItem,
    updateItem,
    deleteItem,
    reload: load,
  };
}
