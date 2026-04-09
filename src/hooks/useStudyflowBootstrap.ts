import { useCallback, useEffect, useState } from "react";
import { getSupabaseClient, isSupabaseConfigured } from "../lib/supabase";

export interface StudyflowProfile {
  id: string;
  full_name: string | null;
  email: string | null;
}

export interface StudyflowWorkspace {
  id: string;
  user_id: string;
  name: string;
  is_default: boolean;
}

export interface StudyflowPlan {
  id: string;
  workspace_id: string;
  title: string;
  description: string | null;
  study_type: "concurso" | "vestibular" | "enem" | "faculdade" | "livre";
  target_date: string | null;
  planning_mode: "automatic" | "manual" | "hybrid";
  status: "draft" | "active" | "paused" | "completed" | "archived";
  weekly_available_minutes: number;
  daily_available_minutes: number;
  preferred_block_minutes: number;
  subjects_per_day: number;
  review_method_code: string;
  allow_auto_rebalance: boolean;
  metadata: Record<string, unknown> | null;
}

interface SavePlanInput {
  fullName: string;
  workspaceName: string;
  planTitle: string;
  studyType: "concurso" | "vestibular" | "enem" | "faculdade" | "livre";
  targetDate: string;
  planStartDate: string;
  dailyStudyHours: number;
  subjectsPerDay: number;
}

export function useStudyflowBootstrap(userId: string | undefined, userEmail?: string) {
  const [profile, setProfile] = useState<StudyflowProfile | null>(null);
  const [workspace, setWorkspace] = useState<StudyflowWorkspace | null>(null);
  const [plan, setPlan] = useState<StudyflowPlan | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!userId || !isSupabaseConfigured) {
      setProfile(null);
      setWorkspace(null);
      setPlan(null);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const client = getSupabaseClient();

      const { data: profileRow, error: profileError } = await client
        .from("profiles")
        .select("id, full_name, email")
        .eq("id", userId)
        .maybeSingle();

      if (profileError) throw profileError;

      let ensuredProfile = profileRow;

      if (!ensuredProfile) {
        const { data: createdProfile, error: createProfileError } = await client
          .from("profiles")
          .insert({
            id: userId,
            full_name: userEmail?.split("@")[0] ?? "Usuário",
            email: userEmail ?? null,
          })
          .select("id, full_name, email")
          .single();

        if (createProfileError) throw createProfileError;
        ensuredProfile = createdProfile;
      }

      const { data: workspaceRow, error: workspaceError } = await client
        .from("workspaces")
        .select("id, user_id, name, is_default")
        .eq("user_id", userId)
        .order("is_default", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (workspaceError) throw workspaceError;

      let ensuredWorkspace = workspaceRow;

      if (!ensuredWorkspace) {
        const { data: createdWorkspace, error: createWorkspaceError } = await client
          .from("workspaces")
          .insert({
            user_id: userId,
            name: "Workspace principal",
            is_default: true,
          })
          .select("id, user_id, name, is_default")
          .single();

        if (createWorkspaceError) throw createWorkspaceError;
        ensuredWorkspace = createdWorkspace;
      }

      const { data: planRow, error: planError } = await client
        .from("study_plans")
        .select(
          "id, workspace_id, title, description, study_type, target_date, planning_mode, status, weekly_available_minutes, daily_available_minutes, preferred_block_minutes, subjects_per_day, review_method_code, allow_auto_rebalance, metadata",
        )
        .eq("workspace_id", ensuredWorkspace.id)
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();

      if (planError) throw planError;

      let ensuredPlan = planRow;

      if (!ensuredPlan) {
        const { data: createdPlan, error: createPlanError } = await client
          .from("study_plans")
          .insert({
            workspace_id: ensuredWorkspace.id,
            title: "Meu primeiro plano",
            description: "Plano inicial do StudyFlow",
            study_type: "concurso",
            planning_mode: "automatic",
            status: "active",
            weekly_available_minutes: 1500,
            daily_available_minutes: 240,
            preferred_block_minutes: 50,
            subjects_per_day: 4,
            review_method_code: "evidence_active_recall",
            allow_auto_rebalance: true,
            metadata: {},
          })
          .select(
            "id, workspace_id, title, description, study_type, target_date, planning_mode, status, weekly_available_minutes, daily_available_minutes, preferred_block_minutes, subjects_per_day, review_method_code, allow_auto_rebalance, metadata",
          )
          .single();

        if (createPlanError) throw createPlanError;
        ensuredPlan = createdPlan;
      }

      if (ensuredPlan.review_method_code === "classic_24_7_30") {
        const { data: updatedPlan, error: updateReviewMethodError } = await client
          .from("study_plans")
          .update({ review_method_code: "evidence_active_recall" })
          .eq("id", ensuredPlan.id)
          .select(
            "id, workspace_id, title, description, study_type, target_date, planning_mode, status, weekly_available_minutes, daily_available_minutes, preferred_block_minutes, subjects_per_day, review_method_code, allow_auto_rebalance, metadata",
          )
          .single();

        if (updateReviewMethodError) throw updateReviewMethodError;
        ensuredPlan = updatedPlan;
      }

      setProfile(ensuredProfile);
      setWorkspace(ensuredWorkspace);
      setPlan(ensuredPlan);
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? `Falha ao carregar StudyFlow: ${caughtError.message}`
          : "Falha ao carregar StudyFlow.",
      );
    } finally {
      setLoading(false);
    }
  }, [userEmail, userId]);

  useEffect(() => {
    load();
  }, [load]);

  const saveProfileAndPlan = useCallback(
    async (payload: SavePlanInput) => {
      if (!profile || !workspace || !plan || !isSupabaseConfigured) {
        return;
      }

      setSaving(true);
      setError(null);

      try {
        const client = getSupabaseClient();

        const { error: profileError } = await client
          .from("profiles")
          .update({
            full_name: payload.fullName,
            email: userEmail ?? profile.email,
            onboarding_completed: true,
          })
          .eq("id", profile.id);

        if (profileError) throw profileError;

        const { error: workspaceError } = await client
          .from("workspaces")
          .update({ name: payload.workspaceName })
          .eq("id", workspace.id);

        if (workspaceError) throw workspaceError;

        const dailyMinutes = Math.max(30, Math.round(payload.dailyStudyHours * 60));
        const weeklyMinutes = dailyMinutes * 6;

        const { error: planError } = await client
          .from("study_plans")
          .update({
            title: payload.planTitle,
            study_type: payload.studyType,
            target_date: payload.targetDate || null,
            daily_available_minutes: dailyMinutes,
            weekly_available_minutes: weeklyMinutes,
            subjects_per_day: payload.subjectsPerDay,
            preferred_block_minutes: Math.min(
              Math.max(Math.round(dailyMinutes / payload.subjectsPerDay), 25),
              90,
            ),
            metadata: {
              ...(plan.metadata ?? {}),
              plan_start_date: payload.planStartDate || null,
            },
          })
          .eq("id", plan.id);

        if (planError) throw planError;

        await load();
      } catch (caughtError) {
        setError(
          caughtError instanceof Error
            ? `Falha ao salvar StudyFlow: ${caughtError.message}`
            : "Falha ao salvar StudyFlow.",
        );
      } finally {
        setSaving(false);
      }
    },
    [load, plan, profile, userEmail, workspace],
  );

  return {
    profile,
    workspace,
    plan,
    loading,
    saving,
    error,
    saveProfileAndPlan,
    reload: load,
  };
}
