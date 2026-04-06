import { useEffect, useMemo, useState } from "react";
import { differenceInCalendarDays, parseISO } from "date-fns";
import {
  BookOpenCheck,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Cloud,
  FileText,
  LayoutDashboard,
  LibraryBig,
  ListChecks,
  Brain,
  LogOut,
  Mail,
  PlusCircle,
  SkipForward,
  Target,
  Trash2,
  UserRound,
} from "lucide-react";
import { PomodoroCard } from "./components/dashboard/PomodoroCard";
import { StatsCards } from "./components/dashboard/StatsCards";
import { TodaySessions } from "./components/dashboard/TodaySessions";
import { CycleBoard } from "./components/cycle/CycleBoard";
import { AppShell } from "./components/layout/AppShell";
import { Badge } from "./components/ui/Badge";
import { Card } from "./components/ui/Card";
import {
  disciplineRoadmaps,
  essayThemes,
  finalStretchDays,
  phase3Cycle,
  studyRules,
} from "./data/roadmap";
import { useExamCatalog } from "./hooks/useExamCatalog";
import { useAuthSession } from "./hooks/useAuthSession";
import { useWorkspace } from "./hooks/useWorkspace";
import {
  getAdaptivePhases,
  getCycleDay,
  getCycleNumber,
  getPhase,
  getPlanDay,
  getPlanDays,
} from "./lib/plan";
import { cn } from "./lib/utils";
import { isSupabaseConfigured } from "./lib/supabase";
import { usePlanStore } from "./store/usePlanStore";

type ViewKey =
  | "overview"
  | "cronograma"
  | "tracker"
  | "conteudo"
  | "redacao"
  | "perfil"
  | "foco";

const views: Array<{ key: ViewKey; label: string; icon: typeof LayoutDashboard }> = [
  { key: "overview", label: "Processo", icon: LayoutDashboard },
  { key: "cronograma", label: "Ciclos", icon: CalendarDays },
  { key: "tracker", label: "Registro", icon: ListChecks },
  { key: "conteudo", label: "Conteúdo", icon: LibraryBig },
  { key: "redacao", label: "Redação", icon: FileText },
  { key: "foco", label: "Sessões", icon: Clock3 },
];

const phaseStyles = {
  fase1: "border-sky-200 bg-sky-50 text-sky-900",
  fase2: "border-violet-200 bg-violet-50 text-violet-900",
  fase3: "border-amber-200 bg-amber-50 text-amber-900",
  fase4: "border-rose-200 bg-rose-50 text-rose-900",
} as const;

function parseHours(value: string) {
  const parsed = Number(value.replace(",", "."));
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatAuthErrorMessage(message: string, mode: "login" | "signup" | "reset") {
  const normalized = message.toLowerCase();

  if (normalized.includes("invalid login credentials")) {
    return "E-mail ou senha inválidos. Se a conta foi criada agora, confirme o e-mail antes de entrar.";
  }

  if (normalized.includes("email not confirmed")) {
    return "Seu e-mail ainda não foi confirmado. Abra sua caixa de entrada e confirme o cadastro antes de entrar.";
  }

  if (normalized.includes("user already registered")) {
    return "Este e-mail já está cadastrado. Tente entrar ou use a recuperação de senha.";
  }

  if (normalized.includes("password should be at least")) {
    return "A senha está curta demais. Use pelo menos 6 caracteres.";
  }

  if (normalized.includes("signup is disabled")) {
    return "O cadastro por e-mail está desativado no projeto.";
  }

  if (mode === "reset" && normalized.includes("for security purposes")) {
    return "Se existir uma conta com este e-mail, o link de recuperação será enviado.";
  }

  return message;
}

function clampCycle(value: number, max: number) {
  return Math.min(Math.max(value, 1), max);
}

function getSuggestedTopic(
  cycleSource: string[],
  progress: {
    currentCycle: number;
    selectedTopic?: string;
    customTopics?: string[];
  } | null | undefined,
) {
  const cycleTopic = cycleSource[(progress?.currentCycle ?? 1) - 1] ?? "";

  return progress?.selectedTopic || cycleTopic || "Assunto não definido";
}

function getSafeDisciplineProgress(
  disciplineId: string,
  progressMap: ReturnType<typeof usePlanStore.getState>["disciplineProgress"],
) {
  const raw = progressMap[disciplineId];

  return {
    disciplineId,
    currentCycle: raw?.currentCycle ?? 1,
    skipCompletedTopics: raw?.skipCompletedTopics ?? false,
    notes: raw?.notes ?? "",
    selectedTopic: raw?.selectedTopic ?? "",
    customTopics: raw?.customTopics ?? [],
    masteryLevel: raw?.masteryLevel ?? "nao_estudada",
  };
}

function getReviewStrategy(
  discipline: { type: string; shortName: string },
  masteryLevel: "nao_estudada" | "parcial" | "revisao",
) {
  if (masteryLevel === "nao_estudada") {
    return {
      label: "Base + fixação",
      split: "70% conteúdo • 20% questões • 10% revisão ativa",
      summary:
        "Aprenda o núcleo do assunto e feche com poucas questões para consolidar sem ansiedade excessiva.",
    };
  }

  if (masteryLevel === "revisao") {
    return {
      label: "Revisão por provas",
      split: "15% revisão rápida • 70% questões/provas • 15% correção de erros",
      summary:
        discipline.type === "decoreba"
          ? "Use questões, flashcards e revisão espaçada para manter memória de recuperação."
          : "Use blocos de prova, correção detalhada e revisão dos erros mais recorrentes.",
    };
  }

  return {
    label: "Consolidação",
    split: "40% conteúdo • 40% questões • 20% revisão de erros",
    summary:
      "Equilibre aprofundamento e recuperação ativa. O objetivo aqui é transformar conhecimento em desempenho.",
  };
}

function getDisciplinePriority(
  discipline: { sessionsPerCycle: number; type: string },
  progress: ReturnType<typeof getSafeDisciplineProgress>,
  experienceLevel: "iniciante" | "intermediario" | "avancado",
) {
  const masteryWeight =
    progress.masteryLevel === "nao_estudada"
      ? 1.35
      : progress.masteryLevel === "parcial"
        ? 1.05
        : 0.82;

  const typeWeight =
    discipline.type === "decoreba"
      ? 0.92
      : discipline.type === "raciocinio"
        ? 1.12
        : 1;

  const experienceWeight =
    experienceLevel === "iniciante"
      ? 1.12
      : experienceLevel === "avancado"
        ? 0.94
        : 1;

  return discipline.sessionsPerCycle * masteryWeight * typeWeight * experienceWeight;
}

function buildAdaptiveCycleDays(
  disciplines: Array<{
    id: string;
    sessionsPerCycle: number;
    type: string;
  }>,
  progressMap: ReturnType<typeof usePlanStore.getState>["disciplineProgress"],
  disciplinesPerDay: number,
  experienceLevel: "iniciante" | "intermediario" | "avancado",
) {
  const cycleOrder = ["A", "B", "C", "D", "E", "F"] as const;
  const safePerDay = Math.min(
    Math.max(disciplinesPerDay, 1),
    Math.max(disciplines.length, 1),
  );

  if (disciplines.length === 0) {
    return cycleOrder.map((id) => ({ id, sessions: [] }));
  }

  const weighted = disciplines.map((discipline) => ({
    discipline,
    score: getDisciplinePriority(
      discipline,
      getSafeDisciplineProgress(discipline.id, progressMap),
      experienceLevel,
    ),
    assigned: 0,
    lastDayIndex: -10,
  }));

  return cycleOrder.map((dayId, dayIndex) => {
    const sessions: string[] = [];

    while (sessions.length < safePerDay) {
      const choice = weighted
        .filter((item) => !sessions.includes(item.discipline.id))
        .sort((left, right) => {
          const leftRatio = left.assigned / left.score;
          const rightRatio = right.assigned / right.score;

          if (leftRatio !== rightRatio) {
            return leftRatio - rightRatio;
          }

          if (left.lastDayIndex !== right.lastDayIndex) {
            return left.lastDayIndex - right.lastDayIndex;
          }

          return right.score - left.score;
        })[0];

      if (!choice) {
        break;
      }

      sessions.push(choice.discipline.id);
      choice.assigned += 1;
      choice.lastDayIndex = dayIndex;
    }

    return {
      id: dayId,
      sessions,
    };
  });
}

export default function App() {
  const [activeView, setActiveView] = useState<ViewKey>("overview");
  const [newTopicDrafts, setNewTopicDrafts] = useState<Record<string, string>>({});
  const [authMode, setAuthMode] = useState<"login" | "signup" | "reset">("login");
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authMessage, setAuthMessage] = useState<string | null>(null);
  const [newDisciplineDraft, setNewDisciplineDraft] = useState({
    name: "",
    shortName: "",
    emoji: "📘",
    estimatedQuestions: "10",
    bankCount: "0",
    type: "mista" as const,
    sessionsPerCycle: "2",
    topics: "",
  });
  const {
    currentDate,
    completedSessions,
    trackerEntries,
    disciplineProgress,
    plannerSettings,
    customDisciplines,
    activeDisciplineIds,
    setCurrentDate,
    toggleSession,
    updateTrackerEntry,
    updateDisciplineProgress,
    updatePlannerSettings,
    toggleDisciplineActive,
    setActiveDisciplines,
    setCustomDisciplines,
    setDisciplineProgressMap,
    setTrackerEntries,
    addCustomDiscipline,
    removeCustomDiscipline,
    addCustomTopic,
  } = usePlanStore();
  const {
    session,
    loading: authLoading,
    signInWithPassword,
    signUpWithPassword,
    resetPassword,
    signOut,
  } = useAuthSession();
  const {
    workspace,
    customDisciplines: remoteCustomDisciplines,
    disciplineProgress: remoteDisciplineProgress,
    trackerEntries: remoteTrackerEntries,
    loading: workspaceLoading,
    saving: workspaceSaving,
    error: workspaceError,
    saveWorkspace,
  } = useWorkspace(session?.user.id);
  const { disciplines, source, error } = useExamCatalog();
  const allDisciplines = useMemo(
    () => [
      ...disciplines.map((discipline) => ({
        ...discipline,
        source: discipline.source ?? "catalog",
      })),
      ...customDisciplines,
    ],
    [customDisciplines, disciplines],
  );
  const resolvedActiveIds =
    activeDisciplineIds.length > 0
      ? activeDisciplineIds
      : session
        ? customDisciplines.map((discipline) => discipline.id)
        : allDisciplines.map((discipline) => discipline.id);
  const activeDisciplines = allDisciplines.filter((discipline) =>
    resolvedActiveIds.includes(discipline.id),
  );
  const effectiveCycleDays = useMemo(
    () =>
      buildAdaptiveCycleDays(
        activeDisciplines,
        disciplineProgress,
        plannerSettings.disciplinesPerDay,
        plannerSettings.experienceLevel,
      ),
    [activeDisciplines, disciplineProgress, plannerSettings],
  );
  const totalDays = Math.max(
    differenceInCalendarDays(
      parseISO(plannerSettings.examDate),
      parseISO(plannerSettings.planStartDate),
    ) + 1,
    1,
  );
  const daysUntilExam = Math.max(
    differenceInCalendarDays(parseISO(plannerSettings.examDate), parseISO(currentDate)),
    0,
  );
  const dayNumber = getPlanDay(currentDate, {
    startDate: plannerSettings.planStartDate,
    totalDays,
  });
  const cycleDay = getCycleDay(dayNumber, {
    cycleDays: effectiveCycleDays,
    totalDays,
  });
  const cycleNumber = getCycleNumber(dayNumber);
  const phase = getPhase(dayNumber, { totalDays });
  const todayCycle = effectiveCycleDays.find((item) => item.id === cycleDay) ?? {
    id: cycleDay,
    sessions: [],
  };
  const planDays = useMemo(
    () =>
      getPlanDays({
        totalDays,
        startDate: plannerSettings.planStartDate,
        cycleDays: effectiveCycleDays,
      }),
    [effectiveCycleDays, plannerSettings.planStartDate, totalDays],
  );
  const roadmaps = useMemo(
    () => [
      ...disciplineRoadmaps,
      ...customDisciplines.map((discipline) => ({
        title: discipline.shortName || discipline.name,
        disciplineId: discipline.id,
        cycles:
          discipline.topics.length > 0
            ? discipline.topics
            : [`Base de ${discipline.name}`, `Questões de ${discipline.name}`],
      })),
    ],
    [customDisciplines],
  );

  const disciplineMap = Object.fromEntries(
    allDisciplines.map((discipline) => [discipline.id, discipline]),
  );

  const completedDays = Object.values(trackerEntries).filter(
    (entry) => entry.cycleCompleted,
  ).length;
  const totalHours = Object.values(trackerEntries).reduce(
    (total, entry) => total + parseHours(entry.hoursInvested),
    0,
  );
  const currentTrackerEntry = trackerEntries[dayNumber];
  const selectedTopicsByDiscipline = Object.fromEntries(
    allDisciplines.map((discipline) => {
      const roadmap = roadmaps.find((item) => item.disciplineId === discipline.id);

      return [
        discipline.id,
        getSuggestedTopic(roadmap?.cycles ?? [], disciplineProgress[discipline.id]),
      ];
    }),
  );
  const reviewStrategiesByDiscipline = Object.fromEntries(
    allDisciplines.map((discipline) => {
      const progress = getSafeDisciplineProgress(discipline.id, disciplineProgress);

      return [
        discipline.id,
        getReviewStrategy(discipline, progress.masteryLevel),
      ];
    }),
  );
  const recommendedSessionMinutes = Math.max(
    Math.round((plannerSettings.dailyStudyHours * 60) / plannerSettings.disciplinesPerDay),
    25,
  );
  const learningProfileSummary =
    plannerSettings.experienceLevel === "iniciante"
      ? "Mais repetição guiada, menos troca brusca de matéria e maior carga de conteúdo estruturado."
      : plannerSettings.experienceLevel === "avancado"
        ? "Mais questões, revisão por provas e rotação enxuta de matérias por bloco."
        : "Equilíbrio entre aquisição, recuperação ativa e correção de erros.";

  useEffect(() => {
    if (!workspace) {
      return;
    }

    updatePlannerSettings({
      userName:
        typeof workspace.metadata?.user_name === "string"
          ? workspace.metadata.user_name
          : plannerSettings.userName,
      examTitle: workspace.title,
      examDate: workspace.exam_date ?? plannerSettings.examDate,
      planStartDate: workspace.plan_start_date,
      dailyStudyHours: Number(workspace.target_daily_hours),
      disciplinesPerDay: workspace.target_disciplines_per_day,
      experienceLevel: workspace.experience_level,
    });

    setActiveDisciplines(workspace.metadata?.active_discipline_ids ?? []);
  }, [
    plannerSettings.examDate,
    plannerSettings.userName,
    setActiveDisciplines,
    updatePlannerSettings,
    workspace,
  ]);

  useEffect(() => {
    setCustomDisciplines(remoteCustomDisciplines);
  }, [remoteCustomDisciplines, setCustomDisciplines]);

  useEffect(() => {
    setDisciplineProgressMap(remoteDisciplineProgress);
  }, [remoteDisciplineProgress, setDisciplineProgressMap]);

  useEffect(() => {
    setTrackerEntries(remoteTrackerEntries);
  }, [remoteTrackerEntries, setTrackerEntries]);

  function handleDisciplineToggle(disciplineId: string) {
    if (activeDisciplineIds.length === 0) {
      setActiveDisciplines(
        allDisciplines
          .map((discipline) => discipline.id)
          .filter((id) => id !== disciplineId),
      );
      return;
    }

    toggleDisciplineActive(disciplineId);
  }

  function handleAddCustomDiscipline() {
    const topics = newDisciplineDraft.topics
      .split("\n")
      .map((item) => item.trim())
      .filter(Boolean);

    if (!newDisciplineDraft.name.trim()) {
      return;
    }

    addCustomDiscipline({
      name: newDisciplineDraft.name,
      shortName: newDisciplineDraft.shortName,
      emoji: newDisciplineDraft.emoji,
      estimatedQuestions: Number(newDisciplineDraft.estimatedQuestions) || 10,
      bankCount: Number(newDisciplineDraft.bankCount) || 0,
      type: newDisciplineDraft.type,
      sessionsPerCycle: Number(newDisciplineDraft.sessionsPerCycle) || 2,
      topics,
    });

    setNewDisciplineDraft({
      name: "",
      shortName: "",
      emoji: "📘",
      estimatedQuestions: "10",
      bankCount: "0",
      type: "mista",
      sessionsPerCycle: "2",
      topics: "",
    });
  }

  function handleRemoveCustomDiscipline(disciplineId: string) {
    removeCustomDiscipline(disciplineId);
  }

  async function handleAuthSubmit() {
    if (!authEmail.trim()) {
      setAuthMessage("Informe um e-mail válido.");
      return;
    }

    if (authMode !== "reset" && !authPassword.trim()) {
      setAuthMessage("Informe a senha.");
      return;
    }

    if (authMode === "login") {
      const { error: signInError } = await signInWithPassword(
        authEmail.trim(),
        authPassword,
      );

      setAuthMessage(
        signInError ? formatAuthErrorMessage(signInError.message, "login") : null,
      );
      return;
    }

    if (authMode === "signup") {
      const { error: signUpError } = await signUpWithPassword(
        authEmail.trim(),
        authPassword,
      );

      setAuthMessage(
        signUpError
          ? formatAuthErrorMessage(signUpError.message, "signup")
          : "Conta criada. Verifique seu e-mail para confirmar o cadastro antes de entrar.",
      );
      return;
    }

    const { error: resetError } = await resetPassword(authEmail.trim());

    setAuthMessage(
      resetError
        ? formatAuthErrorMessage(resetError.message, "reset")
        : "Se existir uma conta com este e-mail, enviamos o link de recuperação.",
    );
  }

  async function handleSaveWorkspace() {
    await saveWorkspace(
      plannerSettings,
      resolvedActiveIds,
      customDisciplines,
      allDisciplines,
      disciplineProgress,
      trackerEntries,
    );
  }

  async function handlePasswordReset() {
    if (!session?.user.email) {
      setAuthMessage("Não foi possível identificar o e-mail da conta.");
      return;
    }

    const { error: resetError } = await resetPassword(session.user.email);

    setAuthMessage(
      resetError
        ? formatAuthErrorMessage(resetError.message, "reset")
        : "Enviamos um link para troca de senha no seu e-mail.",
    );
  }

  if (isSupabaseConfigured && authLoading) {
    return (
      <AppShell>
        <Card className="mx-auto mt-10 max-w-xl">
          <p className="text-sm text-slate-500">Conectando sua conta...</p>
        </Card>
      </AppShell>
    );
  }

  if (isSupabaseConfigured && !session) {
    return (
      <AppShell>
        <div className="mx-auto mt-10 max-w-xl space-y-5">
          <Card className="overflow-hidden border-0 bg-[linear-gradient(135deg,#020617,#0f172a_55%,#1d4ed8)] p-0 text-white shadow-xl">
            <div className="space-y-4 px-6 py-6">
              <div className="flex items-center gap-3">
                <div className="rounded-2xl bg-white/10 p-3">
                  <UserRound className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-200">
                    Acesso
                  </p>
                  <h1 className="text-2xl font-black">Entre na sua conta</h1>
                </div>
              </div>
              <p className="text-sm leading-6 text-slate-200">
                Acesse seu concurso, suas disciplinas e seu cronograma pessoal.
              </p>
              <div className="rounded-2xl border border-white/10 bg-white/8 px-4 py-3 text-sm leading-6 text-slate-200">
                Se você acabou de criar a conta, confirme o e-mail antes de tentar entrar.
              </div>

              <div className="flex flex-wrap gap-2">
                {[
                  ["login", "Entrar"],
                  ["signup", "Criar conta"],
                  ["reset", "Recuperar senha"],
                ].map(([mode, label]) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => {
                      setAuthMode(mode as "login" | "signup" | "reset");
                      setAuthMessage(null);
                    }}
                    className={cn(
                      "rounded-full px-3 py-2 text-sm font-semibold transition",
                      authMode === mode
                        ? "bg-white text-slate-950"
                        : "bg-white/10 text-white hover:bg-white/20",
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>

              <label className="block text-sm text-slate-200">
                E-mail
                <input
                  type="email"
                  value={authEmail}
                  onChange={(event) => setAuthEmail(event.target.value)}
                  className="mt-2 w-full rounded-2xl border border-white/15 bg-slate-950/40 px-4 py-3 text-white outline-none"
                  placeholder="voce@exemplo.com"
                />
              </label>
              {authMode !== "reset" && (
                <label className="block text-sm text-slate-200">
                  Senha
                  <input
                    type="password"
                    value={authPassword}
                    onChange={(event) => setAuthPassword(event.target.value)}
                    className="mt-2 w-full rounded-2xl border border-white/15 bg-slate-950/40 px-4 py-3 text-white outline-none"
                    placeholder="Sua senha"
                  />
                </label>
              )}
              <button
                type="button"
                onClick={handleAuthSubmit}
                className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-slate-950"
              >
                <Mail className="h-4 w-4" />
                {authMode === "login"
                  ? "Entrar"
                  : authMode === "signup"
                    ? "Criar conta"
                    : "Enviar recuperação"}
              </button>
            </div>
          </Card>

          {authMessage && (
            <Alert tone={authMessage.toLowerCase().includes("erro") ? "warning" : "success"}>
              {authMessage}
            </Alert>
          )}
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="space-y-5 pb-8">
        <Card className="sticky top-3 z-20 overflow-hidden border-0 bg-[linear-gradient(135deg,rgba(2,6,23,0.96),rgba(15,23,42,0.94)_58%,rgba(8,47,73,0.92))] p-3 text-white shadow-[0_18px_55px_rgba(15,23,42,0.22)] backdrop-blur">
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-2 xl:flex-row xl:items-center xl:justify-between">
              <div className="flex flex-1 gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {views.map((view) => {
                  const Icon = view.icon;
                  return (
                    <button
                      key={view.key}
                      onClick={() => setActiveView(view.key)}
                      className={cn(
                        "flex min-w-[132px] shrink-0 items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold transition",
                        activeView === view.key
                          ? "bg-white text-slate-950 shadow-sm"
                          : "bg-white/8 text-slate-200 hover:bg-white/14",
                      )}
                    >
                      <Icon className="h-4 w-4" />
                      {view.label}
                    </button>
                  );
                })}
              </div>

              <button
                type="button"
                onClick={() => setActiveView("perfil")}
                className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/8 px-4 py-3 text-left text-white transition hover:bg-white/14 xl:min-w-[280px]"
              >
                <div className="rounded-2xl bg-white/14 p-2 text-white">
                  <UserRound className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-white">
                    {plannerSettings.userName}
                  </p>
                  <p className="truncate text-xs text-slate-300">
                    {session?.user.email ?? "Abra o perfil para gerenciar sua conta"}
                  </p>
                </div>
                <ChevronRight className="ml-auto h-4 w-4 text-slate-300" />
              </button>
            </div>

            <div className="flex flex-wrap gap-2 text-sm text-slate-300">
              <span className="rounded-full bg-white/8 px-3 py-1.5">
                {plannerSettings.examTitle}
              </span>
              <span className="rounded-full bg-white/8 px-3 py-1.5">
                {plannerSettings.dailyStudyHours}h/dia
              </span>
              <span className="rounded-full bg-white/8 px-3 py-1.5">
                {plannerSettings.disciplinesPerDay} disciplina(s)/dia
              </span>
            </div>
          </div>
        </Card>

        <Card className="overflow-hidden border-0 bg-[radial-gradient(circle_at_top_left,_rgba(34,211,238,0.22),_transparent_35%),linear-gradient(135deg,#020617,#0f172a_45%,#164e63)] p-0 text-white shadow-xl">
          <div className="grid gap-5 px-5 py-5 lg:grid-cols-[1.4fr_0.8fr] lg:px-6">
            <div className="space-y-4">
              <div className="flex flex-wrap gap-2">
                <Badge className="bg-white/10 text-white">{plannerSettings.examTitle}</Badge>
                <Badge className="bg-white/10 text-white">
                  {plannerSettings.planStartDate} → {plannerSettings.examDate}
                </Badge>
                <Badge className="bg-white/10 text-white">
                  {activeDisciplines.length} disciplina(s) ativa(s)
                </Badge>
              </div>

              <div>
                <h1 className="max-w-3xl text-3xl font-black tracking-tight md:text-4xl">
                  Plano flexível com cronograma inteligente, revisão adaptativa e foco diário
                </h1>
                <p className="mt-3 max-w-3xl text-sm text-slate-200 md:text-base">
                  Você informa horas por dia, quantas matérias quer rodar, seu nível e o
                  estágio de cada disciplina. O sistema redistribui o ciclo para priorizar
                  conteúdo novo, consolidação ou revisão por provas.
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <HeroMetric label="Dias concluídos" value={`${completedDays}/${totalDays}`} />
                <HeroMetric label="Horas registradas" value={`${totalHours.toFixed(1)}h`} />
                <HeroMetric label="Dias até a prova" value={`${daysUntilExam}`} />
              </div>
            </div>

            <div className="rounded-3xl border border-white/10 bg-white/6 p-4 backdrop-blur-sm">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-200">
                Controle rápido
              </p>
              <label className="mt-4 block text-sm text-slate-200">Data do plano</label>
              <input
                type="date"
                value={currentDate}
                onChange={(event) => setCurrentDate(event.target.value)}
                className="mt-2 w-full rounded-2xl border border-white/15 bg-slate-950/40 px-4 py-3 text-white outline-none"
              />
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <QuickPill title="Ciclo atual" value={`#${cycleNumber}`} />
                <QuickPill title="Dia do ciclo" value={cycleDay} />
                <QuickPill title="Fase" value={phase.name.replace("Fase ", "")} />
                <QuickPill title="Sessão média" value={`${recommendedSessionMinutes} min`} />
              </div>
            </div>
          </div>
        </Card>

        {error && (
          <Alert tone="warning">
            Catálogo online indisponível. O app voltou para os dados locais. Motivo: {error}
          </Alert>
        )}

        {!error && source === "supabase" && (
          <Alert tone="success">Catálogo online carregado.</Alert>
        )}

        {workspaceError && <Alert tone="warning">{workspaceError}</Alert>}

        {activeView === "overview" && (
          <div className="space-y-5">
            <Card className="border-slate-200/80 bg-white/85 p-4">
              <div className="flex flex-wrap items-center gap-3">
                <Badge className="bg-slate-900 text-white">Processo do dia</Badge>
                <p className="text-sm text-slate-600">
                  Aqui ficam seu progresso, suas sessões de hoje e os ciclos do plano.
                </p>
              </div>
            </Card>

            <StatsCards
              dayNumber={dayNumber}
              cycleDay={cycleDay}
              completedCount={completedSessions.length}
              totalToday={todayCycle.sessions.length}
            />

            <div className="grid gap-5 xl:grid-cols-[1.15fr_0.85fr]">
              <TodaySessions
                disciplines={allDisciplines}
                sessionIds={todayCycle.sessions}
                completedSessions={completedSessions}
                selectedTopics={selectedTopicsByDiscipline}
                reviewStrategies={reviewStrategiesByDiscipline}
                onToggle={toggleSession}
              />

              <Card className="space-y-4">
                <SectionHeader
                  title="Resumo do plano"
                  subtitle="Leitura rápida do dia atual e da execução registrada."
                  icon={Target}
                />

                <div className="grid gap-3 sm:grid-cols-2">
                  <MiniStat label="Dias concluídos" value={`${completedDays}/${totalDays}`} tone="emerald" />
                  <MiniStat label="Horas registradas" value={`${totalHours.toFixed(1)}h`} tone="cyan" />
                  <MiniStat label="Fase atual" value={phase.name.replace("Fase ", "")} tone="violet" />
                  <MiniStat label="Margem até a prova" value={`${daysUntilExam} dias`} tone="amber" />
                </div>

                <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-sm font-semibold text-slate-900">Hoje está previsto</p>
                  <div className="mt-3 space-y-2">
                    {todayCycle.sessions.map((sessionId) => (
                      <div
                        key={sessionId}
                        className="rounded-2xl border border-white bg-white px-3 py-3"
                      >
                        <p className="text-sm font-semibold text-slate-900">
                          {disciplineMap[sessionId]?.emoji}{" "}
                          {disciplineMap[sessionId]?.shortName ?? sessionId}
                        </p>
                        <p className="mt-1 text-sm leading-6 text-slate-600">
                          {selectedTopicsByDiscipline[sessionId]}
                        </p>
                        <p className="mt-2 text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">
                          Modelo do bloco
                        </p>
                        <p className="mt-1 text-sm font-semibold text-slate-900">
                          {reviewStrategiesByDiscipline[sessionId]?.label}
                        </p>
                        <p className="mt-1 text-sm leading-6 text-slate-600">
                          {reviewStrategiesByDiscipline[sessionId]?.split}
                        </p>
                      </div>
                    ))}
                  </div>
                  <p className="mt-4 text-sm font-semibold text-slate-900">Observações do dia</p>
                  <p className="mt-2 text-sm leading-6 text-slate-600">
                    {currentTrackerEntry?.observations ||
                      "Nenhuma observação registrada ainda."}
                  </p>
                </div>
              </Card>
            </div>

            <CycleBoard
              currentCycleDay={cycleDay}
              cycleDays={effectiveCycleDays}
              disciplines={allDisciplines}
            />

            <div className="grid gap-4 lg:grid-cols-4">
              {getAdaptivePhases(totalDays).map((phaseItem) => (
                <Card
                  key={phaseItem.id}
                  className={cn(
                    "border shadow-none",
                    phaseStyles[phaseItem.id],
                    phaseItem.id === phase.id && "ring-2 ring-slate-900/10",
                  )}
                >
                  <p className="text-xs font-bold uppercase tracking-[0.2em]">
                    Dias {phaseItem.startDay}–{phaseItem.endDay}
                  </p>
                  <h3 className="mt-2 text-lg font-bold">{phaseItem.name}</h3>
                  <p className="mt-2 text-sm opacity-80">{phaseItem.description}</p>
                </Card>
              ))}
            </div>

            <Card className="space-y-4">
              <SectionHeader
                title="Regras do ciclo"
                subtitle="Para não se perder quando atrasar ou precisar compensar."
                icon={ListChecks}
              />
              <div className="grid gap-3 lg:grid-cols-2">
                {studyRules.map((rule) => (
                  <div
                    key={rule}
                    className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm leading-6 text-slate-700"
                  >
                    {rule}
                  </div>
                ))}
              </div>
            </Card>
          </div>
        )}

        {activeView === "cronograma" && (
          <div className="space-y-5">
            <ResponsiveTableCard
              title={`Cronograma dos ${totalDays} dias`}
              subtitle="Planejamento completo com fase, ciclo, dia do ciclo e disciplinas previstas."
            >
              <table className="min-w-[860px] text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-slate-500">
                    <th className="px-3 py-3">Dia</th>
                    <th className="px-3 py-3">Data</th>
                    <th className="px-3 py-3">Fase</th>
                    <th className="px-3 py-3">Ciclo</th>
                    <th className="px-3 py-3">Dia do ciclo</th>
                    <th className="px-3 py-3">Disciplinas previstas</th>
                  </tr>
                </thead>
                <tbody>
                  {planDays.map((planDay) => (
                    <tr
                      key={planDay.dayNumber}
                      className={cn(
                        "border-b border-slate-100 align-top",
                        planDay.dayNumber === dayNumber && "bg-slate-50",
                      )}
                    >
                      <td className="px-3 py-3 font-semibold text-slate-900">
                        {planDay.dayNumber}
                      </td>
                      <td className="px-3 py-3 text-slate-700">{planDay.date}</td>
                      <td className="px-3 py-3">
                        <span
                          className={cn(
                            "inline-flex rounded-full border px-3 py-1 text-xs font-semibold",
                            phaseStyles[planDay.phase.id],
                          )}
                        >
                          {planDay.phase.name}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-slate-700">#{planDay.cycleNumber}</td>
                      <td className="px-3 py-3 text-slate-700">{planDay.cycleDay}</td>
                      <td className="px-3 py-3 text-slate-700">
                        {planDay.sessions
                          .map((sessionId) => disciplineMap[sessionId]?.shortName ?? sessionId)
                          .join(" • ")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </ResponsiveTableCard>

            <div className="grid gap-5 xl:grid-cols-2">
              <Card className="space-y-4">
                <SectionHeader
                  title="Fase 3 — ciclo modificado"
                  subtitle="Decoreba turbo, mapas mentais e 100% foco em questões."
                  icon={SkipForward}
                />
                <div className="space-y-3">
                  {phase3Cycle.map((day) => (
                    <div
                      key={day.day}
                      className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
                    >
                      <div className="mb-3 flex items-center justify-between">
                        <h3 className="font-bold text-slate-900">Dia {day.day}</h3>
                        <Badge>{day.sessions.length} sessões</Badge>
                      </div>
                      <div className="grid gap-2 sm:grid-cols-2">
                        {day.sessions.map((session) => (
                          <div
                            key={session}
                            className="rounded-xl border border-white bg-white px-3 py-2 text-sm text-slate-700"
                          >
                            {session}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </Card>

              <Card className="space-y-4">
                <SectionHeader
                  title="Reta final — dias 85 a 90"
                  subtitle="Simulados, redação, revisão expressa e descanso."
                  icon={Clock3}
                />
                <div className="space-y-3">
                  {finalStretchDays.map((item) => (
                    <div
                      key={item.dayNumber}
                      className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <h3 className="font-bold text-slate-900">
                          Dia {item.dayNumber} — {item.title}
                        </h3>
                        <Badge className="bg-slate-900 text-white">{item.duration}</Badge>
                      </div>
                      <p className="mt-2 text-sm text-slate-600">{item.detail}</p>
                    </div>
                  ))}
                </div>
              </Card>
            </div>
          </div>
        )}

        {activeView === "tracker" && (
          <ResponsiveTableCard
            title="Tracker diário"
            subtitle="Preencha o que realmente foi estudado, com horas e observações."
          >
            <table className="min-w-[1180px] text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-slate-500">
                  <th className="px-3 py-3">Dia</th>
                  <th className="px-3 py-3">Data</th>
                  <th className="px-3 py-3">Fase</th>
                  <th className="px-3 py-3">Ciclo concluído</th>
                  <th className="px-3 py-3">Disciplinas estudadas</th>
                  <th className="px-3 py-3">Horas investidas</th>
                  <th className="px-3 py-3">Observações</th>
                </tr>
              </thead>
              <tbody>
                {planDays.map((planDay) => {
                  const entry = trackerEntries[planDay.dayNumber];
                  return (
                    <tr
                      key={planDay.dayNumber}
                      className={cn(
                        "border-b border-slate-100 align-top",
                        planDay.dayNumber === dayNumber && "bg-slate-50",
                      )}
                    >
                      <td className="px-3 py-3 font-semibold text-slate-900">
                        {planDay.dayNumber}
                      </td>
                      <td className="px-3 py-3 text-slate-700">{planDay.date}</td>
                      <td className="px-3 py-3">
                        <span
                          className={cn(
                            "inline-flex rounded-full border px-3 py-1 text-xs font-semibold",
                            phaseStyles[planDay.phase.id],
                          )}
                        >
                          {planDay.phase.name.replace("Fase ", "")}
                        </span>
                      </td>
                      <td className="px-3 py-3">
                        <label className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700">
                          <input
                            type="checkbox"
                            checked={entry?.cycleCompleted ?? false}
                            onChange={(event) =>
                              updateTrackerEntry(planDay.dayNumber, {
                                cycleCompleted: event.target.checked,
                              })
                            }
                            className="h-4 w-4"
                          />
                          Concluído
                        </label>
                      </td>
                      <td className="px-3 py-3">
                        <textarea
                          value={entry?.disciplinesStudied ?? ""}
                          onChange={(event) =>
                            updateTrackerEntry(planDay.dayNumber, {
                              disciplinesStudied: event.target.value,
                            })
                          }
                          placeholder={planDay.sessions
                            .map((sessionId) => disciplineMap[sessionId]?.shortName ?? sessionId)
                            .join(", ")}
                          className="min-h-22 w-full min-w-64 rounded-2xl border border-slate-200 px-3 py-2 outline-none"
                        />
                      </td>
                      <td className="px-3 py-3">
                        <input
                          type="text"
                          inputMode="decimal"
                          value={entry?.hoursInvested ?? ""}
                          onChange={(event) =>
                            updateTrackerEntry(planDay.dayNumber, {
                              hoursInvested: event.target.value,
                            })
                          }
                          placeholder="2.5"
                          className="w-24 rounded-2xl border border-slate-200 px-3 py-2 outline-none"
                        />
                      </td>
                      <td className="px-3 py-3">
                        <textarea
                          value={entry?.observations ?? ""}
                          onChange={(event) =>
                            updateTrackerEntry(planDay.dayNumber, {
                              observations: event.target.value,
                            })
                          }
                          placeholder="Erros, dificuldade, revisão pendente..."
                          className="min-h-22 w-full min-w-72 rounded-2xl border border-slate-200 px-3 py-2 outline-none"
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </ResponsiveTableCard>
        )}

        {activeView === "conteudo" && (
          <div className="space-y-5">
            <div className="grid gap-5 2xl:grid-cols-[420px_minmax(0,1fr)]">
              <div className="space-y-5 2xl:sticky 2xl:top-28 2xl:self-start">
                <Card className="space-y-4">
                  <SectionHeader
                    title="Adaptação por disciplina"
                    subtitle="Defina o estágio e o ponto de retomada de cada disciplina ativa."
                    icon={BookOpenCheck}
                  />

                  <div className="space-y-3 max-h-[70vh] overflow-y-auto pr-1">
                    {roadmaps
                      .filter((roadmap) => resolvedActiveIds.includes(roadmap.disciplineId))
                      .map((roadmap) => {
                    const availableTopics = [
                      ...roadmap.cycles,
                      ...((getSafeDisciplineProgress(
                        roadmap.disciplineId,
                        disciplineProgress,
                      ).customTopics ?? []).filter(
                        (topic) => !roadmap.cycles.includes(topic),
                      )),
                    ];
                    const progress = getSafeDisciplineProgress(
                      roadmap.disciplineId,
                      disciplineProgress,
                    );

                    return (
                      <div
                        key={roadmap.disciplineId}
                        className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <h3 className="font-bold text-slate-900">
                              {(disciplineMap[roadmap.disciplineId]?.emoji ?? "📚") + " "}
                              {roadmap.title}
                            </h3>
                            <p className="mt-1 text-sm text-slate-500">
                              Você está no ciclo {progress.currentCycle} dessa disciplina.
                            </p>
                          </div>
                          <Badge className="bg-white text-slate-700">
                            {roadmap.cycles.length} ciclos
                          </Badge>
                        </div>

                        <div className="mt-4 grid gap-3 lg:grid-cols-[160px_minmax(0,1fr)]">
                          <label className="text-sm text-slate-600">
                            Retomar no ciclo
                            <select
                              value={progress.currentCycle}
                              onChange={(event) =>
                                updateDisciplineProgress(roadmap.disciplineId, {
                                  currentCycle: clampCycle(
                                    Number(event.target.value),
                                    roadmap.cycles.length,
                                  ),
                                })
                              }
                              className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 outline-none"
                            >
                              {roadmap.cycles.map((_, index) => (
                                <option key={index + 1} value={index + 1}>
                                  Ciclo {index + 1}
                                </option>
                              ))}
                            </select>
                          </label>

                          <label className="text-sm text-slate-600">
                            Estágio da disciplina
                            <select
                              value={progress.masteryLevel}
                              onChange={(event) =>
                                updateDisciplineProgress(roadmap.disciplineId, {
                                  masteryLevel: event.target.value as
                                    | "nao_estudada"
                                    | "parcial"
                                    | "revisao",
                                })
                              }
                              className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 outline-none"
                            >
                              <option value="nao_estudada">Ainda não estudei direito</option>
                              <option value="parcial">Já vi parte do conteúdo</option>
                              <option value="revisao">Já fechei a matéria e estou revisando</option>
                            </select>
                          </label>

                          <label className="text-sm text-slate-600 lg:col-span-2">
                            Observações da disciplina
                            <input
                              type="text"
                              value={progress.notes}
                              onChange={(event) =>
                                updateDisciplineProgress(roadmap.disciplineId, {
                                  notes: event.target.value,
                                })
                              }
                              placeholder="Ex.: já revisei ciclos 1 e 2 no PDF"
                              className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 outline-none"
                            />
                          </label>
                        </div>

                        <div className="mt-3 grid gap-3">
                          <label className="text-sm text-slate-600">
                            Assunto atual da disciplina
                            <select
                              value={
                                progress.selectedTopic ||
                                availableTopics[progress.currentCycle - 1] ||
                                ""
                              }
                              onChange={(event) =>
                                updateDisciplineProgress(roadmap.disciplineId, {
                                  selectedTopic: event.target.value,
                                })
                              }
                              className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 outline-none"
                            >
                              {availableTopics.map((topic) => (
                                <option key={topic} value={topic}>
                                  {topic}
                                </option>
                              ))}
                            </select>
                          </label>

                          <label className="text-sm text-slate-600">
                            Novo assunto
                            <div className="mt-2 grid gap-2 md:grid-cols-[minmax(0,1fr)_auto]">
                              <input
                                type="text"
                                value={newTopicDrafts[roadmap.disciplineId] ?? ""}
                                onChange={(event) =>
                                  setNewTopicDrafts((state) => ({
                                    ...state,
                                    [roadmap.disciplineId]: event.target.value,
                                  }))
                                }
                                placeholder="Criar assunto personalizado"
                                className="w-full min-w-64 rounded-2xl border border-slate-200 bg-white px-3 py-2 outline-none"
                              />
                              <button
                                type="button"
                                onClick={() => {
                                  const topic = newTopicDrafts[roadmap.disciplineId] ?? "";
                                  addCustomTopic(roadmap.disciplineId, topic);
                                  setNewTopicDrafts((state) => ({
                                    ...state,
                                    [roadmap.disciplineId]: "",
                                  }));
                                }}
                                className="rounded-2xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
                              >
                                Criar
                              </button>
                            </div>
                          </label>
                        </div>

                        <label className="mt-3 inline-flex items-center gap-2 text-sm text-slate-700">
                          <input
                            type="checkbox"
                            checked={progress.skipCompletedTopics}
                            onChange={(event) =>
                              updateDisciplineProgress(roadmap.disciplineId, {
                                skipCompletedTopics: event.target.checked,
                              })
                            }
                            className="h-4 w-4"
                          />
                          Ocultar ciclos já estudados nessa disciplina
                        </label>
                      </div>
                    );
                      })}
                  </div>
                </Card>
              </div>

              <Card className="min-w-0 space-y-4">
                <SectionHeader
                  title="Conteúdo por disciplina"
                  subtitle="Os ciclos passados podem ser marcados como estudados e ocultados."
                  icon={LibraryBig}
                />

                <div className="space-y-4">
                  {roadmaps
                    .filter((roadmap) => resolvedActiveIds.includes(roadmap.disciplineId))
                    .map((roadmap) => {
                    const progress = getSafeDisciplineProgress(
                      roadmap.disciplineId,
                      disciplineProgress,
                    );
                    const discipline = disciplineMap[roadmap.disciplineId];
                    const strategy = getReviewStrategy(
                      discipline ?? {
                        type: "mista",
                        shortName: roadmap.title,
                      },
                      progress.masteryLevel,
                    );
                    const customTopics = progress.customTopics.filter(
                      (topic) => !roadmap.cycles.includes(topic),
                    );
                    const currentTopic =
                      progress.selectedTopic ||
                      roadmap.cycles[progress.currentCycle - 1] ||
                      "Assunto não definido";

                    return (
                      <div
                        key={roadmap.disciplineId}
                        className="rounded-3xl border border-slate-200 bg-white p-4"
                      >
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                          <div>
                            <h3 className="text-lg font-bold text-slate-900">
                              {(discipline?.emoji ?? "📚") + " "}
                              {roadmap.title}
                            </h3>
                            <p className="text-sm text-slate-500">
                              Assunto atual: {currentTopic}
                            </p>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <Badge className="bg-slate-100 text-slate-700">
                              Atual: ciclo {progress.currentCycle}
                            </Badge>
                            <Badge className="bg-indigo-100 text-indigo-800">
                              {strategy.label}
                            </Badge>
                            {progress.skipCompletedTopics && (
                              <Badge className="bg-emerald-100 text-emerald-800">
                                Ocultando estudados
                              </Badge>
                            )}
                            {customTopics.length > 0 && (
                              <Badge className="bg-cyan-100 text-cyan-800">
                                {customTopics.length} customizado(s)
                              </Badge>
                            )}
                          </div>
                        </div>

                        <div className="mt-4 rounded-2xl border border-indigo-100 bg-indigo-50 p-4">
                          <div className="flex items-start gap-3">
                            <div className="rounded-2xl bg-white p-2 text-indigo-700">
                              <Brain className="h-5 w-5" />
                            </div>
                            <div>
                              <p className="text-sm font-semibold text-indigo-950">
                                Modelo de revisão sugerido
                              </p>
                              <p className="mt-1 text-sm font-medium text-indigo-900">
                                {strategy.split}
                              </p>
                              <p className="mt-2 text-sm leading-6 text-indigo-900/85">
                                {strategy.summary}
                              </p>
                            </div>
                          </div>
                        </div>

                        <div className="mt-4 grid gap-3">
                          {roadmap.cycles
                            .map((content, index) => ({
                              cycle: index + 1,
                              content,
                            }))
                            .filter((item) =>
                              progress.skipCompletedTopics
                                ? item.cycle >= progress.currentCycle
                                : true,
                            )
                            .map((item) => {
                              const status =
                                item.cycle < progress.currentCycle
                                  ? "done"
                                  : item.cycle === progress.currentCycle
                                    ? "current"
                                    : "next";

                              return (
                                <div
                                  key={`${roadmap.disciplineId}-${item.cycle}`}
                                  className={cn(
                                    "rounded-2xl border p-4",
                                    status === "done" &&
                                      "border-emerald-200 bg-emerald-50 text-emerald-900",
                                    status === "current" &&
                                      "border-slate-900 bg-slate-900 text-white",
                                    status === "next" &&
                                      "border-slate-200 bg-slate-50 text-slate-800",
                                    item.content === currentTopic &&
                                      "ring-2 ring-cyan-300 ring-offset-1",
                                  )}
                                >
                                  <div className="flex items-center justify-between gap-3">
                                    <div className="flex items-center gap-2">
                                      <span className="text-xs font-bold uppercase tracking-[0.2em]">
                                        Ciclo {item.cycle}
                                      </span>
                                      {status === "current" && (
                                        <Badge className="bg-white/15 text-white">Agora</Badge>
                                      )}
                                      {status === "done" && (
                                        <Badge className="bg-white text-emerald-800">
                                          Já estudado
                                        </Badge>
                                      )}
                                    </div>
                                    {status === "current" && (
                                      <ChevronRight className="h-4 w-4" />
                                    )}
                                  </div>
                                  <p className="mt-2 text-sm leading-6">{item.content}</p>
                                </div>
                              );
                            })}

                          {customTopics.map((topic) => (
                            <div
                              key={`${roadmap.disciplineId}-${topic}`}
                              className={cn(
                                "rounded-2xl border p-4",
                                topic === currentTopic
                                  ? "border-cyan-300 bg-cyan-50 text-cyan-950 ring-2 ring-cyan-300 ring-offset-1"
                                  : "border-slate-200 bg-slate-50 text-slate-800",
                              )}
                            >
                              <div className="flex items-center justify-between gap-3">
                                <div className="flex items-center gap-2">
                                  <span className="text-xs font-bold uppercase tracking-[0.2em]">
                                    Assunto personalizado
                                  </span>
                                  {topic === currentTopic && (
                                    <Badge className="bg-cyan-600 text-white">Agora</Badge>
                                  )}
                                </div>
                              </div>
                              <p className="mt-2 text-sm leading-6">{topic}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                    })}
                </div>
              </Card>
            </div>
          </div>
        )}

        {activeView === "redacao" && (
          <div className="space-y-5">
            <div className="grid gap-5 xl:grid-cols-[0.82fr_1.18fr]">
              <Card className="space-y-4">
                <SectionHeader
                  title="Fórmula semanal"
                  subtitle="Treine 1 redação por semana a partir do ciclo 5."
                  icon={FileText}
                />
                <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-sm text-slate-500">Cálculo sugerido</p>
                  <p className="mt-2 text-2xl font-black text-slate-900">
                    NPD = NC − (6 × NE ÷ TL)
                  </p>
                  <p className="mt-2 text-sm leading-6 text-slate-600">
                    Cada erro gramatical desconta proporcionalmente ao número de linhas escritas.
                  </p>
                </div>
                <div className="grid gap-3">
                  <MiniStat label="Início do treino" value="Ciclo 5" tone="rose" />
                  <MiniStat label="Limite sugerido" value="30 linhas" tone="amber" />
                  <MiniStat label="Meta mínima" value="1 por semana" tone="emerald" />
                </div>
              </Card>

              <Card className="space-y-4">
                <SectionHeader
                  title="10 temas mais prováveis"
                  subtitle="Lista pronta para girar seus treinos."
                  icon={CheckCircle2}
                />
                <div className="grid gap-3">
                  {essayThemes.map((theme, index) => (
                    <div
                      key={theme}
                      className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3"
                    >
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-900 text-sm font-bold text-white">
                        {index + 1}
                      </div>
                      <p className="text-sm leading-6 text-slate-700">{theme}</p>
                    </div>
                  ))}
                </div>
              </Card>
            </div>
          </div>
        )}

        {activeView === "foco" && (
          <div className="space-y-5">
            <PomodoroCard />
            <div className="grid gap-5 xl:grid-cols-[1fr_1fr]">
              <Card className="space-y-4">
                <SectionHeader
                  title="Como usar"
                  subtitle="Modo de execução para quando você só quer sentar e estudar."
                  icon={Clock3}
                />
                <div className="space-y-3 text-sm leading-6 text-slate-700">
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    Escolha um preset de foco, inicie o cronômetro e execute apenas a
                    sessão atual.
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    Ao terminar, marque a sessão como concluída e passe para a próxima
                    matéria do dia.
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    Use essa aba como ambiente limpo, sem excesso de decisão durante o estudo.
                  </div>
                </div>
              </Card>

              <Card className="space-y-4">
                <SectionHeader
                  title="Sessões do dia"
                  subtitle="Resumo direto do que precisa ser feito agora."
                  icon={Target}
                />
                <div className="space-y-3">
                  {todayCycle.sessions.map((sessionId) => (
                    <div
                      key={sessionId}
                      className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
                    >
                      <p className="text-sm font-semibold text-slate-900">
                        {disciplineMap[sessionId]?.emoji}{" "}
                        {disciplineMap[sessionId]?.shortName ?? sessionId}
                      </p>
                      <p className="mt-2 text-sm leading-6 text-slate-600">
                        {selectedTopicsByDiscipline[sessionId]}
                      </p>
                      <p className="mt-2 text-sm font-medium text-slate-900">
                        {reviewStrategiesByDiscipline[sessionId]?.split}
                      </p>
                    </div>
                  ))}
                </div>
              </Card>
            </div>
          </div>
        )}

        {activeView === "perfil" && (
          <div className="space-y-5">
            <div className="grid gap-5 xl:grid-cols-[0.88fr_1.12fr]">
              <Card className="space-y-4">
                <SectionHeader
                  title="Perfil e concurso"
                  subtitle="Conta simplificada no topo, ajustes completos aqui."
                  icon={UserRound}
                />

                <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex items-start gap-4">
                    <div className="rounded-3xl bg-slate-900 p-3 text-white">
                      <UserRound className="h-6 w-6" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <label className="block text-sm text-slate-600">
                        Nome
                        <input
                          type="text"
                          value={plannerSettings.userName}
                          onChange={(event) =>
                            updatePlannerSettings({ userName: event.target.value })
                          }
                          className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 outline-none"
                        />
                      </label>
                      <div className="mt-3 rounded-2xl border border-slate-200 bg-white px-3 py-3">
                        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                          E-mail
                        </p>
                        <p className="mt-1 text-sm text-slate-700">
                          {session?.user.email ?? "Conta local"}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-sm font-semibold text-slate-900">Conta</p>
                  <div className="mt-3 flex flex-wrap gap-3">
                    <button
                      type="button"
                      onClick={handlePasswordReset}
                      className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700"
                    >
                      Trocar senha
                    </button>
                    <button
                      type="button"
                      onClick={() => signOut()}
                      className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700"
                    >
                      <LogOut className="h-4 w-4" />
                      Sair
                    </button>
                  </div>
                </div>

                <div className="space-y-4 rounded-3xl border border-slate-200 bg-white p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">Configuração do concurso</p>
                      <p className="mt-1 text-sm text-slate-600">
                        Defina a prova, o ritmo diário e o nível atual.
                      </p>
                    </div>
                    <Badge className="bg-slate-100 text-slate-700">
                      {plannerSettings.examTitle}
                    </Badge>
                  </div>

                  <div className="grid gap-3 md:grid-cols-2">
                    <label className="text-sm text-slate-600">
                      Concurso
                      <input
                        type="text"
                        value={plannerSettings.examTitle}
                        onChange={(event) =>
                          updatePlannerSettings({ examTitle: event.target.value })
                        }
                        className="mt-2 w-full rounded-2xl border border-slate-200 px-3 py-2 outline-none"
                      />
                    </label>
                    <label className="text-sm text-slate-600">
                      Data da prova
                      <input
                        type="date"
                        value={plannerSettings.examDate}
                        onChange={(event) =>
                          updatePlannerSettings({ examDate: event.target.value })
                        }
                        className="mt-2 w-full rounded-2xl border border-slate-200 px-3 py-2 outline-none"
                      />
                    </label>
                    <label className="text-sm text-slate-600">
                      Início do plano
                      <input
                        type="date"
                        value={plannerSettings.planStartDate}
                        onChange={(event) =>
                          updatePlannerSettings({ planStartDate: event.target.value })
                        }
                        className="mt-2 w-full rounded-2xl border border-slate-200 px-3 py-2 outline-none"
                      />
                    </label>
                    <label className="text-sm text-slate-600">
                      Horas por dia
                      <input
                        type="number"
                        min="1"
                        max="12"
                        value={plannerSettings.dailyStudyHours}
                        onChange={(event) =>
                          updatePlannerSettings({
                            dailyStudyHours: Number(event.target.value) || 1,
                          })
                        }
                        className="mt-2 w-full rounded-2xl border border-slate-200 px-3 py-2 outline-none"
                      />
                    </label>
                    <label className="text-sm text-slate-600">
                      Disciplinas por dia
                      <input
                        type="number"
                        min="1"
                        max="8"
                        value={plannerSettings.disciplinesPerDay}
                        onChange={(event) =>
                          updatePlannerSettings({
                            disciplinesPerDay: Number(event.target.value) || 1,
                          })
                        }
                        className="mt-2 w-full rounded-2xl border border-slate-200 px-3 py-2 outline-none"
                      />
                    </label>
                    <label className="text-sm text-slate-600">
                      Nível atual
                      <select
                        value={plannerSettings.experienceLevel}
                        onChange={(event) =>
                          updatePlannerSettings({
                            experienceLevel: event.target.value as
                              | "iniciante"
                              | "intermediario"
                              | "avancado",
                          })
                        }
                        className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 outline-none"
                      >
                        <option value="iniciante">Iniciante</option>
                        <option value="intermediario">Intermediário</option>
                        <option value="avancado">Avançado</option>
                      </select>
                    </label>
                  </div>

                  <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-sm font-semibold text-slate-900">
                      Lógica aplicada ao seu perfil
                    </p>
                    <p className="mt-2 text-sm leading-6 text-slate-600">
                      {learningProfileSummary}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={handleSaveWorkspace}
                    disabled={!session || workspaceSaving || workspaceLoading}
                    className="inline-flex items-center gap-2 rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <Cloud className="h-4 w-4" />
                    {workspaceSaving ? "Salvando..." : "Salvar na nuvem"}
                  </button>
                </div>
              </Card>

              <Card className="space-y-4">
                <SectionHeader
                  title="Disciplinas do concurso"
                  subtitle="Controle melhor o que entra no plano e remova o que não faz sentido."
                  icon={PlusCircle}
                />
                <div className="space-y-4">
                  <div className="grid gap-3">
                    {allDisciplines.map((discipline) => {
                      const isActive = resolvedActiveIds.includes(discipline.id);
                      const progress = getSafeDisciplineProgress(
                        discipline.id,
                        disciplineProgress,
                      );
                      const canDelete = discipline.source === "custom";

                      return (
                        <div
                          key={discipline.id}
                          className="rounded-3xl border border-slate-200 bg-slate-50 p-4"
                        >
                          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <p className="text-base font-semibold text-slate-900">
                                  {discipline.emoji} {discipline.name}
                                </p>
                                <Badge
                                  className={cn(
                                    isActive
                                      ? "bg-emerald-100 text-emerald-700"
                                      : "bg-slate-200 text-slate-600",
                                  )}
                                >
                                  {isActive ? "Ativa" : "Pausada"}
                                </Badge>
                                <Badge className="bg-white text-slate-600">
                                  {discipline.source === "custom" ? "Personalizada" : "Padrão"}
                                </Badge>
                              </div>
                              <div className="mt-2 flex flex-wrap gap-2 text-sm text-slate-500">
                                <span className="rounded-full bg-white px-3 py-1.5">
                                  {discipline.shortName}
                                </span>
                                <span className="rounded-full bg-white px-3 py-1.5">
                                  {discipline.sessionsPerCycle} sessão(ões)/ciclo
                                </span>
                                <span className="rounded-full bg-white px-3 py-1.5">
                                  estágio: {progress.masteryLevel.replace("_", " ")}
                                </span>
                              </div>
                            </div>

                            <div className="flex flex-wrap gap-2">
                              <button
                                type="button"
                                onClick={() => handleDisciplineToggle(discipline.id)}
                                className={cn(
                                  "rounded-2xl px-4 py-2 text-sm font-semibold transition",
                                  isActive
                                    ? "bg-slate-900 text-white"
                                    : "border border-slate-200 bg-white text-slate-700",
                                )}
                              >
                                {isActive ? "Pausar" : "Ativar"}
                              </button>
                              {canDelete && (
                                <button
                                  type="button"
                                  onClick={() => handleRemoveCustomDiscipline(discipline.id)}
                                  className="inline-flex items-center gap-2 rounded-2xl border border-rose-200 bg-white px-4 py-2 text-sm font-semibold text-rose-600"
                                >
                                  <Trash2 className="h-4 w-4" />
                                  Excluir
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div className="space-y-4 rounded-3xl border border-dashed border-slate-300 bg-white p-4">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">
                        Adicionar disciplina personalizada
                      </p>
                      <p className="mt-1 text-sm text-slate-600">
                        Use isso quando seu concurso tiver matéria fora do catálogo atual.
                      </p>
                    </div>

                    <div className="grid gap-3 md:grid-cols-2">
                      <label className="text-sm text-slate-600">
                        Nome da disciplina
                        <input
                          type="text"
                          value={newDisciplineDraft.name}
                          onChange={(event) =>
                            setNewDisciplineDraft((state) => ({
                              ...state,
                              name: event.target.value,
                            }))
                          }
                          placeholder="Ex.: Direito Civil"
                          className="mt-2 w-full rounded-2xl border border-slate-200 px-3 py-2 outline-none"
                        />
                      </label>
                      <label className="text-sm text-slate-600">
                        Nome curto
                        <input
                          type="text"
                          value={newDisciplineDraft.shortName}
                          onChange={(event) =>
                            setNewDisciplineDraft((state) => ({
                              ...state,
                              shortName: event.target.value,
                            }))
                          }
                          placeholder="Dir. Civil"
                          className="mt-2 w-full rounded-2xl border border-slate-200 px-3 py-2 outline-none"
                        />
                      </label>
                      <label className="text-sm text-slate-600">
                        Emoji
                        <input
                          type="text"
                          value={newDisciplineDraft.emoji}
                          onChange={(event) =>
                            setNewDisciplineDraft((state) => ({
                              ...state,
                              emoji: event.target.value,
                            }))
                          }
                          className="mt-2 w-full rounded-2xl border border-slate-200 px-3 py-2 outline-none"
                        />
                      </label>
                      <label className="text-sm text-slate-600">
                        Questões estimadas
                        <input
                          type="number"
                          min="0"
                          value={newDisciplineDraft.estimatedQuestions}
                          onChange={(event) =>
                            setNewDisciplineDraft((state) => ({
                              ...state,
                              estimatedQuestions: event.target.value,
                            }))
                          }
                          className="mt-2 w-full rounded-2xl border border-slate-200 px-3 py-2 outline-none"
                        />
                      </label>
                      <label className="text-sm text-slate-600">
                        Sessões por ciclo
                        <input
                          type="number"
                          min="1"
                          value={newDisciplineDraft.sessionsPerCycle}
                          onChange={(event) =>
                            setNewDisciplineDraft((state) => ({
                              ...state,
                              sessionsPerCycle: event.target.value,
                            }))
                          }
                          className="mt-2 w-full rounded-2xl border border-slate-200 px-3 py-2 outline-none"
                        />
                      </label>
                      <label className="text-sm text-slate-600 md:col-span-2">
                        Tópicos da disciplina
                        <textarea
                          value={newDisciplineDraft.topics}
                          onChange={(event) =>
                            setNewDisciplineDraft((state) => ({
                              ...state,
                              topics: event.target.value,
                            }))
                          }
                          placeholder="Um tópico por linha"
                          className="mt-2 min-h-28 w-full rounded-2xl border border-slate-200 px-3 py-2 outline-none"
                        />
                      </label>
                    </div>

                    <button
                      type="button"
                      onClick={handleAddCustomDiscipline}
                      className="inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white"
                    >
                      <PlusCircle className="h-4 w-4" />
                      Adicionar disciplina
                    </button>
                  </div>
                </div>
              </Card>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}

function SectionHeader({
  title,
  subtitle,
  icon: Icon,
}: {
  title: string;
  subtitle: string;
  icon: typeof Target;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <h2 className="text-xl font-bold text-slate-900">{title}</h2>
        <p className="mt-1 text-sm text-slate-600">{subtitle}</p>
      </div>
      <div className="rounded-2xl bg-slate-100 p-2 text-slate-500">
        <Icon className="h-5 w-5" />
      </div>
    </div>
  );
}

function ResponsiveTableCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <Card className="overflow-hidden">
      <SectionHeader title={title} subtitle={subtitle} icon={CalendarDays} />
      <div className="mt-4 overflow-x-auto">{children}</div>
    </Card>
  );
}

function Alert({
  children,
  tone,
}: {
  children: React.ReactNode;
  tone: "warning" | "success";
}) {
  return (
    <div
      className={cn(
        "rounded-2xl border px-4 py-3 text-sm",
        tone === "warning" &&
          "border-amber-200 bg-amber-50 text-amber-900",
        tone === "success" &&
          "border-emerald-200 bg-emerald-50 text-emerald-900",
      )}
    >
      {children}
    </div>
  );
}

function HeroMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/6 px-4 py-3">
      <p className="text-xs uppercase tracking-[0.2em] text-slate-300">{label}</p>
      <p className="mt-2 text-2xl font-black">{value}</p>
    </div>
  );
}

function QuickPill({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-2xl bg-white/6 p-3">
      <p className="text-xs uppercase tracking-[0.18em] text-slate-300">{title}</p>
      <p className="mt-1 text-lg font-bold text-white">{value}</p>
    </div>
  );
}

function MiniStat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "emerald" | "cyan" | "violet" | "amber" | "rose";
}) {
  const toneStyles = {
    emerald: "bg-emerald-50 text-emerald-900 border-emerald-200",
    cyan: "bg-cyan-50 text-cyan-900 border-cyan-200",
    violet: "bg-violet-50 text-violet-900 border-violet-200",
    amber: "bg-amber-50 text-amber-900 border-amber-200",
    rose: "bg-rose-50 text-rose-900 border-rose-200",
  };

  const Icon =
    tone === "rose"
      ? FileText
      : tone === "amber"
        ? Clock3
        : tone === "emerald"
          ? CheckCircle2
          : Target;

  return (
    <div className={cn("rounded-2xl border p-4", toneStyles[tone])}>
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-medium">{label}</p>
        <Icon className="h-4 w-4 opacity-70" />
      </div>
      <p className="mt-2 text-2xl font-black">{value}</p>
    </div>
  );
}
