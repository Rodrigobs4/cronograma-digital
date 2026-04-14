import { useEffect, useState, type ReactNode } from "react";
import { format, parseISO, startOfWeek } from "date-fns";
import {
  ArrowUpRight,
  BarChart3,
  BookOpenCheck,
  Brain,
  CalendarRange,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Clock3,
  Eye,
  FileText,
  Layers3,
  ListTree,
  Download,
  PauseCircle,
  PlayCircle,
  Plus,
  Printer,
  RotateCcw,
  Sparkles,
  Star,
  Target,
  Trash2,
  UserRound,
} from "lucide-react";
import { AppShell } from "./components/layout/AppShell";
import { Header } from "./components/dashboard/Header";
import { isSupabaseConfigured } from "./lib/supabase";
import { StatsCards } from "./components/dashboard/StatsCards";
import { TodaySessions } from "./components/dashboard/TodaySessions";
import { CycleBoard } from "./components/cycle/CycleBoard";
import { Card } from "./components/ui/Card";
import { Badge } from "./components/ui/Badge";
import { LoginPage } from "./data/LoginPage";
import { cycleDays } from "./data/cycleDays";
import {
  generateWeeklySchedule,
  type StudyDifficulty,
  type StudySubjectInput,
  type WeeklyAvailability,
} from "./lib/studyflowEngine";
import { getPhase } from "./lib/plan";
import { useAuthSession } from "./hooks/useAuthSession";
import { useStudyflowAnalytics } from "./hooks/useStudyflowAnalytics";
import { useStudyflowBootstrap } from "./hooks/useStudyflowBootstrap";
import { useStudyflowNoticeImport } from "./hooks/useStudyflowNoticeImport";
import { useStudyflowNotices } from "./hooks/useStudyflowNotices";
import { useStudyflowPlanMetrics } from "./hooks/useStudyflowPlanMetrics";
import { useStudyflowReviews } from "./hooks/useStudyflowReviews";
import { useStudyflowQuestionReviews } from "./hooks/useStudyflowQuestionReviews";
import { useStudyflowErrorNotebook } from "./hooks/useStudyflowErrorNotebook";
import { useStudyflowSchedule } from "./hooks/useStudyflowSchedule";
import { useStudyflowSessions } from "./hooks/useStudyflowSessions";
import { useStudyflowSubjects } from "./hooks/useStudyflowSubjects";
import { usePlanStore } from "./store/usePlanStore";
import type { Discipline } from "./types";

type StudyFlowView =
  | "dashboard"
  | "plano"
  | "sessao"
  | "revisoes"
  | "estatisticas"
  | "perfil";

type PlanSubView = "visao" | "disciplinas" | "cronograma";
type ReviewSubView = "questoes" | "caderno" | "teoria";

const studyflowViews: Array<{
  key: StudyFlowView;
  label: string;
  icon: typeof BarChart3;
}> = [
  { key: "dashboard", label: "Dashboard", icon: BarChart3 },
  { key: "plano", label: "Plano", icon: CalendarRange },
  { key: "sessao", label: "Sessão", icon: Clock3 },
  { key: "revisoes", label: "Revisões", icon: Brain },
  { key: "estatisticas", label: "Estatísticas", icon: Layers3 },
  { key: "perfil", label: "Perfil", icon: UserRound },
];

const planSubViews: Array<{ key: PlanSubView; label: string; description: string }> = [
  { key: "cronograma", label: "Grade", description: "Controle dos blocos" },
  { key: "disciplinas", label: "Conteúdo", description: "Matérias e tópicos" },
  { key: "visao", label: "Resumo", description: "Direção do plano" },
];

interface AppReviewQueueItem {
  itemId: string;
  nextReviewAt: string;
  nextStep: number;
  priorityScore: number;
  subjectId?: string | null;
  topicId?: string | null;
  subjectName: string;
  topicTitle: string | null;
}

const buttonSlim =
  "inline-flex h-9 items-center justify-center rounded-xl px-3.5 text-xs font-bold tracking-[-0.01em] transition disabled:cursor-not-allowed disabled:opacity-50";
const buttonPrimary = `${buttonSlim} bg-slate-950 text-white shadow-sm shadow-slate-200 hover:bg-slate-800`;
const buttonSecondary = `${buttonSlim} border border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50`;
const buttonDanger = `${buttonSlim} border border-rose-200 bg-white text-rose-700 hover:bg-rose-50`;
const buttonDarkGhost = `${buttonSlim} border border-white/10 bg-white/8 text-white hover:bg-white/12`;

function getTodayISODate() {
  return new Date().toISOString().slice(0, 10);
}

function isValidISODate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  return !Number.isNaN(new Date(`${value}T12:00:00`).getTime());
}

function normalizeISODate(value: unknown, fallback = getTodayISODate()) {
  return isValidISODate(value) ? value : fallback;
}

function getWeekStartISODate(value: unknown) {
  const safeDate = normalizeISODate(value);
  return format(startOfWeek(parseISO(safeDate), { weekStartsOn: 1 }), "yyyy-MM-dd");
}

function formatTimer(totalSeconds: number) {
  const safeSeconds = Math.max(0, totalSeconds);
  const minutes = Math.floor(safeSeconds / 60);
  const seconds = safeSeconds % 60;

  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function getNotebookEntryTypeLabel(value: string) {
  if (value === "rule") return "Regra";
  if (value === "insight") return "Insight";
  if (value === "trap") return "Pegadinha";
  if (value === "commentary") return "Comentário";
  return "Erro";
}

function getNotebookSourceKindLabel(value: string) {
  if (value === "question") return "Questão";
  if (value === "class") return "Aula";
  if (value === "teacher_comment") return "Professor";
  if (value === "book") return "Material";
  if (value === "mock_exam") return "Simulado";
  return "Manual";
}

function buildErrorNotebookPrintableHtml(input: {
  entries: Array<{
    entry_type: string;
    source_kind: string;
    source_label: string | null;
    title: string;
    entry_status: string;
    error_count: number;
    user_error_reason: string | null;
    correct_reason: string | null;
    avoidance_note: string | null;
    teacher_comment: string | null;
    review_note: string | null;
    subject_id: string | null;
    topic_id: string | null;
  }>;
  subjects: Array<{ id: string; name: string }>;
  topics: Array<{ id: string; title: string }>;
}) {
  const groups = Object.values(
    input.entries.reduce<
      Record<
        string,
        {
          subjectName: string;
          items: Array<{
            topicTitle: string;
            entryTypeLabel: string;
            sourceKindLabel: string;
            sourceLabel: string | null;
            title: string;
            entryStatus: string;
            errorCount: number;
            userErrorReason: string | null;
            correctReason: string | null;
            avoidanceNote: string | null;
            teacherComment: string | null;
            reviewNote: string | null;
          }>;
        }
      >
    >((accumulator, entry) => {
      const subjectName =
        input.subjects.find((subject) => subject.id === entry.subject_id)?.name ??
        "Sem disciplina";
      const topicTitle =
        input.topics.find((topic) => topic.id === entry.topic_id)?.title ?? "Anotação geral";
      const key = entry.subject_id ?? "__unlinked__";

      if (!accumulator[key]) {
        accumulator[key] = {
          subjectName,
          items: [],
        };
      }

      accumulator[key].items.push({
        topicTitle,
        entryTypeLabel: getNotebookEntryTypeLabel(entry.entry_type),
        sourceKindLabel: getNotebookSourceKindLabel(entry.source_kind),
        sourceLabel: entry.source_label,
        title: entry.title,
        entryStatus: entry.entry_status,
        errorCount: entry.error_count,
        userErrorReason: entry.user_error_reason,
        correctReason: entry.correct_reason,
        avoidanceNote: entry.avoidance_note,
        teacherComment: entry.teacher_comment,
        reviewNote: entry.review_note,
      });

      return accumulator;
    }, {}),
  ).sort((left, right) => left.subjectName.localeCompare(right.subjectName, "pt-BR"));

  const totalEntries = input.entries.length;
  const favoriteStyleNote = totalEntries === 1 ? "1 ficha" : `${totalEntries} fichas`;
  const printableGroups = groups
    .map((group) => {
      const cards = group.items
        .sort((left, right) => left.topicTitle.localeCompare(right.topicTitle, "pt-BR"))
        .map(
          (item) => `
            <article class="card">
              <div class="card-header">
                <div>
                  <h3>${escapeHtml(item.title)}</h3>
                  <p class="meta">${escapeHtml(item.topicTitle)} • ${escapeHtml(item.entryTypeLabel)} • ${escapeHtml(item.sourceKindLabel)} • status ${escapeHtml(item.entryStatus)}</p>
                </div>
                <span class="count">${item.errorCount} ocorrência(s)</span>
              </div>
              ${item.sourceLabel ? `<p class="reference"><strong>Referência:</strong> ${escapeHtml(item.sourceLabel)}</p>` : ""}
              <div class="grid">
                <section>
                  <h4>Onde errei</h4>
                  <p>${escapeHtml(item.userErrorReason ?? "-")}</p>
                </section>
                <section>
                  <h4>Regra correta</h4>
                  <p>${escapeHtml(item.correctReason ?? "-")}</p>
                </section>
                <section>
                  <h4>Como evitar</h4>
                  <p>${escapeHtml(item.avoidanceNote ?? "-")}</p>
                </section>
                <section>
                  <h4>Comentário do professor</h4>
                  <p>${escapeHtml(item.teacherComment ?? "-")}</p>
                </section>
              </div>
              <section class="review-note">
                <h4>Resumo de revisão</h4>
                <p>${escapeHtml(item.reviewNote ?? "-")}</p>
              </section>
            </article>
          `,
        )
        .join("");

      return `
        <section class="subject-group">
          <div class="subject-header">
            <h2>${escapeHtml(group.subjectName)}</h2>
            <span>${group.items.length} ficha(s)</span>
          </div>
          ${cards}
        </section>
      `;
    })
    .join("");

  return `
    <html>
      <head>
        <title>Caderno de revisão - StudyFlow</title>
        <style>
          @page { margin: 16mm; size: A4; }
          * { box-sizing: border-box; }
          body { font-family: Arial, sans-serif; margin: 0; color: #0f172a; background: #f8fafc; }
          .page { max-width: 980px; margin: 0 auto; padding: 24px; }
          .hero { border: 1px solid #dbe1ea; border-radius: 18px; padding: 20px 22px; background: linear-gradient(135deg, #ffffff 0%, #eef6ff 100%); }
          .hero h1 { margin: 0; font-size: 28px; }
          .hero p { margin: 8px 0 0; color: #475569; line-height: 1.5; }
          .summary { display: flex; gap: 12px; flex-wrap: wrap; margin-top: 14px; }
          .summary-chip { border-radius: 999px; background: #e2e8f0; color: #0f172a; font-size: 12px; font-weight: 700; padding: 7px 12px; }
          .subject-group { margin-top: 18px; }
          .subject-header { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 10px; padding-bottom: 6px; border-bottom: 2px solid #cbd5e1; }
          .subject-header h2 { margin: 0; font-size: 20px; }
          .subject-header span { font-size: 12px; font-weight: 700; color: #475569; background: #e2e8f0; border-radius: 999px; padding: 6px 10px; }
          .card { break-inside: avoid; page-break-inside: avoid; border: 1px solid #dbe1ea; border-radius: 16px; background: #ffffff; padding: 16px; margin-bottom: 12px; }
          .card-header { display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; }
          .card-header h3 { margin: 0; font-size: 16px; }
          .meta { margin: 6px 0 0; color: #475569; font-size: 12px; line-height: 1.4; }
          .count { white-space: nowrap; border-radius: 999px; background: #fef3c7; color: #92400e; font-size: 12px; font-weight: 700; padding: 6px 10px; }
          .reference { margin: 12px 0 0; font-size: 13px; color: #334155; }
          .grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; margin-top: 12px; }
          .grid section, .review-note { border-radius: 12px; padding: 12px; }
          .grid section:nth-child(1) { background: #fff1f2; }
          .grid section:nth-child(2) { background: #ecfdf5; }
          .grid section:nth-child(3) { background: #fffbeb; }
          .grid section:nth-child(4) { background: #eff6ff; }
          .review-note { margin-top: 10px; background: #f1f5f9; }
          h4 { margin: 0 0 6px; font-size: 11px; text-transform: uppercase; letter-spacing: 0.08em; }
          section p { margin: 0; line-height: 1.5; font-size: 13px; }
          @media print {
            body { background: #ffffff; }
            .page { padding: 0; }
          }
          @media (max-width: 700px) {
            .grid { grid-template-columns: 1fr; }
          }
        </style>
      </head>
      <body>
        <main class="page">
          <header class="hero">
            <h1>Caderno de revisão</h1>
            <p>Resumo organizado por disciplina e assunto para revisão rápida, impressão e estudo ativo.</p>
            <div class="summary">
              <span class="summary-chip">${favoriteStyleNote}</span>
              <span class="summary-chip">${groups.length} disciplina(s)</span>
              <span class="summary-chip">Gerado em ${new Date().toLocaleString("pt-BR")}</span>
            </div>
          </header>
          ${printableGroups}
        </main>
      </body>
    </html>
  `;
}

export default function App() {
  const {
    currentDate,
    setCurrentDate,
    plannerSettings,
    updatePlannerSettings,
  } = usePlanStore();
  const safeCurrentDate = normalizeISODate(currentDate);
  const safePlanStartDate = normalizeISODate(
    plannerSettings?.planStartDate,
    safeCurrentDate,
  );
  const { session, loading: authLoading, signInWithPassword, signUpWithPassword, resetPassword, signOut } =
    useAuthSession();
  const {
    profile,
    workspace,
    plan,
    loading: bootstrapLoading,
    saving: bootstrapSaving,
    error: bootstrapError,
    saveProfileAndPlan,
  } = useStudyflowBootstrap(session?.user.id, session?.user.email);
  const {
    notices,
    loading: noticesLoading,
    saving: noticesSaving,
    error: noticesError,
    createManualNotice,
    removeNotice,
    reload: reloadNotices,
  } = useStudyflowNotices(workspace?.id, plan?.id);
  const {
    saving: importSaving,
    error: importError,
    importStructuredNotice,
  } = useStudyflowNoticeImport();
  const {
    subjects,
    topics,
    loading: subjectsLoading,
    saving: subjectsSaving,
    error: subjectsError,
    addSubject,
    updateSubject,
    removeSubject,
    addTopic,
    updateTopic,
    removeTopic,
    reload: reloadSubjects,
  } = useStudyflowSubjects(plan?.id);
  const {
    weeklyPlan,
    items: scheduledItems,
    loading: scheduleLoading,
    saving: scheduleSaving,
    error: scheduleError,
    regenerateSchedule,
    skipItem,
    moveItem,
    updateItemPosition,
    reorderItem,
    updateItemStatus,
    createItem,
    updateItem,
    deleteItem,
    reload: reloadSchedule,
  } = useStudyflowSchedule(
    plan?.id,
    getWeekStartISODate(safeCurrentDate),
  );
  const {
    reviewItems,
    loading: reviewsLoading,
    saving: reviewsSaving,
    error: reviewsError,
    syncReviewForSession,
    completeReview,
    removeReview,
    reload: reloadReviews,
  } = useStudyflowReviews(plan?.id, plan?.review_method_code);
  const {
    tasks: questionReviewTasks,
    loading: questionReviewLoading,
    saving: questionReviewSaving,
    error: questionReviewError,
    syncQuestionReviewForSession,
    completeQuestionReview,
    removeQuestionReviewTask,
    reload: reloadQuestionReviews,
  } = useStudyflowQuestionReviews(plan?.id);
  const {
    entries: errorNotebookEntries,
    loading: errorNotebookLoading,
    saving: errorNotebookSaving,
    error: errorNotebookError,
    createEntry: createErrorNotebookEntry,
    updateEntry: updateErrorNotebookEntry,
    removeEntry: removeErrorNotebookEntry,
    reload: reloadErrorNotebook,
  } = useStudyflowErrorNotebook(plan?.id);
  const {
    sessions: todaySessions,
    loading: sessionsLoading,
    saving: sessionsSaving,
    error: sessionsError,
    completePlannedSession,
    reopenPlannedSession,
  } = useStudyflowSessions(plan?.id, safeCurrentDate);
  const {
    dashboard,
    difficultyMaps,
    loading: analyticsLoading,
    saving: analyticsSaving,
    error: analyticsError,
    syncSessionAnalytics,
    syncReviewAnalytics,
  } = useStudyflowAnalytics(plan?.id);
  const { sessions: metricSessions } = useStudyflowPlanMetrics(plan?.id);
  const [activeView, setActiveView] = useState<StudyFlowView>("dashboard");
  const [activePlanView, setActivePlanView] = useState<PlanSubView>("cronograma");
  const [activeReviewView, setActiveReviewView] = useState<ReviewSubView>("questoes");
  const [authError, setAuthError] = useState<string | null>(null);
  const [authMessage, setAuthMessage] = useState<string | null>(null);
  const [newSubjectName, setNewSubjectName] = useState("");
  const [newSubjectDifficulty, setNewSubjectDifficulty] =
    useState<StudyDifficulty>("medium");
  const [newSubjectPriority, setNewSubjectPriority] = useState(1);
  const [newSubjectTargetMinutes, setNewSubjectTargetMinutes] = useState(180);
  const [topicDrafts, setTopicDrafts] = useState<Record<string, string>>({});
  const [expandedSubjectIds, setExpandedSubjectIds] = useState<string[]>([]);
  const [newBlockForm, setNewBlockForm] = useState({
    studyDate: "",
    subjectId: "",
    topicId: "",
    plannedMinutes: 50,
    taskType: "study" as "study" | "review" | "questions" | "essay" | "simulado",
  });
  const [noticeForm, setNoticeForm] = useState({
    title: "",
    organization: "",
    examDate: "",
    fileUrl: "",
    rawText: "",
  });
  const [sessionForm, setSessionForm] = useState({
    netMinutes: "",
    pagesRead: "",
    lessonsWatched: "",
    questionsAnswered: "",
    questionsCorrect: "",
    questionsWrong: "",
    notes: "",
  });
  const [questionReviewDrafts, setQuestionReviewDrafts] = useState<
    Record<string, { answered: string; correct: string }>
  >({});
  const [expandedNotebookSubjectIds, setExpandedNotebookSubjectIds] = useState<string[]>([]);
  const [errorNotebookForm, setErrorNotebookForm] = useState({
    subjectId: "",
    topicId: "",
    entryType: "error" as "error" | "rule" | "insight" | "trap" | "commentary",
    sourceKind: "manual" as
      | "question"
      | "class"
      | "teacher_comment"
      | "book"
      | "manual"
      | "mock_exam",
    sourceLabel: "",
    title: "",
    promptSnapshot: "",
    userErrorReason: "",
    correctReason: "",
    avoidanceNote: "",
    teacherComment: "",
    reviewNote: "",
  });
  const [timerSeconds, setTimerSeconds] = useState(50 * 60);
  const [timerRunning, setTimerRunning] = useState(false);
  const [activeTimerItemId, setActiveTimerItemId] = useState<string | null>(null);

  useEffect(() => {
    if (!profile && !plan && !workspace) {
      return;
    }

    updatePlannerSettings({
      userName: profile?.full_name || session?.user.email?.split("@")[0] || "Seu perfil",
      workspaceName: workspace?.name || "Workspace principal",
      examTitle: plan?.title || "Meu primeiro plano",
      studyType: plan?.study_type || "concurso",
      examDate: plan?.target_date || "",
      planStartDate:
        typeof plan?.metadata?.plan_start_date === "string"
          ? plan.metadata.plan_start_date
          : safePlanStartDate,
      dailyStudyHours: plan ? Number((plan.daily_available_minutes / 60).toFixed(1)) : 4,
      disciplinesPerDay: plan?.subjects_per_day || 4,
    });
  }, [plan, profile, safePlanStartDate, session?.user.email, updatePlannerSettings, workspace]);

  useEffect(() => {
    const availableNotebookSubjects = Array.from(
      new Set(
        errorNotebookEntries
          .filter((entry) => entry.entry_status !== "archived")
          .map((entry) => entry.subject_id ?? "__unlinked__"),
      ),
    );

    setExpandedNotebookSubjectIds((current) =>
      availableNotebookSubjects.filter((subjectId) => current.includes(subjectId)).length > 0
        ? current.filter((subjectId) => availableNotebookSubjects.includes(subjectId))
        : availableNotebookSubjects,
    );
  }, [errorNotebookEntries]);

  useEffect(() => {
    if (!timerRunning) {
      return;
    }

    const intervalId = window.setInterval(() => {
      setTimerSeconds((seconds) => {
        if (seconds <= 1) {
          setTimerRunning(false);
          return 0;
        }

        return seconds - 1;
      });
    }, 1000);

    return () => window.clearInterval(intervalId);
  }, [timerRunning]);

  const handleLogout = async () => {
    setAuthError(null);
    setAuthMessage(null);
    await signOut();
  };

  const handleLogin = async (email: string, password: string) => {
    setAuthError(null);
    setAuthMessage(null);

    const { error } = await signInWithPassword(email, password);

    if (error) {
      setAuthError(mapAuthError(error.message));
    }
  };

  const handleSignup = async (email: string, password: string) => {
    setAuthError(null);
    setAuthMessage(null);

    const { error, data } = await signUpWithPassword(email, password);

    if (error) {
      setAuthError(mapAuthError(error.message));
      return;
    }

    setAuthMessage(
      data.session
        ? "Conta criada e sessão iniciada."
        : "Conta criada. Confira seu e-mail para confirmar o acesso, se a confirmação estiver ativa.",
    );
  };

  const handleResetPassword = async (email: string) => {
    setAuthError(null);
    setAuthMessage(null);

    const { error } = await resetPassword(email);

    if (error) {
      setAuthError(mapAuthError(error.message));
      return;
    }

    setAuthMessage("Enviamos o link de recuperação para o seu e-mail.");
  };

  const handleSaveProfile = async () => {
    await saveProfileAndPlan({
      fullName: plannerSettings.userName,
      workspaceName: plannerSettings.workspaceName,
      planTitle: plannerSettings.examTitle,
      studyType: plannerSettings.studyType,
      targetDate: plannerSettings.examDate,
      planStartDate: safePlanStartDate,
      dailyStudyHours: plannerSettings.dailyStudyHours,
      subjectsPerDay: plannerSettings.disciplinesPerDay,
    });
  };

  const handleAddSubject = async () => {
    const normalized = newSubjectName.trim();

    if (!normalized) {
      return;
    }

    await addSubject({
      name: normalized,
      difficulty: newSubjectDifficulty,
      priorityWeight: newSubjectPriority,
      targetMinutes: newSubjectTargetMinutes,
    });

    setNewSubjectName("");
    setNewSubjectDifficulty("medium");
    setNewSubjectPriority(1);
    setNewSubjectTargetMinutes(180);
  };

  const handleAddTopic = async (subjectId: string) => {
    const normalized = (topicDrafts[subjectId] || "").trim();

    if (!normalized) {
      return;
    }

    await addTopic({ subjectId, title: normalized });
    setTopicDrafts((state) => ({ ...state, [subjectId]: "" }));
  };

  const toggleExpandedSubject = (subjectId: string) => {
    setExpandedSubjectIds((state) =>
      state.includes(subjectId)
        ? state.filter((item) => item !== subjectId)
        : [...state, subjectId],
    );
  };

  const handleApplySubjectEmphasis = async (
    subjectId: string,
    emphasis: SubjectEmphasis,
  ) => {
    const settings = getSubjectEmphasisSettings(emphasis);

    await updateSubject({
      subjectId,
      priorityWeight: settings.weight,
      targetMinutes: settings.targetMinutes,
    });
  };

  const handleGenerateSchedule = async () => {
    await regenerateSchedule(scheduleBlocks);
  };

  const resetSessionForm = () => {
    setSessionForm({
      netMinutes: "",
      pagesRead: "",
      lessonsWatched: "",
      questionsAnswered: "",
      questionsCorrect: "",
      questionsWrong: "",
      notes: "",
    });
  };

  const handleCreateNotice = async () => {
    if (!noticeForm.title.trim()) {
      return;
    }

    await createManualNotice({
      title: noticeForm.title,
      organization: noticeForm.organization,
      examDate: noticeForm.examDate,
      fileUrl: noticeForm.fileUrl,
    });

    setNoticeForm({
      title: "",
      organization: "",
      examDate: "",
      fileUrl: "",
      rawText: "",
    });
  };

  const handleImportNoticeStructure = async () => {
    if (!workspace?.id || !plan?.id || !noticeForm.rawText.trim()) {
      return;
    }

    const importTitle =
      noticeForm.title.trim() || plannerSettings.examTitle.trim() || "Edital importado";

    const result = await importStructuredNotice({
      workspaceId: workspace.id,
      planId: plan.id,
      title: importTitle,
      organization: noticeForm.organization,
      examDate: noticeForm.examDate,
      fileUrl: noticeForm.fileUrl,
      rawText: noticeForm.rawText,
    });

    if (!result) {
      return;
    }

    await Promise.all([reloadNotices(), reloadSubjects()]);

    setNoticeForm({
      title: "",
      organization: "",
      examDate: "",
      fileUrl: "",
      rawText: "",
    });

    setAuthMessage(
      `Estrutura importada: ${result.subjectsCreated} disciplinas novas e ${result.topicsCreated} tópicos adicionados.`,
    );
  };

  const handleCreateNotebookEntry = async () => {
    if (!errorNotebookForm.title.trim()) {
      return;
    }

    await createErrorNotebookEntry({
      subjectId: errorNotebookForm.subjectId || null,
      topicId: errorNotebookForm.topicId || null,
      entryType: errorNotebookForm.entryType,
      sourceKind: errorNotebookForm.sourceKind,
      sourceLabel: errorNotebookForm.sourceLabel,
      title: errorNotebookForm.title,
      promptSnapshot: errorNotebookForm.promptSnapshot,
      userErrorReason: errorNotebookForm.userErrorReason,
      correctReason: errorNotebookForm.correctReason,
      avoidanceNote: errorNotebookForm.avoidanceNote,
      teacherComment: errorNotebookForm.teacherComment,
      reviewNote: errorNotebookForm.reviewNote,
    });

    setErrorNotebookForm({
      subjectId: "",
      topicId: "",
      entryType: "error",
      sourceKind: "manual",
      sourceLabel: "",
      title: "",
      promptSnapshot: "",
      userErrorReason: "",
      correctReason: "",
      avoidanceNote: "",
      teacherComment: "",
      reviewNote: "",
    });
  };

  const handleExportErrorNotebookCsv = () => {
    if (errorNotebookEntries.length === 0) {
      return;
    }

    const rows = errorNotebookEntries.map((entry) => {
      const subjectName =
        subjects.find((subject) => subject.id === entry.subject_id)?.name ?? "";
      const topicTitle = topics.find((topic) => topic.id === entry.topic_id)?.title ?? "";

      return [
        subjectName,
        topicTitle,
        getNotebookEntryTypeLabel(entry.entry_type),
        getNotebookSourceKindLabel(entry.source_kind),
        entry.source_label ?? "",
        entry.title,
        entry.entry_status,
        entry.error_count,
        entry.user_error_reason ?? "",
        entry.correct_reason ?? "",
        entry.avoidance_note ?? "",
        entry.teacher_comment ?? "",
        entry.review_note ?? "",
        entry.last_error_at,
      ];
    });

    const csv = [
      [
        "Disciplina",
        "Topico",
        "Tipo",
        "Origem",
        "Referencia",
        "Titulo",
        "Status",
        "Qtde de erros",
        "Motivo do erro",
        "Regra correta",
        "Como evitar",
        "Comentario do professor",
        "Nota de revisao",
        "Ultimo erro",
      ],
      ...rows,
    ]
      .map((row) =>
        row.map((value) => `"${String(value ?? "").replaceAll('"', '""')}"`).join(","),
      )
      .join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "studyflow-caderno-de-revisao.csv";
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const handleExportErrorNotebookPdf = () => {
    if (errorNotebookEntries.length === 0) {
      return;
    }

    const printableHtml = buildErrorNotebookPrintableHtml({
      entries: errorNotebookEntries,
      subjects: subjects.map((subject) => ({ id: subject.id, name: subject.name })),
      topics: topics.map((topic) => ({ id: topic.id, title: topic.title })),
    });

    const printWindow = window.open("", "_blank", "noopener,noreferrer,width=960,height=720");

    if (!printWindow) {
      return;
    }

    printWindow.document.write(printableHtml);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
  };

  const handlePrintErrorNotebook = () => {
    if (errorNotebookEntries.length === 0) {
      return;
    }

    const printWindow = window.open("", "_blank", "noopener,noreferrer,width=960,height=720");

    if (!printWindow) {
      return;
    }

    printWindow.document.write(
      buildErrorNotebookPrintableHtml({
        entries: errorNotebookEntries,
        subjects: subjects.map((subject) => ({ id: subject.id, name: subject.name })),
        topics: topics.map((topic) => ({ id: topic.id, title: topic.title })),
      }),
    );
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
  };

  const handleTodaySessionToggle = async (key: string) => {
    const matchingItem = todayScheduledItems.find((item) => item.id === key);

    if (!matchingItem) {
      return;
    }

    if (isPlanItemCompleted(matchingItem)) {
      await reopenPlannedSession(matchingItem.id);
      await Promise.all([
        reloadSchedule(),
        reloadReviews(),
        reloadQuestionReviews(),
        reloadErrorNotebook(),
      ]);
      return;
    }

    const effectiveTopic = getEffectiveTopic(matchingItem.subject_id, matchingItem.topic_id);
    const completedSession = await completePlannedSession({
      dailyPlanItemId: matchingItem.id,
      subjectId: matchingItem.subject_id,
      topicId: effectiveTopic?.id ?? null,
      plannedMinutes: matchingItem.planned_minutes,
      sessionDate: safeCurrentDate,
    });

    if (completedSession) {
      await syncReviewForSession({
        sessionId: completedSession.id,
        subjectId: matchingItem.subject_id,
        topicId: effectiveTopic?.id ?? null,
        completedAt: completedSession.completedAt,
      });
      await syncQuestionReviewForSession({
        subjectId: matchingItem.subject_id,
        topicId: effectiveTopic?.id ?? null,
        sourceSessionId: completedSession.id,
        minimumQuestions: 5,
      });
      await syncSessionAnalytics({
        sessionDate: safeCurrentDate,
        subjectId: matchingItem.subject_id,
        topicId: effectiveTopic?.id ?? null,
        studiedMinutes: matchingItem.planned_minutes,
        questionsAnswered: 0,
        questionsCorrect: 0,
      });
    }

    await reloadSchedule();
  };

  const handleSubmitSessionExecution = async () => {
    if (!nextPlannedItem) {
      return;
    }

    const effectiveTopic = getEffectiveTopic(
      nextPlannedItem.subject_id,
      nextPlannedItem.topic_id,
    );
    const completedSession = await completePlannedSession({
      dailyPlanItemId: nextPlannedItem.id,
      subjectId: nextPlannedItem.subject_id,
      topicId: effectiveTopic?.id ?? null,
      plannedMinutes: nextPlannedItem.planned_minutes,
      sessionDate: safeCurrentDate,
      netMinutes: Number(sessionForm.netMinutes || nextPlannedItem.planned_minutes),
      pagesRead: Number(sessionForm.pagesRead || 0),
      lessonsWatched: Number(sessionForm.lessonsWatched || 0),
      questionsAnswered: Number(sessionForm.questionsAnswered || 0),
      questionsCorrect: Number(sessionForm.questionsCorrect || 0),
      questionsWrong: Number(sessionForm.questionsWrong || 0),
      notes: sessionForm.notes,
    });

    if (completedSession) {
      await syncReviewForSession({
        sessionId: completedSession.id,
        subjectId: nextPlannedItem.subject_id,
        topicId: effectiveTopic?.id ?? null,
        completedAt: completedSession.completedAt,
      });
      await syncQuestionReviewForSession({
        subjectId: nextPlannedItem.subject_id,
        topicId: effectiveTopic?.id ?? null,
        sourceSessionId: completedSession.id,
        minimumQuestions: 5,
      });
      if (Number(sessionForm.questionsWrong || 0) > 0) {
        await createErrorNotebookEntry({
          subjectId: nextPlannedItem.subject_id,
          topicId: effectiveTopic?.id ?? null,
          sourceSessionId: completedSession.id,
          entryType: "error",
          sourceKind: "question",
          sourceLabel: "Erro capturado ao fechar sessão",
          title: `${nextDiscipline?.name ?? "Disciplina"} • ${effectiveTopic?.title ?? "erro registrado"}`,
          promptSnapshot: sessionForm.notes,
          userErrorReason: sessionForm.notes,
          correctReason: "",
          avoidanceNote: "",
          reviewNote: sessionForm.notes,
        });
      }
      await syncSessionAnalytics({
        sessionDate: safeCurrentDate,
        subjectId: nextPlannedItem.subject_id,
        topicId: effectiveTopic?.id ?? null,
        studiedMinutes: Number(sessionForm.netMinutes || nextPlannedItem.planned_minutes),
        questionsAnswered: Number(sessionForm.questionsAnswered || 0),
        questionsCorrect: Number(sessionForm.questionsCorrect || 0),
      });
    }

    resetSessionForm();
    setTimerRunning(false);
    setActiveTimerItemId(null);
    setTimerSeconds((nextPlannedItem?.planned_minutes ?? 50) * 60);
    await Promise.all([reloadSchedule(), reloadQuestionReviews(), reloadErrorNotebook()]);
  };

  const handleSkipPlannedItem = async () => {
    if (!nextPlannedItem) {
      return;
    }

    await skipItem(nextPlannedItem.id);
    setTimerRunning(false);
    setActiveTimerItemId(null);
  };

  const handleMovePlannedItem = async (direction: "previous" | "next") => {
    if (!nextPlannedItem) {
      return;
    }

    await moveItem({
      itemId: nextPlannedItem.id,
      currentStudyDate: nextPlannedItem.study_date,
      direction,
    });
    setTimerRunning(false);
    setActiveTimerItemId(null);
  };

  const handleCreateManualBlock = async () => {
    const studyDate = newBlockForm.studyDate || scheduleDayOptions[0] || safeCurrentDate;

    if (!newBlockForm.subjectId || !studyDate) {
      return;
    }

    await createItem({
      studyDate,
      subjectId: newBlockForm.subjectId,
      topicId: newBlockForm.topicId || null,
      plannedMinutes: Math.max(15, Number(newBlockForm.plannedMinutes || 50)),
      taskType: newBlockForm.taskType,
    });

    setNewBlockForm((state) => ({
      ...state,
      topicId: "",
      plannedMinutes: 50,
    }));
  };

  const handleToggleTimer = () => {
    if (!nextPlannedItem) {
      return;
    }

    if (activeTimerItemId !== nextPlannedItem.id || timerSeconds <= 0) {
      setActiveTimerItemId(nextPlannedItem.id);
      setTimerSeconds(nextPlannedItem.planned_minutes * 60);
    }

    setTimerRunning((running) => !running);
  };

  const handleResetTimer = () => {
    setTimerRunning(false);
    setActiveTimerItemId(nextPlannedItem?.id ?? null);
    setTimerSeconds((nextPlannedItem?.planned_minutes ?? 50) * 60);
  };

  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950">
        <p className="animate-pulse font-medium text-sky-400">Verificando acesso...</p>
      </div>
    );
  }

  if (!session) {
    return (
      <LoginPage
        isConfigured={isSupabaseConfigured}
        loading={authLoading}
        error={authError}
        message={authMessage}
        onLogin={handleLogin}
        onSignup={handleSignup}
        onResetPassword={handleResetPassword}
      />
    );
  }

  const realSubjectsForPlan = subjects.map<StudySubjectInput>((subject) => {
    const subjectTopics = topics.filter((topic) => topic.subject_id === subject.id);
    const completedTopicsCount = subjectTopics.filter(
      (topic) => topic.status === "completed",
    ).length;
    const progressPercent =
      subjectTopics.length > 0
        ? Math.round((completedTopicsCount / subjectTopics.length) * 100)
        : 0;

    return {
      id: subject.id,
      name: subject.name,
      priorityWeight: Number(subject.priority_weight),
      difficulty: subject.difficulty_perception,
      progressPercent,
      weeklyTargetMinutes: subject.target_minutes || 180,
      pendingReviews: subjectTopics.filter((topic) => topic.status === "reviewing").length,
      overdueReviews: 0,
    };
  });
  const configuredDailyMinutes = Math.max(
    30,
    Math.round((Number(plannerSettings.dailyStudyHours) || 1) * 60),
  );
  const configuredSubjectsPerDay = Math.min(
    10,
    Math.max(1, Number(plannerSettings.disciplinesPerDay) || 1),
  );
  const weeklyAvailability: WeeklyAvailability[] = plan
    ? Array.from({ length: 6 }, (_, index) => {
        const base = startOfWeek(parseISO(safeCurrentDate), { weekStartsOn: 1 });
        base.setDate(base.getDate() + index);

        return {
          date: base.toISOString().slice(0, 10),
          availableMinutes: configuredDailyMinutes,
        };
      })
    : [];
  const scheduleBlocks =
    realSubjectsForPlan.length > 0
      ? generateWeeklySchedule(realSubjectsForPlan, weeklyAvailability, {
          maxSubjectsPerDay: configuredSubjectsPerDay,
          preferredBlockMinutes: plan?.preferred_block_minutes,
        })
      : [];
  const persistedScheduleBlocks = scheduledItems.map((item) => ({
    date: item.study_date,
    subjectId: item.subject_id ?? "",
    plannedMinutes: item.planned_minutes,
    recommendedMode:
      item.task_type === "review"
        ? "review"
        : item.task_type === "questions"
          ? "questions"
          : "study",
    priorityScore: item.priority_score,
  })) as typeof scheduleBlocks;
  const activeScheduleBlocks =
    persistedScheduleBlocks.length > 0 ? persistedScheduleBlocks : scheduleBlocks;
  const completedDailyPlanItemIds = new Set(
    todaySessions
      .filter((sessionItem) => sessionItem.session_status === "completed")
      .map((sessionItem) => sessionItem.daily_plan_item_id)
      .filter(Boolean),
  );
  const isPlanItemCompleted = (item: { id: string; status: string }) =>
    item.status === "completed" || completedDailyPlanItemIds.has(item.id);
  const actionableScheduledItems = scheduledItems
    .filter((item) => item.status !== "cancelled" && item.status !== "skipped")
    .sort((left, right) => {
      if (left.study_date !== right.study_date) {
        return left.study_date.localeCompare(right.study_date);
      }

      return left.sequence_number - right.sequence_number;
    });
  const cycleDates = Array.from(
    new Set(actionableScheduledItems.map((item) => item.study_date)),
  ).sort();
  const fallbackCycleDate = cycleDates[0] ?? weeklyAvailability[0]?.date ?? safeCurrentDate;
  const completedCycleDate = cycleDates[cycleDates.length - 1] ?? fallbackCycleDate;
  const activeCycleDate =
    cycleDates.find((date) =>
      actionableScheduledItems.some(
        (item) => item.study_date === date && !isPlanItemCompleted(item),
      ),
    ) ?? completedCycleDate;
  const activeCycleIndex = Math.max(0, cycleDates.indexOf(activeCycleDate));
  const dayNumber = activeCycleIndex + 1;
  const cycleDay = cycleDays[activeCycleIndex % cycleDays.length]?.id ?? "A";
  const phase = getPhase(dayNumber) || { name: "Ciclo por conclusão" };
  const todayScheduledItems = actionableScheduledItems.filter(
    (item) => item.study_date === activeCycleDate,
  );
  const currentTopicBySubjectId = new Map(
    subjects.map((subject) => {
      const subjectTopics = topics
        .filter((topic) => topic.subject_id === subject.id)
        .sort((left, right) => left.order_index - right.order_index);
      const currentTopic =
        subjectTopics.find((topic) => topic.status !== "completed") ??
        subjectTopics[subjectTopics.length - 1] ??
        null;

      return [subject.id, currentTopic] as const;
    }),
  );
  const getEffectiveTopic = (subjectId: string | null, topicId?: string | null) => {
    if (topicId) {
      return topics.find((topic) => topic.id === topicId) ?? null;
    }

    return subjectId ? currentTopicBySubjectId.get(subjectId) ?? null : null;
  };
  const planSubjects = realSubjectsForPlan;
  const plannedMinutes = activeScheduleBlocks.reduce(
    (total, block) => total + block.plannedMinutes,
    0,
  );
  const studiedMinutes = metricSessions.reduce(
    (sum, item) => sum + item.net_minutes,
    0,
  );
  const totalQuestionsFromMetrics = metricSessions.reduce(
    (sum, sessionItem) => sum + sessionItem.questions_answered,
    0,
  );
  const totalCorrectFromMetrics = metricSessions.reduce(
    (sum, sessionItem) => sum + sessionItem.questions_correct,
    0,
  );
  const globalAccuracy =
    totalQuestionsFromMetrics > 0
      ? Math.round((totalCorrectFromMetrics / totalQuestionsFromMetrics) * 100)
      : 0;
  const displayDisciplines: Discipline[] = realSubjectsForPlan.length > 0
    ? realSubjectsForPlan.map((subject) => ({
        id: subject.id,
        name: subject.name,
        shortName: subject.name,
        emoji: "📘",
        estimatedQuestions: Math.max(10, Math.round(subject.weeklyTargetMinutes / 15)),
        bankCount: subject.pendingReviews * 10 + 100,
        type:
          subject.difficulty === "high"
            ? "raciocinio"
            : subject.difficulty === "low"
              ? "decoreba"
              : "mista",
        sessionsPerCycle: 1,
      }))
    : [];
  const todaySessionCards =
    todayScheduledItems.length > 0
      ? todayScheduledItems.map((item) => {
          const discipline =
            displayDisciplines.find((candidate) => candidate.id === item.subject_id) ??
            displayDisciplines[0];

          return {
            key: item.id,
            disciplineId: item.subject_id ?? "",
            shortName: discipline?.shortName ?? "Disciplina",
            name: discipline?.name ?? "Disciplina",
            emoji: discipline?.emoji ?? "📘",
            estimatedQuestions: discipline?.estimatedQuestions ?? 0,
            bankCount: discipline?.bankCount ?? 0,
            type: discipline?.type ?? "estudo",
            completed: isPlanItemCompleted(item),
            topicTitle:
              getEffectiveTopic(item.subject_id, item.topic_id)?.title ??
              "Sem tópico vinculado",
          };
        })
      : [];
  const now = new Date();
  const reviewQueue: AppReviewQueueItem[] = reviewItems.length > 0
    ? reviewItems
        .map((item) => {
          const nextReview = item.next_review_at ? new Date(item.next_review_at) : null;
          const lateness = nextReview ? Math.max(0, now.getTime() - nextReview.getTime()) : 0;
          const priorityScore =
            Number(item.priority_score) +
            (lateness > 0 ? Math.min(3, lateness / (1000 * 60 * 60 * 24)) : 0);

          return {
            itemId: item.id,
            nextReviewAt: item.next_review_at ?? now.toISOString(),
            nextStep: item.success_streak,
            priorityScore: Number(priorityScore.toFixed(2)),
            topicId: item.topic_id,
            subjectId: item.subject_id,
            subjectName:
              subjects.find((subject) => subject.id === item.subject_id)?.name ??
              "Disciplina não vinculada",
            topicTitle:
              topics.find((topic) => topic.id === item.topic_id)?.title ?? null,
          };
        })
        .sort((left, right) => right.priorityScore - left.priorityScore)
    : [];
  const questionReviewQueue = questionReviewTasks
    .filter((task) => task.status === "pending")
    .map((task) => ({
      ...task,
      subjectName:
        subjects.find((subject) => subject.id === task.subject_id)?.name ??
        "Disciplina não vinculada",
      topicTitle: topics.find((topic) => topic.id === task.topic_id)?.title ?? null,
    }));
  const openErrorNotebookEntries = errorNotebookEntries.filter(
    (entry) => entry.entry_status !== "archived",
  );
  const groupedErrorNotebookEntries = Object.values(
    openErrorNotebookEntries.reduce<
      Record<
        string,
        {
          subjectId: string;
          subjectName: string;
          totalEntries: number;
          favoriteCount: number;
          entries: Array<
            typeof openErrorNotebookEntries[number] & {
              topicTitle: string;
            }
          >;
        }
      >
    >((groups, entry) => {
      const subjectId = entry.subject_id ?? "__unlinked__";
      const subjectName =
        subjects.find((subject) => subject.id === entry.subject_id)?.name ??
        "Sem disciplina vinculada";
      const topicTitle =
        topics.find((topic) => topic.id === entry.topic_id)?.title ?? "Anotação geral";

      if (!groups[subjectId]) {
        groups[subjectId] = {
          subjectId,
          subjectName,
          totalEntries: 0,
          favoriteCount: 0,
          entries: [],
        };
      }

      groups[subjectId].totalEntries += 1;
      groups[subjectId].favoriteCount += entry.favorite ? 1 : 0;
      groups[subjectId].entries.push({
        ...entry,
        topicTitle,
      });

      return groups;
    }, {}),
  )
    .map((group) => ({
      ...group,
      entries: group.entries.sort((left, right) => {
        if (left.favorite !== right.favorite) {
          return Number(right.favorite) - Number(left.favorite);
        }

        return right.last_error_at.localeCompare(left.last_error_at);
      }),
    }))
    .sort((left, right) => {
      if (left.favoriteCount !== right.favoriteCount) {
        return right.favoriteCount - left.favoriteCount;
      }

      return left.subjectName.localeCompare(right.subjectName);
    });
  const subjectAccuracyRanking = (realSubjectsForPlan.length > 0
    ? realSubjectsForPlan
        .map((subject) => {
          const subjectSessions = metricSessions.filter(
            (sessionItem) => sessionItem.subject_id === subject.id,
          );
          const answered = subjectSessions.reduce(
            (sum, sessionItem) => sum + sessionItem.questions_answered,
            0,
          );
          const correct = subjectSessions.reduce(
            (sum, sessionItem) => sum + sessionItem.questions_correct,
            0,
          );
          const accuracy =
            answered > 0 ? Math.round((correct / answered) * 100) : Math.max(45, 80 - subject.pendingReviews * 4);

          return {
            ...subject,
            accuracy,
          };
        })
        .sort((left, right) => right.accuracy - left.accuracy)
    : []);

  const nextPlannedItem =
    todayScheduledItems.find((item) => !isPlanItemCompleted(item)) ?? null;
  const nextDiscipline =
    displayDisciplines.find((discipline) => discipline.id === nextPlannedItem?.subject_id) ??
    null;
  const nextTopic = nextPlannedItem
    ? getEffectiveTopic(nextPlannedItem.subject_id, nextPlannedItem.topic_id)
    : null;
  const scheduleDayOptions = Array.from(
    new Set([...weeklyAvailability.map((day) => day.date), ...cycleDates]),
  ).sort();
  const scheduleCards = scheduledItems
    .slice()
    .sort((left, right) => {
      if (left.study_date !== right.study_date) {
        return left.study_date.localeCompare(right.study_date);
      }

      return left.sequence_number - right.sequence_number;
    });
  const visibleTimerSeconds =
    nextPlannedItem && activeTimerItemId !== nextPlannedItem.id
      ? nextPlannedItem.planned_minutes * 60
      : timerSeconds;
  const cycleBoardDays = cycleDays.map((day, index) => {
    const dayDate = cycleDates[index] ?? weeklyAvailability[index]?.date;
    const sessions = dayDate
      ? activeScheduleBlocks
          .filter((block) => block.date === dayDate && block.subjectId)
          .map((block) => block.subjectId)
      : [];

    return {
      ...day,
      sessions,
    };
  });
  const topRiskSubjects = difficultyMaps
    .filter((item) => item.recommendation === "reinforce" || item.recommendation === "review")
    .map((item) => {
      const subject = planSubjects.find((candidate) => candidate.id === item.subject_id);
      return subject?.name;
    })
    .filter(Boolean)
    .slice(0, 2);
  const topAdvanceSubjects = difficultyMaps
    .filter((item) => item.recommendation === "advance" || item.recommendation === "maintain")
    .map((item) => {
      const subject = planSubjects.find((candidate) => candidate.id === item.subject_id);
      return subject?.name;
    })
    .filter(Boolean)
    .slice(0, 2);

  return (
    <AppShell>
      <Header
        dayNumber={dayNumber}
        cycleDay={cycleDay}
        phaseName={phase?.name || "N/A"}
        onLogout={handleLogout}
        userName={profile?.full_name || session.user.email?.split("@")[0] || "Seu perfil"}
        userEmail={session.user.email || ""}
      />

      <Card className="mb-4 border-0 bg-white/86 p-3.5 shadow-[0_12px_26px_rgba(15,23,42,0.05)] backdrop-blur">
        <div className="flex flex-wrap items-end gap-2.5">
          <label className="min-w-[220px] flex-1 text-sm text-slate-600">
            Data de registro
            <input
              type="date"
              value={safeCurrentDate}
              onChange={(event) => setCurrentDate(event.target.value)}
              className="mt-1.5 h-9 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-sky-300"
            />
          </label>
          <button
            type="button"
            onClick={() => setCurrentDate(new Date().toISOString().slice(0, 10))}
            className={buttonSecondary}
          >
            Ir para hoje
          </button>
          <div className="inline-flex h-9 items-center rounded-xl bg-slate-100 px-3.5 text-xs font-semibold text-slate-600">
            Ciclo {cycleDay} • bloco {dayNumber} • base {activeCycleDate}
          </div>
        </div>
      </Card>

      <Card className="mb-5 overflow-hidden border-0 bg-white/82 p-2 shadow-[0_12px_26px_rgba(15,23,42,0.05)] backdrop-blur">
        <div className="flex gap-1.5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {studyflowViews.map((view) => {
            const Icon = view.icon;

            return (
              <button
                key={view.key}
                type="button"
                onClick={() => setActiveView(view.key)}
                className={`inline-flex h-10 min-w-[118px] shrink-0 items-center justify-center gap-2 rounded-xl px-3 text-xs font-bold transition ${
                  activeView === view.key
                    ? "bg-slate-950 text-white shadow-sm shadow-slate-200"
                    : "bg-transparent text-slate-600 hover:bg-slate-100"
                }`}
              >
                <Icon className="h-4 w-4" />
                {view.label}
              </button>
            );
          })}
        </div>
      </Card>

      {activeView === "dashboard" && (
        <div className="space-y-6">
          <StatsCards
            dayNumber={dayNumber}
            cycleDay={cycleDay}
            completedCount={
              todayScheduledItems.length > 0
                ? todayScheduledItems.filter(isPlanItemCompleted).length
                : 0
            }
            totalToday={
              todayScheduledItems.length > 0
                ? todayScheduledItems.length
                : 0
            }
            studiedMinutes={studiedMinutes}
          />

          <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
            <TodaySessions
              items={todaySessionCards}
              onToggle={handleTodaySessionToggle}
            />

            <Card className="overflow-hidden border-0 bg-[linear-gradient(180deg,#ffffff,#f8fafc)] p-6 shadow-[0_18px_40px_rgba(15,23,42,0.06)]">
              <div className="mb-5 flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-xl font-bold text-slate-900">
                    Painel inteligente
                  </h2>
                  <p className="mt-1 text-sm text-slate-500">
                    Próximas prioridades do plano com base no motor inicial do StudyFlow.
                  </p>
                </div>
                <div className="rounded-2xl bg-slate-900 p-2 text-white">
                  <Brain className="h-5 w-5" />
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <MetricCard
                  label="Minutos planejados"
                  value={String(plannedMinutes)}
                  icon={<CalendarRange className="h-4 w-4 text-sky-500" />}
                />
                <MetricCard
                  label="Revisões pendentes"
                  value={String(reviewQueue.length)}
                  icon={<Brain className="h-4 w-4 text-violet-500" />}
                />
                <MetricCard
                  label="Matérias ativas"
                  value={String(dashboard?.active_subjects ?? planSubjects.length)}
                  icon={<BookOpenCheck className="h-4 w-4 text-emerald-500" />}
                />
              </div>

              {analyticsError && (
                <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                  {analyticsError}
                </div>
              )}

              {(analyticsLoading || analyticsSaving) && (
                <div className="mt-4 rounded-2xl bg-slate-100 px-4 py-3 text-sm font-medium text-slate-600">
                  Sincronizando analytics...
                </div>
              )}

              <div className="mt-5 grid gap-4">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-sm font-semibold text-slate-900">Matérias com maior retorno</p>
                  <div className="mt-3 space-y-3">
                    {subjectAccuracyRanking.slice(0, 3).map((subject) => (
                      <div
                        key={subject.id}
                        className="rounded-xl border border-white bg-white px-3 py-3"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <p className="font-semibold text-slate-900">{subject.name}</p>
                          <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                            {subject.accuracy}%
                          </span>
                        </div>
                        <p className="mt-1 text-sm text-slate-600">
                          Progresso {subject.progressPercent}% • revisões pendentes {subject.pendingReviews}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-sm font-semibold text-slate-900">Revisões críticas</p>
                  <div className="mt-3 space-y-3">
                    {reviewQueue.slice(0, 3).map((item) => (
                      <div
                        key={item.itemId}
                        className="rounded-xl border border-white bg-white px-3 py-3"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <p className="font-semibold text-slate-900">
                            {item.topicTitle ?? item.subjectName}
                          </p>
                          <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-800">
                            {item.priorityScore}
                          </span>
                        </div>
                        <p className="mt-1 text-sm text-slate-600">
                          {item.topicTitle ? item.subjectName : "Revisão da disciplina"} •{" "}
                          {new Date(item.nextReviewAt).toLocaleString("pt-BR")}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </Card>
          </div>
        </div>
      )}

      {activeView === "plano" && (
        <div className="grid gap-5 xl:grid-cols-[280px_1fr]">
          <aside className="space-y-4 xl:sticky xl:top-6 xl:self-start">
            <Card className="border-0 bg-slate-950 p-5 text-white">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-sky-200">
                Plano operacional
              </p>
              <h2 className="mt-3 text-2xl font-black">
                {plannerSettings.examTitle || "StudyFlow"}
              </h2>
              <p className="mt-2 text-sm leading-6 text-slate-300">
                Controle o ciclo, conteúdo e execução semanal sem misturar decisões no mesmo espaço.
              </p>

              <div className="mt-5 grid grid-cols-2 gap-2">
                <PlanMiniStat label="Disciplinas" value={subjects.length} />
                <PlanMiniStat label="Tópicos" value={topics.length} />
                <PlanMiniStat label="Ciclo atual" value={cycleDay} />
                <PlanMiniStat label="Minutos" value={plannedMinutes} />
              </div>
            </Card>

            <Card className="border-0 bg-white/90 p-2">
              <div className="space-y-1.5">
                {planSubViews.map((view) => {
                  const Icon =
                    view.key === "visao"
                      ? Target
                      : view.key === "disciplinas"
                        ? BookOpenCheck
                        : CalendarRange;

                  return (
                    <button
                      key={view.key}
                      type="button"
                      onClick={() => setActivePlanView(view.key)}
                      className={`flex w-full items-center gap-3 rounded-2xl px-3.5 py-3 text-left transition ${
                        activePlanView === view.key
                          ? "bg-slate-950 text-white shadow-sm shadow-slate-200"
                          : "text-slate-600 hover:bg-slate-100"
                      }`}
                    >
                      <span
                        className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${
                          activePlanView === view.key
                            ? "bg-white/12 text-white"
                            : "bg-slate-100 text-slate-600"
                        }`}
                      >
                        <Icon className="h-4 w-4" />
                      </span>
                      <span>
                        <span className="block text-sm font-black">{view.label}</span>
                        <span
                          className={`mt-0.5 block text-xs ${
                            activePlanView === view.key ? "text-slate-300" : "text-slate-400"
                          }`}
                        >
                          {view.description}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </Card>
          </aside>

          <div className="min-w-0 space-y-5">

          {activePlanView === "visao" && (
          <div className="grid gap-5 xl:grid-cols-[1.05fr_0.95fr]">
            <CycleBoard
              currentCycleDay={cycleDay}
              cycleDays={cycleBoardDays}
              disciplines={displayDisciplines}
            />

            <Card className="overflow-hidden border-0 bg-[linear-gradient(180deg,#0f172a,#111827)] p-5 text-white shadow-[0_16px_34px_rgba(15,23,42,0.14)]">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-xl font-bold">Direção do plano</h2>
                  <p className="mt-1 text-sm text-slate-300">
                    Estrutura do MVP com replanejamento progressivo e agenda semanal automática.
                  </p>
                </div>
                <div className="rounded-2xl bg-white/10 p-2">
                  <ArrowUpRight className="h-5 w-5" />
                </div>
              </div>

              <div className="mt-4 grid gap-2.5">
                <PlanCallout
                  title="1. Objetivo e prazo"
                  body="Definir meta, disponibilidade e blocos preferidos."
                />
                <PlanCallout
                  title="2. Distribuição inteligente"
                  body="Alocação por peso, dificuldade, progresso e revisão."
                />
                <PlanCallout
                  title="3. Rebalanceamento"
                  body="Quando atrasar, o sistema redistribui os próximos blocos."
                />
              </div>
            </Card>
          </div>
          )}

          {activePlanView === "disciplinas" && (
          <div className="grid gap-5 xl:grid-cols-[0.85fr_1.15fr]">
            <Card className="border-0 bg-white/94 p-5 shadow-[0_16px_34px_rgba(15,23,42,0.055)]">
              <div className="mb-4">
                <h2 className="text-lg font-bold text-slate-950">Disciplinas do plano</h2>
                <p className="mt-1 text-sm text-slate-500">
                  Cadastro real no banco para formar a base do cronograma.
                </p>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <label className="text-sm text-slate-600 md:col-span-2">
                  Nome da disciplina
                  <input
                    type="text"
                    value={newSubjectName}
                    onChange={(event) => setNewSubjectName(event.target.value)}
                    className="mt-1.5 h-9 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-sky-300"
                    placeholder="Ex.: Direito Administrativo"
                  />
                </label>
                <label className="text-sm text-slate-600">
                  Dificuldade
                  <select
                    value={newSubjectDifficulty}
                    onChange={(event) =>
                      setNewSubjectDifficulty(event.target.value as StudyDifficulty)
                    }
                    className="mt-1.5 h-9 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-sky-300"
                  >
                    <option value="low">Baixa</option>
                    <option value="medium">Média</option>
                    <option value="high">Alta</option>
                  </select>
                </label>
                <label className="text-sm text-slate-600">
                  Peso de prioridade
                  <input
                    type="number"
                    min={0.5}
                    max={3}
                    step={0.1}
                    value={newSubjectPriority}
                    onChange={(event) => setNewSubjectPriority(Number(event.target.value || 1))}
                    className="mt-1.5 h-9 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-sky-300"
                  />
                </label>
                <label className="text-sm text-slate-600 md:col-span-2">
                  Meta semanal em minutos
                  <input
                    type="number"
                    min={30}
                    step={30}
                    value={newSubjectTargetMinutes}
                    onChange={(event) =>
                      setNewSubjectTargetMinutes(Number(event.target.value || 180))
                    }
                    className="mt-1.5 h-9 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-sky-300"
                  />
                </label>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={handleAddSubject}
                  disabled={subjectsSaving || subjectsLoading}
                  className={buttonPrimary}
                >
                  Adicionar disciplina
                </button>
                {(subjectsLoading || subjectsSaving) && (
                  <span className="inline-flex h-9 items-center rounded-xl bg-slate-100 px-3 text-xs font-semibold text-slate-600">
                    Sincronizando dados...
                  </span>
                )}
              </div>

              {subjectsError && (
                <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                  {subjectsError}
                </div>
              )}
            </Card>

            <Card className="border-0 bg-white/94 p-5 shadow-[0_16px_34px_rgba(15,23,42,0.055)]">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-bold text-slate-950">Biblioteca do plano</h2>
                  <p className="mt-1 text-sm text-slate-500">
                    Disciplinas e tópicos persistidos no schema novo.
                  </p>
                </div>
                <Badge className="bg-slate-900 text-white">{subjects.length} disciplina(s)</Badge>
              </div>

              <div className="space-y-3">
                {subjects.length === 0 && (
                  <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-sm text-slate-500">
                    Nenhuma disciplina cadastrada ainda. Crie a primeira para alimentar o plano.
                  </div>
                )}

                {subjects.map((subject) => {
                  const subjectTopics = topics.filter((topic) => topic.subject_id === subject.id);
                  const isExpanded = expandedSubjectIds.includes(subject.id);
                  const emphasis = getSubjectEmphasisFromWeight(Number(subject.priority_weight));

                  return (
                    <div
                      key={subject.id}
                      className="rounded-2xl border border-slate-200 bg-slate-50/80 p-3"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <button
                          type="button"
                          onClick={() => toggleExpandedSubject(subject.id)}
                          className="flex min-w-[220px] flex-1 items-center gap-3 text-left"
                        >
                          <div className="rounded-2xl bg-white p-2 text-slate-700 shadow-sm">
                            <ListTree className="h-4 w-4" />
                          </div>
                          <div>
                            <p className="font-semibold text-slate-900">{subject.name}</p>
                            <p className="mt-1 text-sm text-slate-600">
                              {subjectTopics.length} tópico(s) • peso {Number(subject.priority_weight).toFixed(1)} • {getSubjectEmphasisLabel(emphasis)}
                            </p>
                          </div>
                        </button>

                        <div className="flex flex-wrap items-center gap-1.5">
                          <select
                            value={emphasis}
                            onChange={(event) =>
                              handleApplySubjectEmphasis(
                                subject.id,
                                event.target.value as SubjectEmphasis,
                              )
                            }
                            className="h-9 rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 outline-none transition focus:border-sky-300"
                          >
                            <option value="very-low">Manutenção</option>
                            <option value="low">Baixa</option>
                            <option value="normal">Normal</option>
                            <option value="high">Alta</option>
                            <option value="max">Máxima</option>
                          </select>
                          <IconActionButton
                            title={isExpanded ? "Minimizar tópicos" : "Expandir tópicos"}
                            onClick={() => toggleExpandedSubject(subject.id)}
                            icon={isExpanded ? <ChevronUp /> : <ChevronDown />}
                          />
                          <IconActionButton
                            title="Excluir disciplina"
                            onClick={() => removeSubject(subject.id)}
                            icon={<Trash2 />}
                            variant="danger"
                          />
                        </div>
                      </div>

                      {isExpanded && (
                        <div className="mt-3 rounded-2xl border border-white bg-white p-3">
                          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                            <label className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500 xl:col-span-2">
                              Nome
                              <input
                                type="text"
                                value={subject.name}
                                onChange={(event) =>
                                  updateSubject({
                                    subjectId: subject.id,
                                    name: event.target.value,
                                  })
                                }
                                className="mt-1.5 h-9 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm normal-case tracking-normal text-slate-700 outline-none transition focus:border-sky-300"
                              />
                            </label>
                            <label className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                              Peso manual
                              <input
                                type="number"
                                min={0.2}
                                max={3}
                                step={0.1}
                                value={subject.priority_weight}
                                onChange={(event) =>
                                  updateSubject({
                                    subjectId: subject.id,
                                    priorityWeight: Number(event.target.value || 1),
                                  })
                                }
                                className="mt-1.5 h-9 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-700 outline-none transition focus:border-sky-300"
                              />
                            </label>
                            <label className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                              Meta semanal
                              <input
                                type="number"
                                min={30}
                                step={30}
                                value={subject.target_minutes}
                                onChange={(event) =>
                                  updateSubject({
                                    subjectId: subject.id,
                                    targetMinutes: Number(event.target.value || 180),
                                  })
                                }
                                className="mt-1.5 h-9 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-700 outline-none transition focus:border-sky-300"
                              />
                            </label>
                            <label className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                              Dificuldade
                              <select
                                value={subject.difficulty_perception}
                                onChange={(event) =>
                                  updateSubject({
                                    subjectId: subject.id,
                                    difficulty: event.target.value as StudyDifficulty,
                                  })
                                }
                                className="mt-1.5 h-9 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-700 outline-none transition focus:border-sky-300"
                              >
                                <option value="low">Baixa</option>
                                <option value="medium">Média</option>
                                <option value="high">Alta</option>
                              </select>
                            </label>
                          </div>

                          <div className="mt-3 grid gap-2 md:grid-cols-2">
                            {subjectTopics.length === 0 && (
                              <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-500">
                                Nenhum tópico cadastrado nesta disciplina.
                              </p>
                            )}
                            {subjectTopics.map((topic) => (
                              <div
                                key={topic.id}
                                className="grid gap-3 rounded-xl border border-slate-100 bg-slate-50 px-3 py-2.5 sm:grid-cols-[1fr_auto]"
                              >
                                <div>
                                  <p className="text-sm font-semibold text-slate-900">{topic.title}</p>
                                  <p className="mt-1 text-xs uppercase tracking-[0.14em] text-slate-400">
                                    {translateTopicStatus(topic.status)}
                                  </p>
                                </div>
                                <div className="flex items-center justify-end gap-1.5">
                                  <IconActionButton
                                    title={
                                      topic.status === "completed"
                                        ? "Reabrir tópico"
                                        : "Marcar como visto"
                                    }
                                    onClick={() =>
                                      updateTopic({
                                        topicId: topic.id,
                                        status:
                                          topic.status === "completed"
                                            ? "not_started"
                                            : "completed",
                                      })
                                    }
                                    icon={
                                      topic.status === "completed" ? (
                                        <RotateCcw />
                                      ) : (
                                        <Eye />
                                      )
                                    }
                                  />
                                  <IconActionButton
                                    title="Excluir tópico"
                                    onClick={() => removeTopic(topic.id)}
                                    icon={<Trash2 />}
                                    variant="danger"
                                  />
                                </div>
                              </div>
                            ))}
                          </div>

                          <div className="mt-3 flex gap-2">
                            <input
                              type="text"
                              value={topicDrafts[subject.id] || ""}
                              onChange={(event) =>
                                setTopicDrafts((state) => ({
                                  ...state,
                                  [subject.id]: event.target.value,
                                }))
                              }
                              className="h-9 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-sky-300"
                              placeholder="Adicionar tópico"
                            />
                            <button
                              type="button"
                              onClick={() => handleAddTopic(subject.id)}
                              className={buttonPrimary}
                            >
                              Salvar
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </Card>
          </div>
          )}

          {activePlanView === "cronograma" && (
          <Card className="border-0 bg-white/94 p-5 shadow-[0_16px_34px_rgba(15,23,42,0.055)]">
            <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold text-slate-950">Cards do ciclo</h2>
                <p className="mt-1 text-sm text-slate-500">
                  Organize livremente os blocos: troque o dia, suba/desça na ordem ou pause cards sem apagar o plano.
                </p>
                {weeklyPlan && (
                  <p className="mt-2 text-xs uppercase tracking-[0.14em] text-emerald-600">
                    Cronograma persistido para a semana de {weeklyPlan.week_start_date}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={handleGenerateSchedule}
                disabled={scheduleSaving || subjects.length === 0}
                className={buttonPrimary}
              >
                {scheduleSaving ? "Gerando..." : "Gerar cronograma da semana"}
              </button>
            </div>

            {scheduleError && (
              <div className="mb-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                {scheduleError}
              </div>
            )}

            {scheduleLoading && (
              <div className="mb-4 rounded-2xl bg-slate-100 px-4 py-3 text-sm font-medium text-slate-600">
                Carregando cronograma persistido...
              </div>
            )}

            <div className="mb-4 rounded-3xl border border-slate-200 bg-white p-4">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-black text-slate-950">Regras da grade</p>
                  <p className="mt-1 text-xs text-slate-500">
                    Estes campos controlam como o cronograma automatico monta os cards.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleSaveProfile}
                  disabled={bootstrapSaving}
                  className={buttonSecondary}
                >
                  {bootstrapSaving ? "Salvando..." : "Salvar regras"}
                </button>
              </div>

              <div className="grid gap-3 md:grid-cols-3">
                <label className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                  Horas liquidas por dia
                  <input
                    type="number"
                    min={0.5}
                    step={0.5}
                    value={plannerSettings.dailyStudyHours}
                    onChange={(event) =>
                      updatePlannerSettings({
                        dailyStudyHours: Number(event.target.value || 1),
                      })
                    }
                    className="mt-1.5 h-9 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm normal-case tracking-normal text-slate-700 outline-none transition focus:border-sky-300"
                  />
                </label>
                <label className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                  Disciplinas por dia
                  <input
                    type="number"
                    min={1}
                    max={10}
                    value={plannerSettings.disciplinesPerDay}
                    onChange={(event) =>
                      updatePlannerSettings({
                        disciplinesPerDay: Number(event.target.value || 1),
                      })
                    }
                    className="mt-1.5 h-9 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm normal-case tracking-normal text-slate-700 outline-none transition focus:border-sky-300"
                  />
                </label>
                <label className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                  Inicio do ciclo
                  <input
                    type="date"
                    value={safeCurrentDate}
                    onChange={(event) => setCurrentDate(event.target.value)}
                    className="mt-1.5 h-9 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm normal-case tracking-normal text-slate-700 outline-none transition focus:border-sky-300"
                  />
                </label>
              </div>
            </div>

            <div className="mb-4 rounded-3xl border border-slate-200 bg-slate-50/80 p-3.5">
              <div className="mb-3 flex items-center gap-2">
                <div className="grid h-9 w-9 place-items-center rounded-xl bg-slate-950 text-white">
                  <Plus className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-sm font-black text-slate-950">Criar bloco manual</p>
                  <p className="text-xs text-slate-500">
                    Monte sua grade livremente sem depender do automático.
                  </p>
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-[1fr_1fr_0.8fr_0.7fr_0.8fr_auto]">
                <label className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                  Dia
                  <select
                    value={newBlockForm.studyDate || scheduleDayOptions[0] || ""}
                    onChange={(event) =>
                      setNewBlockForm((state) => ({
                        ...state,
                        studyDate: event.target.value,
                      }))
                    }
                    className="mt-1.5 h-9 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm normal-case tracking-normal text-slate-700 outline-none transition focus:border-sky-300"
                  >
                    {scheduleDayOptions.map((date, index) => (
                      <option key={date} value={date}>
                        Dia {cycleDays[index % cycleDays.length]?.id ?? index + 1} - {date}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                  Disciplina
                  <select
                    value={newBlockForm.subjectId}
                    onChange={(event) =>
                      setNewBlockForm((state) => ({
                        ...state,
                        subjectId: event.target.value,
                        topicId: "",
                      }))
                    }
                    className="mt-1.5 h-9 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm normal-case tracking-normal text-slate-700 outline-none transition focus:border-sky-300"
                  >
                    <option value="">Selecione</option>
                    {subjects.map((subject) => (
                      <option key={subject.id} value={subject.id}>
                        {subject.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                  Tópico
                  <select
                    value={newBlockForm.topicId}
                    onChange={(event) =>
                      setNewBlockForm((state) => ({
                        ...state,
                        topicId: event.target.value,
                      }))
                    }
                    className="mt-1.5 h-9 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm normal-case tracking-normal text-slate-700 outline-none transition focus:border-sky-300"
                  >
                    <option value="">Automático</option>
                    {topics
                      .filter((topic) => topic.subject_id === newBlockForm.subjectId)
                      .map((topic) => (
                        <option key={topic.id} value={topic.id}>
                          {topic.title}
                        </option>
                      ))}
                  </select>
                </label>
                <label className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                  Min
                  <input
                    type="number"
                    min={15}
                    step={5}
                    value={newBlockForm.plannedMinutes}
                    onChange={(event) =>
                      setNewBlockForm((state) => ({
                        ...state,
                        plannedMinutes: Number(event.target.value || 50),
                      }))
                    }
                    className="mt-1.5 h-9 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm normal-case tracking-normal text-slate-700 outline-none transition focus:border-sky-300"
                  />
                </label>
                <label className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                  Tipo
                  <select
                    value={newBlockForm.taskType}
                    onChange={(event) =>
                      setNewBlockForm((state) => ({
                        ...state,
                        taskType: event.target.value as typeof state.taskType,
                      }))
                    }
                    className="mt-1.5 h-9 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm normal-case tracking-normal text-slate-700 outline-none transition focus:border-sky-300"
                  >
                    <option value="study">Estudo</option>
                    <option value="review">Revisão</option>
                    <option value="questions">Questões</option>
                    <option value="essay">Redação</option>
                    <option value="simulado">Simulado</option>
                  </select>
                </label>
                <button
                  type="button"
                  onClick={handleCreateManualBlock}
                  disabled={!newBlockForm.subjectId || scheduleSaving}
                  className={`${buttonPrimary} mt-auto`}
                >
                  Adicionar
                </button>
              </div>
            </div>

            <div className="space-y-4">
              {scheduleDayOptions.map((date, dayIndex) => {
                const dayItems = scheduleCards.filter((item) => item.study_date === date);
                const cardCycleDay = cycleDays[dayIndex % cycleDays.length]?.id ?? "A";
                const isActiveDay = date === activeCycleDate;

                return (
                  <section
                    key={date}
                    className={`rounded-3xl border p-3.5 ${
                      isActiveDay
                        ? "border-sky-200 bg-sky-50 shadow-sm shadow-sky-100"
                        : "border-slate-200 bg-slate-50/80"
                    }`}
                  >
                    <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div
                          className={`grid h-11 w-11 place-items-center rounded-2xl text-sm font-black ${
                            isActiveDay
                              ? "bg-sky-600 text-white"
                              : "bg-white text-slate-800 shadow-sm"
                          }`}
                        >
                          {cardCycleDay}
                        </div>
                        <div>
                          <h3 className="text-sm font-black text-slate-950">
                            Dia {cardCycleDay}
                          </h3>
                          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">
                            {date}
                          </p>
                        </div>
                      </div>
                      <Badge className={isActiveDay ? "bg-sky-600 text-white" : ""}>
                        {dayItems.length} bloco(s)
                      </Badge>
                    </div>

                    <div className="grid gap-3 md:grid-cols-2 2xl:grid-cols-3">
                      {dayItems.map((item) => {
                        const subject = planSubjects.find(
                          (candidate) => candidate.id === item.subject_id,
                        );
                        const topicTitle =
                          getEffectiveTopic(item.subject_id, item.topic_id)?.title ??
                          "Sem tópico vinculado";
                        const isSkipped = item.status === "skipped";

                        return (
                          <div
                            key={item.id}
                            className={`rounded-2xl border p-3.5 transition ${
                              isSkipped
                                ? "border-slate-200 bg-slate-100 opacity-75"
                                : "border-white bg-white hover:border-slate-200 hover:shadow-sm"
                            }`}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <div className="flex flex-wrap items-center gap-1.5">
                                  <Badge>ordem {item.sequence_number}</Badge>
                                  <Badge>{item.planned_minutes} min</Badge>
                                  {isSkipped && (
                                    <Badge className="bg-slate-300 text-slate-700">
                                      Pausado
                                    </Badge>
                                  )}
                                </div>
                                <h4 className="mt-2 truncate text-sm font-black text-slate-950">
                                  {subject?.name ?? "Disciplina"}
                                </h4>
                                <p className="mt-1 line-clamp-2 text-sm leading-5 text-slate-600">
                                  {topicTitle}
                                </p>
                              </div>
                              <div className="flex gap-1.5">
                                <IconActionButton
                                  title="Duplicar bloco"
                                  onClick={() =>
                                    createItem({
                                      studyDate: item.study_date,
                                      subjectId: item.subject_id ?? "",
                                      topicId: item.topic_id,
                                      plannedMinutes: item.planned_minutes,
                                      taskType: item.task_type,
                                    })
                                  }
                                  disabled={!item.subject_id}
                                  icon={<Plus />}
                                />
                                <IconActionButton
                                  title={isSkipped ? "Reativar bloco" : "Pausar bloco"}
                                  onClick={() =>
                                    updateItemStatus({
                                      itemId: item.id,
                                      status: isSkipped ? "planned" : "skipped",
                                    })
                                  }
                                  icon={isSkipped ? <PlayCircle /> : <PauseCircle />}
                                  variant={isSkipped ? "default" : "muted"}
                                />
                                <IconActionButton
                                  title="Excluir bloco"
                                  onClick={() => deleteItem(item.id)}
                                  icon={<Trash2 />}
                                  variant="danger"
                                />
                              </div>
                            </div>

                            <div className="mt-3 grid gap-2 md:grid-cols-2">
                              <label className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">
                                Disciplina
                                <select
                                  value={item.subject_id ?? ""}
                                  onChange={(event) =>
                                    updateItem({
                                      itemId: item.id,
                                      subjectId: event.target.value || null,
                                      topicId: null,
                                    })
                                  }
                                  className="mt-1.5 h-9 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm normal-case tracking-normal text-slate-700 outline-none transition focus:border-sky-300"
                                >
                                  <option value="">Sem disciplina</option>
                                  {subjects.map((subjectOption) => (
                                    <option key={subjectOption.id} value={subjectOption.id}>
                                      {subjectOption.name}
                                    </option>
                                  ))}
                                </select>
                              </label>
                              <label className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">
                                Tópico
                                <select
                                  value={item.topic_id ?? ""}
                                  onChange={(event) =>
                                    updateItem({
                                      itemId: item.id,
                                      topicId: event.target.value || null,
                                    })
                                  }
                                  className="mt-1.5 h-9 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm normal-case tracking-normal text-slate-700 outline-none transition focus:border-sky-300"
                                >
                                  <option value="">Automático</option>
                                  {topics
                                    .filter((topic) => topic.subject_id === item.subject_id)
                                    .map((topic) => (
                                      <option key={topic.id} value={topic.id}>
                                        {topic.title}
                                      </option>
                                    ))}
                                </select>
                              </label>
                            </div>

                            <div className="mt-3 grid grid-cols-4 gap-1.5">
                              <IconActionButton
                                title="Mover para dia anterior"
                                onClick={() =>
                                  moveItem({
                                    itemId: item.id,
                                    currentStudyDate: item.study_date,
                                    direction: "previous",
                                  })
                                }
                                icon={<ChevronLeft />}
                              />
                              <IconActionButton
                                title="Subir na ordem"
                                onClick={() =>
                                  reorderItem({
                                    itemId: item.id,
                                    currentStudyDate: item.study_date,
                                    direction: "up",
                                  })
                                }
                                icon={<ChevronUp />}
                              />
                              <IconActionButton
                                title="Descer na ordem"
                                onClick={() =>
                                  reorderItem({
                                    itemId: item.id,
                                    currentStudyDate: item.study_date,
                                    direction: "down",
                                  })
                                }
                                icon={<ChevronDown />}
                              />
                              <IconActionButton
                                title="Mover para próximo dia"
                                onClick={() =>
                                  moveItem({
                                    itemId: item.id,
                                    currentStudyDate: item.study_date,
                                    direction: "next",
                                  })
                                }
                                icon={<ChevronRight />}
                              />
                            </div>

                            <div className="mt-3 grid gap-2 md:grid-cols-[1fr_0.6fr_0.8fr]">
                              <label className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">
                                Dia
                                <select
                                  value={item.study_date}
                                  onChange={(event) =>
                                    updateItemPosition({
                                      itemId: item.id,
                                      targetStudyDate: event.target.value,
                                    })
                                  }
                                  className="mt-1.5 h-9 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm normal-case tracking-normal text-slate-700 outline-none transition focus:border-sky-300"
                                >
                                  {scheduleDayOptions.map((optionDate, optionIndex) => (
                                    <option key={optionDate} value={optionDate}>
                                      Dia {cycleDays[optionIndex % cycleDays.length]?.id ?? optionIndex + 1} - {optionDate}
                                    </option>
                                  ))}
                                </select>
                              </label>
                              <label className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">
                                Min
                                <input
                                  type="number"
                                  min={15}
                                  step={5}
                                  value={item.planned_minutes}
                                  onChange={(event) =>
                                    updateItem({
                                      itemId: item.id,
                                      plannedMinutes: Number(event.target.value || 50),
                                    })
                                  }
                                  className="mt-1.5 h-9 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm normal-case tracking-normal text-slate-700 outline-none transition focus:border-sky-300"
                                />
                              </label>
                              <label className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">
                                Tipo
                                <select
                                  value={item.task_type}
                                  onChange={(event) =>
                                    updateItem({
                                      itemId: item.id,
                                      taskType: event.target.value as typeof item.task_type,
                                    })
                                  }
                                  className="mt-1.5 h-9 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm normal-case tracking-normal text-slate-700 outline-none transition focus:border-sky-300"
                                >
                                  <option value="study">Estudo</option>
                                  <option value="review">Revisão</option>
                                  <option value="questions">Questões</option>
                                  <option value="essay">Redação</option>
                                  <option value="simulado">Simulado</option>
                                </select>
                              </label>
                            </div>

                            <p className="mt-2 text-xs uppercase tracking-[0.12em] text-slate-400">
                              {item.task_type} • score {item.priority_score}
                            </p>
                          </div>
                        );
                      })}

                      {dayItems.length === 0 && (
                        <div className="rounded-2xl border border-dashed border-slate-300 bg-white/70 px-4 py-8 text-center text-sm text-slate-500 md:col-span-2 2xl:col-span-3">
                          Nenhum bloco neste dia. Use o seletor dos cards para enviar blocos para cá.
                        </div>
                      )}
                    </div>
                  </section>
                );
              })}
            </div>

            {scheduleCards.length === 0 && (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
                Cadastre disciplinas e gere o cronograma para materializar a semana.
              </div>
            )}
          </Card>
          )}
          </div>
        </div>
      )}

      {activeView === "sessao" && (
        <div className="grid gap-5 xl:grid-cols-[0.82fr_1.18fr]">
          <Card className="overflow-hidden border-0 bg-[linear-gradient(180deg,#0f172a,#111827)] p-5 text-white shadow-[0_16px_34px_rgba(15,23,42,0.14)]">
            <div>
              <p className="text-xs uppercase tracking-[0.16em] text-cyan-200">
                Sessão ativa
              </p>
              <h2 className="mt-2 text-2xl font-black">
                {nextDiscipline?.name ?? "Nenhuma sessão pendente"}
              </h2>
              <p className="mt-2 text-sm text-slate-300">
                {nextPlannedItem
                  ? `Tópico: ${nextTopic?.title ?? "sem tópico vinculado"} • ${nextPlannedItem.planned_minutes} min planejados.`
                  : "Próximo bloco recomendado da fila do dia."}
              </p>
            </div>

            <div className="mt-5 rounded-2xl border border-white/10 bg-white/8 p-5 text-center">
              <p className="text-xs uppercase tracking-[0.16em] text-cyan-200">
                Cronômetro
              </p>
              <p className="mt-2 text-5xl font-black tracking-tight">
                {formatTimer(visibleTimerSeconds)}
              </p>
              <p className="mt-3 text-sm text-slate-300">
                Bloco sugerido de {nextPlannedItem?.planned_minutes ?? 50} min com pausa curta ao final.
              </p>
            </div>

            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              <button
                type="button"
                onClick={handleToggleTimer}
                disabled={!nextPlannedItem}
                className={`${buttonSlim} bg-white text-slate-950 hover:bg-slate-100`}
              >
                {timerRunning ? "Pausar foco" : "Iniciar foco"}
              </button>
              <button
                type="button"
                onClick={handleSubmitSessionExecution}
                disabled={!nextPlannedItem || sessionsSaving}
                className={buttonDarkGhost}
              >
                {sessionsSaving ? "Salvando..." : "Marcar concluída"}
              </button>
            </div>

            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => handleMovePlannedItem("previous")}
                disabled={!nextPlannedItem || scheduleSaving}
                className={buttonDarkGhost}
              >
                Mover para trás
              </button>
              <button
                type="button"
                onClick={() => handleMovePlannedItem("next")}
                disabled={!nextPlannedItem || scheduleSaving}
                className={buttonDarkGhost}
              >
                Mover para frente
              </button>
              <button
                type="button"
                onClick={handleResetTimer}
                disabled={!nextPlannedItem}
                className={buttonDarkGhost}
              >
                Reiniciar timer
              </button>
              <button
                type="button"
                onClick={handleSkipPlannedItem}
                disabled={!nextPlannedItem || scheduleSaving}
                className={buttonDarkGhost}
              >
                Pular bloco
              </button>
            </div>

            {sessionsError && (
              <div className="mt-4 rounded-2xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
                {sessionsError}
              </div>
            )}

            {sessionsLoading && (
              <div className="mt-4 rounded-2xl border border-white/10 bg-white/8 px-4 py-3 text-sm text-slate-300">
                Carregando execução do dia...
              </div>
            )}

            {nextPlannedItem && (
              <div className="mt-4 rounded-2xl border border-white/10 bg-white/8 p-3.5">
                <p className="text-xs uppercase tracking-[0.16em] text-cyan-200">
                  Bloco em execução
                </p>
                <p className="mt-2 text-sm text-slate-200">
                  Ciclo base {nextPlannedItem.study_date} • sequência {nextPlannedItem.sequence_number}
                </p>
                <p className="mt-1 text-sm text-slate-300">
                  Tipo {nextPlannedItem.task_type} • score {nextPlannedItem.priority_score}
                </p>
              </div>
            )}
          </Card>

          <Card className="border-0 bg-white/94 p-5 shadow-[0_16px_34px_rgba(15,23,42,0.055)]">
            <div className="mb-4">
              <h2 className="text-lg font-bold text-slate-950">Registro rápido da sessão</h2>
              <p className="mt-1 text-sm text-slate-500">
                Quando houver cronograma salvo, este registro alimenta `study_sessions`.
              </p>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <label className="text-sm text-slate-600">
                Disciplina
                <input
                  type="text"
                  value={nextDiscipline?.name ?? ""}
                  readOnly
                  className="mt-1.5 h-9 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm outline-none"
                  placeholder="Disciplina"
                />
              </label>
              <label className="text-sm text-slate-600">
                Tópico
                <input
                  type="text"
                  value={
                    nextTopic?.title ?? ""
                  }
                  readOnly
                  className="mt-1.5 h-9 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm outline-none"
                  placeholder="Tópico"
                />
              </label>
              <label className="text-sm text-slate-600">
                Tempo líquido
                <input
                  type="number"
                  value={sessionForm.netMinutes}
                  onChange={(event) =>
                    setSessionForm((state) => ({ ...state, netMinutes: event.target.value }))
                  }
                  className="mt-1.5 h-9 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-sky-300"
                  placeholder={String(nextPlannedItem?.planned_minutes ?? 50)}
                />
              </label>
              <label className="text-sm text-slate-600">
                Páginas lidas
                <input
                  type="number"
                  value={sessionForm.pagesRead}
                  onChange={(event) =>
                    setSessionForm((state) => ({ ...state, pagesRead: event.target.value }))
                  }
                  className="mt-1.5 h-9 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-sky-300"
                  placeholder="0"
                />
              </label>
              <label className="text-sm text-slate-600">
                Aulas assistidas
                <input
                  type="number"
                  value={sessionForm.lessonsWatched}
                  onChange={(event) =>
                    setSessionForm((state) => ({ ...state, lessonsWatched: event.target.value }))
                  }
                  className="mt-1.5 h-9 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-sky-300"
                  placeholder="0"
                />
              </label>
              <label className="text-sm text-slate-600">
                Questões resolvidas
                <input
                  type="number"
                  value={sessionForm.questionsAnswered}
                  onChange={(event) =>
                    setSessionForm((state) => ({
                      ...state,
                      questionsAnswered: event.target.value,
                    }))
                  }
                  className="mt-1.5 h-9 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-sky-300"
                  placeholder="0"
                />
              </label>
              <label className="text-sm text-slate-600">
                Acertos
                <input
                  type="number"
                  value={sessionForm.questionsCorrect}
                  onChange={(event) =>
                    setSessionForm((state) => ({
                      ...state,
                      questionsCorrect: event.target.value,
                    }))
                  }
                  className="mt-1.5 h-9 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-sky-300"
                  placeholder="0"
                />
              </label>
              <label className="text-sm text-slate-600">
                Erros
                <input
                  type="number"
                  value={sessionForm.questionsWrong}
                  onChange={(event) =>
                    setSessionForm((state) => ({
                      ...state,
                      questionsWrong: event.target.value,
                    }))
                  }
                  className="mt-1.5 h-9 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-sky-300"
                  placeholder="0"
                />
              </label>
              <label className="text-sm text-slate-600 md:col-span-2">
                Observações
                <textarea
                  value={sessionForm.notes}
                  onChange={(event) =>
                    setSessionForm((state) => ({ ...state, notes: event.target.value }))
                  }
                  className="mt-1.5 min-h-24 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-sky-300"
                  placeholder="Resumo da sessão, dúvidas e próximos passos"
                />
              </label>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={handleSubmitSessionExecution}
                disabled={!nextPlannedItem || sessionsSaving}
                className={buttonPrimary}
              >
                {sessionsSaving ? "Registrando..." : "Salvar sessão"}
              </button>
              <button
                type="button"
                onClick={resetSessionForm}
                className={buttonSecondary}
              >
                Limpar
              </button>
            </div>
          </Card>
        </div>
      )}

      {activeView === "revisoes" && (
        <Card className="border-0 bg-white/94 p-5 shadow-[0_16px_34px_rgba(15,23,42,0.055)]">
          <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-slate-950">Centro de revisões</h2>
              <p className="mt-1 text-sm text-slate-500">
                Separe o que é revisão por questões, o que é ficha de revisão acumulada e o que é revisão por espaçamento.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge className="bg-amber-100 text-amber-700">
                {questionReviewQueue.length} questão(ões)
              </Badge>
              <Badge className="bg-rose-100 text-rose-700">
                {openErrorNotebookEntries.length} registro(s)
              </Badge>
              <Badge className="bg-violet-100 text-violet-700">
                {reviewQueue.length} revisão(ões)
              </Badge>
            </div>
          </div>

          <div className="mb-4 flex flex-wrap gap-2">
            {(
              [
                ["questoes", "Questões"],
                ["caderno", "Caderno de erros"],
                ["teoria", "Fila teórica"],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setActiveReviewView(key)}
                className={
                  activeReviewView === key
                    ? buttonPrimary
                    : buttonSecondary
                }
              >
                {label}
              </button>
            ))}
          </div>

          {activeReviewView === "questoes" && (
            <div className="space-y-4">
              {(questionReviewError || (questionReviewLoading || questionReviewSaving)) && (
                <div
                  className={`rounded-2xl px-4 py-3 text-sm ${
                    questionReviewError
                      ? "border border-rose-200 bg-rose-50 text-rose-700"
                      : "bg-slate-100 font-medium text-slate-600"
                  }`}
                >
                  {questionReviewError || "Sincronizando revisões por questões..."}
                </div>
              )}

              <div className="grid gap-3 rounded-3xl border border-sky-100 bg-sky-50/80 p-4 text-sm text-slate-700 md:grid-cols-3">
                <div>
                  <p className="font-black text-slate-950">Regra operacional</p>
                  <p className="mt-1">Responder pelo menos 5 questões dos assuntos já estudados.</p>
                </div>
                <div>
                  <p className="font-black text-slate-950">Como funciona</p>
                  <p className="mt-1">A fila acumula sem prazo para você resolver no dia reservado para questões.</p>
                </div>
                <div>
                  <p className="font-black text-slate-950">Critério</p>
                  <p className="mt-1">Baixa taxa de acerto mantém a disciplina viva na fila.</p>
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {questionReviewQueue.map((task) => {
                  const draft = questionReviewDrafts[task.id] ?? { answered: "", correct: "" };

                  return (
                    <div
                      key={task.id}
                      className="rounded-2xl border border-slate-200 bg-slate-50/80 p-3.5"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <p className="font-semibold text-slate-900">
                          {task.topicTitle ?? task.subjectName}
                        </p>
                        <Badge>{task.minimum_questions} questões</Badge>
                      </div>
                      <p className="mt-2 text-sm text-slate-600">{task.subjectName}</p>
                      <p className="mt-1 text-sm text-slate-600">
                        Fila contínua de questões, sem vencimento.
                      </p>
                      <div className="mt-3 grid gap-2 sm:grid-cols-2">
                        <label className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">
                          Feitas
                          <input
                            type="number"
                            min={task.minimum_questions}
                            value={draft.answered}
                            onChange={(event) =>
                              setQuestionReviewDrafts((state) => ({
                                ...state,
                                [task.id]: {
                                  ...state[task.id],
                                  answered: event.target.value,
                                  correct: state[task.id]?.correct ?? "",
                                },
                              }))
                            }
                            className="mt-1.5 h-9 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-sky-300"
                            placeholder={String(task.minimum_questions)}
                          />
                        </label>
                        <label className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">
                          Acertos
                          <input
                            type="number"
                            min={0}
                            value={draft.correct}
                            onChange={(event) =>
                              setQuestionReviewDrafts((state) => ({
                                ...state,
                                [task.id]: {
                                  ...state[task.id],
                                  answered: state[task.id]?.answered ?? "",
                                  correct: event.target.value,
                                },
                              }))
                            }
                            className="mt-1.5 h-9 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-sky-300"
                            placeholder="0"
                          />
                        </label>
                      </div>
                      <div className="mt-3 flex gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            completeQuestionReview({
                              taskId: task.id,
                              questionsAnswered: Number(draft.answered || task.minimum_questions),
                              questionsCorrect: Number(draft.correct || 0),
                            })
                          }
                          className={buttonPrimary}
                        >
                          Concluir
                        </button>
                        <button
                          type="button"
                          onClick={() => removeQuestionReviewTask(task.id)}
                          className={buttonDanger}
                        >
                          Excluir
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              {questionReviewQueue.length === 0 && (
                <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
                  Nenhuma revisão por questões pendente.
                </div>
              )}
            </div>
          )}

          {activeReviewView === "caderno" && (
            <div className="space-y-4">
              {(errorNotebookError || (errorNotebookLoading || errorNotebookSaving)) && (
                <div
                  className={`rounded-2xl px-4 py-3 text-sm ${
                    errorNotebookError
                      ? "border border-rose-200 bg-rose-50 text-rose-700"
                      : "bg-slate-100 font-medium text-slate-600"
                  }`}
                >
                  {errorNotebookError || "Sincronizando caderno de revisão..."}
                </div>
              )}

              <div className="flex flex-wrap justify-end gap-2">
                <button type="button" onClick={handlePrintErrorNotebook} className={buttonSecondary}>
                  <Printer className="mr-1 h-4 w-4" />
                  Imprimir
                </button>
                <button type="button" onClick={handleExportErrorNotebookCsv} className={buttonSecondary}>
                  <Download className="mr-1 h-4 w-4" />
                  CSV
                </button>
                <button type="button" onClick={handleExportErrorNotebookPdf} className={buttonSecondary}>
                  <Download className="mr-1 h-4 w-4" />
                  PDF
                </button>
              </div>

              <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm shadow-slate-200/60">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-black text-slate-950">Caderno de revisão</p>
                    <p className="mt-1 text-xs text-slate-500">
                      Organize erros, regras, pegadinhas e comentários por disciplina e assunto para revisar como material próprio.
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2 text-xs text-slate-500">
                    <span className="rounded-full bg-slate-100 px-3 py-1">
                      {groupedErrorNotebookEntries.length} disciplina(s)
                    </span>
                    <span className="rounded-full bg-amber-50 px-3 py-1 text-amber-700">
                      {openErrorNotebookEntries.filter((entry) => entry.favorite).length} destaque(s)
                    </span>
                  </div>
                </div>
                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  <label className="text-sm text-slate-600">
                    Disciplina
                    <select
                      value={errorNotebookForm.subjectId}
                      onChange={(event) =>
                        setErrorNotebookForm((state) => ({
                          ...state,
                          subjectId: event.target.value,
                          topicId: "",
                        }))
                      }
                      className="mt-1.5 h-9 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-sky-300"
                    >
                      <option value="">Selecione</option>
                      {subjects.map((subject) => (
                        <option key={subject.id} value={subject.id}>
                          {subject.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="text-sm text-slate-600">
                    Tópico
                    <select
                      value={errorNotebookForm.topicId}
                      onChange={(event) =>
                        setErrorNotebookForm((state) => ({ ...state, topicId: event.target.value }))
                      }
                      className="mt-1.5 h-9 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-sky-300"
                    >
                      <option value="">Selecione</option>
                      {topics
                        .filter((topic) => topic.subject_id === errorNotebookForm.subjectId)
                        .map((topic) => (
                          <option key={topic.id} value={topic.id}>
                            {topic.title}
                          </option>
                        ))}
                    </select>
                  </label>
                  <label className="text-sm text-slate-600">
                    Tipo de registro
                    <select
                      value={errorNotebookForm.entryType}
                      onChange={(event) =>
                        setErrorNotebookForm((state) => ({
                          ...state,
                          entryType: event.target.value as
                            | "error"
                            | "rule"
                            | "insight"
                            | "trap"
                            | "commentary",
                        }))
                      }
                      className="mt-1.5 h-9 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-sky-300"
                    >
                      <option value="error">Erro</option>
                      <option value="rule">Regra</option>
                      <option value="insight">Insight</option>
                      <option value="trap">Pegadinha</option>
                      <option value="commentary">Comentário</option>
                    </select>
                  </label>
                  <label className="text-sm text-slate-600">
                    Origem
                    <select
                      value={errorNotebookForm.sourceKind}
                      onChange={(event) =>
                        setErrorNotebookForm((state) => ({
                          ...state,
                          sourceKind: event.target.value as
                            | "question"
                            | "class"
                            | "teacher_comment"
                            | "book"
                            | "manual"
                            | "mock_exam",
                        }))
                      }
                      className="mt-1.5 h-9 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-sky-300"
                    >
                      <option value="manual">Manual</option>
                      <option value="question">Questão</option>
                      <option value="class">Aula</option>
                      <option value="teacher_comment">Professor</option>
                      <option value="book">Material</option>
                      <option value="mock_exam">Simulado</option>
                    </select>
                  </label>
                  <label className="text-sm text-slate-600 md:col-span-2">
                    Referência
                    <input
                      type="text"
                      value={errorNotebookForm.sourceLabel}
                      onChange={(event) =>
                        setErrorNotebookForm((state) => ({ ...state, sourceLabel: event.target.value }))
                      }
                      className="mt-1.5 h-9 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-sky-300"
                      placeholder="Ex.: Q. 14 do PDF 3, Aula 07, comentário do professor"
                    />
                  </label>
                  <label className="text-sm text-slate-600 md:col-span-2">
                    Título curto
                    <input
                      type="text"
                      value={errorNotebookForm.title}
                      onChange={(event) =>
                        setErrorNotebookForm((state) => ({ ...state, title: event.target.value }))
                      }
                      className="mt-1.5 h-9 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-sky-300"
                      placeholder="Ex.: confundi competência privativa com concorrente"
                    />
                  </label>
                  <label className="text-sm text-slate-600 md:col-span-2">
                    Questão / contexto
                    <textarea
                      value={errorNotebookForm.promptSnapshot}
                      onChange={(event) =>
                        setErrorNotebookForm((state) => ({ ...state, promptSnapshot: event.target.value }))
                      }
                      className="mt-1.5 min-h-20 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-sky-300"
                      placeholder="Resumo da questão, pegadinha ou situação"
                    />
                  </label>
                  <label className="text-sm text-slate-600">
                    Motivo do erro
                    <textarea
                      value={errorNotebookForm.userErrorReason}
                      onChange={(event) =>
                        setErrorNotebookForm((state) => ({ ...state, userErrorReason: event.target.value }))
                      }
                      className="mt-1.5 min-h-20 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-sky-300"
                    />
                  </label>
                  <label className="text-sm text-slate-600">
                    Regra correta
                    <textarea
                      value={errorNotebookForm.correctReason}
                      onChange={(event) =>
                        setErrorNotebookForm((state) => ({ ...state, correctReason: event.target.value }))
                      }
                      className="mt-1.5 min-h-20 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-sky-300"
                    />
                  </label>
                  <label className="text-sm text-slate-600 md:col-span-2">
                    Como evitar
                    <textarea
                      value={errorNotebookForm.avoidanceNote}
                      onChange={(event) =>
                        setErrorNotebookForm((state) => ({ ...state, avoidanceNote: event.target.value }))
                      }
                      className="mt-1.5 min-h-20 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-sky-300"
                    />
                  </label>
                  <label className="text-sm text-slate-600">
                    Comentário do professor
                    <textarea
                      value={errorNotebookForm.teacherComment}
                      onChange={(event) =>
                        setErrorNotebookForm((state) => ({ ...state, teacherComment: event.target.value }))
                      }
                      className="mt-1.5 min-h-20 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-sky-300"
                      placeholder="Cole aqui a explicação, macete ou observação que vale revisar depois"
                    />
                  </label>
                  <label className="text-sm text-slate-600">
                    Nota de revisão
                    <textarea
                      value={errorNotebookForm.reviewNote}
                      onChange={(event) =>
                        setErrorNotebookForm((state) => ({ ...state, reviewNote: event.target.value }))
                      }
                      className="mt-1.5 min-h-20 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-sky-300"
                      placeholder="Sua síntese curta para bater o olho e lembrar rápido"
                    />
                  </label>
                </div>
                <div className="mt-4 flex gap-2">
                  <button type="button" onClick={handleCreateNotebookEntry} className={buttonPrimary}>
                    Salvar ficha
                  </button>
                </div>
              </div>

              <div className="space-y-3">
                {groupedErrorNotebookEntries.map((group) => {
                  const isExpanded = expandedNotebookSubjectIds.includes(group.subjectId);

                  return (
                    <div
                      key={group.subjectId}
                      className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-sm shadow-slate-200/60"
                    >
                      <button
                        type="button"
                        onClick={() =>
                          setExpandedNotebookSubjectIds((current) =>
                            current.includes(group.subjectId)
                              ? current.filter((subjectId) => subjectId !== group.subjectId)
                              : [...current, group.subjectId],
                          )
                        }
                        className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left transition hover:bg-slate-50"
                      >
                        <div>
                          <p className="text-sm font-black text-slate-950">{group.subjectName}</p>
                          <p className="mt-1 text-xs text-slate-500">
                            {group.totalEntries} ficha(s) • {group.favoriteCount} destaque(s)
                          </p>
                        </div>
                        <div className="flex items-center gap-2 text-slate-500">
                          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold">
                            {group.entries.filter((entry) => entry.entry_status === "open").length} abertas
                          </span>
                          {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                        </div>
                      </button>

                      {isExpanded && (
                        <div className="border-t border-slate-200 bg-slate-50/70 p-4">
                          <div className="space-y-3">
                            {group.entries.map((entry) => (
                              <article
                                key={entry.id}
                                className="rounded-2xl border border-slate-200 bg-white p-4"
                              >
                                <div className="flex items-start justify-between gap-3">
                                  <div>
                                    <div className="flex flex-wrap items-center gap-2">
                                      <p className="font-semibold text-slate-950">{entry.title}</p>
                                      <span className="rounded-full bg-sky-50 px-2.5 py-1 text-[11px] font-semibold text-sky-700">
                                        {entry.topicTitle}
                                      </span>
                                      <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-700">
                                        {getNotebookEntryTypeLabel(entry.entry_type)}
                                      </span>
                                      <span className="rounded-full bg-violet-50 px-2.5 py-1 text-[11px] font-semibold text-violet-700">
                                        {getNotebookSourceKindLabel(entry.source_kind)}
                                      </span>
                                    </div>
                                    <p className="mt-1 text-xs text-slate-500">
                                      Ocorrências: {entry.error_count} • Último registro em{" "}
                                      {format(parseISO(entry.last_error_at), "dd/MM")}
                                    </p>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      updateErrorNotebookEntry({
                                        entryId: entry.id,
                                        favorite: !entry.favorite,
                                      })
                                    }
                                    className={`rounded-full p-2 transition ${
                                      entry.favorite
                                        ? "bg-amber-50 text-amber-500"
                                        : "bg-slate-100 text-slate-400 hover:text-amber-500"
                                    }`}
                                    title="Marcar como destaque"
                                  >
                                    <Star className={`h-4 w-4 ${entry.favorite ? "fill-current" : ""}`} />
                                  </button>
                                </div>

                                {entry.prompt_snapshot && (
                                  <div className="mt-3 rounded-2xl bg-slate-50 px-3 py-2 text-sm text-slate-600">
                                    <strong className="text-slate-800">Contexto:</strong> {entry.prompt_snapshot}
                                  </div>
                                )}

                                {entry.source_label && (
                                  <div className="mt-3 rounded-2xl bg-indigo-50 px-3 py-2 text-sm text-indigo-900">
                                    <strong>Referência:</strong> {entry.source_label}
                                  </div>
                                )}

                                <div className="mt-3 grid gap-3 md:grid-cols-3">
                                  <div className="rounded-2xl bg-rose-50 px-3 py-3">
                                    <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-rose-700">
                                      Onde errei
                                    </p>
                                    <p className="mt-1 text-sm text-rose-900">
                                      {entry.user_error_reason || "-"}
                                    </p>
                                  </div>
                                  <div className="rounded-2xl bg-emerald-50 px-3 py-3">
                                    <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-emerald-700">
                                      Regra correta
                                    </p>
                                    <p className="mt-1 text-sm text-emerald-900">
                                      {entry.correct_reason || "-"}
                                    </p>
                                  </div>
                                  <div className="rounded-2xl bg-amber-50 px-3 py-3">
                                    <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-amber-700">
                                      Como evitar
                                    </p>
                                    <p className="mt-1 text-sm text-amber-900">
                                      {entry.avoidance_note || "-"}
                                    </p>
                                  </div>
                                </div>

                                <div className="mt-3 grid gap-3 md:grid-cols-2">
                                  <div className="rounded-2xl bg-blue-50 px-3 py-3">
                                    <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-blue-700">
                                      Comentário do professor
                                    </p>
                                    <p className="mt-1 text-sm text-blue-900">
                                      {entry.teacher_comment || "-"}
                                    </p>
                                  </div>
                                  <div className="rounded-2xl bg-slate-100 px-3 py-3">
                                    <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-slate-700">
                                      Nota de revisão
                                    </p>
                                    <p className="mt-1 text-sm text-slate-900">
                                      {entry.review_note || "-"}
                                    </p>
                                  </div>
                                </div>

                                <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
                                  <select
                                    value={entry.entry_status}
                                    onChange={(event) =>
                                      updateErrorNotebookEntry({
                                        entryId: entry.id,
                                        entryStatus: event.target.value as
                                          | "open"
                                          | "reviewing"
                                          | "mastered"
                                          | "archived",
                                      })
                                    }
                                    className="h-9 rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-sky-300"
                                  >
                                    <option value="open">Aberto</option>
                                    <option value="reviewing">Revisando</option>
                                    <option value="mastered">Dominado</option>
                                    <option value="archived">Arquivado</option>
                                  </select>
                                  <button
                                    type="button"
                                    onClick={() => removeErrorNotebookEntry(entry.id)}
                                    className={buttonDanger}
                                  >
                                    Excluir
                                  </button>
                                </div>
                              </article>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {openErrorNotebookEntries.length === 0 && (
                <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
                  Nenhuma ficha no caderno de revisão ainda.
                </div>
              )}
            </div>
          )}

          {activeReviewView === "teoria" && (
            <div className="space-y-4">
              {reviewsError && (
                <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                  {reviewsError}
                </div>
              )}

              {(reviewsLoading || reviewsSaving) && (
                <div className="rounded-2xl bg-slate-100 px-4 py-3 text-sm font-medium text-slate-600">
                  Sincronizando revisões...
                </div>
              )}

              <div className="grid gap-3 rounded-3xl border border-sky-100 bg-sky-50/80 p-4 text-sm text-slate-700 md:grid-cols-3">
                <div>
                  <p className="font-black text-slate-950">Modelo usado</p>
                  <p className="mt-1">
                    Fila inteligente: 24h, 7d, 30d, 60d e 90d, com exceções para falhas.
                  </p>
                </div>
                <div>
                  <p className="font-black text-slate-950">Como revisar</p>
                  <p className="mt-1">
                    Primeiro tente lembrar sem olhar. Depois confira, corrija e registre o resultado.
                  </p>
                </div>
                <div>
                  <p className="font-black text-slate-950">Ajuste automático</p>
                  <p className="mt-1">
                    Falha encurta para 1 dia; dificuldade vai para 3 dias; acerto espaça mais.
                  </p>
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {reviewQueue.map((item) => (
                  <div
                    key={item.itemId}
                    className="rounded-2xl border border-slate-200 bg-slate-50/80 p-3.5"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <p className="font-semibold text-slate-900">
                        {item.topicTitle ?? item.subjectName}
                      </p>
                      <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-800">
                        prioridade {item.priorityScore}
                      </span>
                    </div>
                    <p className="mt-2 text-sm text-slate-600">
                      {item.topicTitle ? item.subjectName : "Revisão geral da disciplina"}
                    </p>
                    <p className="mt-1 text-sm text-slate-600">
                      Próxima revisão: {new Date(item.nextReviewAt).toLocaleString("pt-BR")}
                    </p>
                    <p className="mt-1 text-sm text-slate-600">
                      Etapa programada: {item.nextStep + 1}
                    </p>
                    <div className="mt-3 grid gap-2 sm:grid-cols-2">
                      <button
                        type="button"
                        onClick={async () => {
                          await completeReview(item.itemId, "fail");
                          await syncReviewAnalytics({
                            sessionDate: safeCurrentDate,
                            subjectId: item.subjectId ?? null,
                            topicId: item.topicId ?? null,
                            outcome: "fail",
                          });
                        }}
                        className={buttonDanger}
                      >
                        Falhei
                      </button>
                      <button
                        type="button"
                        onClick={async () => {
                          await completeReview(item.itemId, "hard");
                          await syncReviewAnalytics({
                            sessionDate: safeCurrentDate,
                            subjectId: item.subjectId ?? null,
                            topicId: item.topicId ?? null,
                            outcome: "hard",
                          });
                        }}
                        className={buttonSecondary}
                      >
                        Difícil
                      </button>
                      <button
                        type="button"
                        onClick={async () => {
                          await completeReview(item.itemId, "good");
                          await syncReviewAnalytics({
                            sessionDate: safeCurrentDate,
                            subjectId: item.subjectId ?? null,
                            topicId: item.topicId ?? null,
                            outcome: "good",
                          });
                        }}
                        className={buttonPrimary}
                      >
                        Bom
                      </button>
                      <button
                        type="button"
                        onClick={async () => {
                          await completeReview(item.itemId, "easy");
                          await syncReviewAnalytics({
                            sessionDate: safeCurrentDate,
                            subjectId: item.subjectId ?? null,
                            topicId: item.topicId ?? null,
                            outcome: "easy",
                          });
                        }}
                        className={buttonSecondary}
                      >
                        Fácil
                      </button>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeReview(item.itemId)}
                      className={`mt-2 w-full ${buttonDanger}`}
                    >
                      Excluir revisão
                    </button>
                  </div>
                ))}
              </div>

              {reviewQueue.length === 0 && (
                <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
                  Nenhuma revisão teórica pendente.
                </div>
              )}
            </div>
          )}
        </Card>
      )}

      {activeView === "estatisticas" && (
        <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
          <Card className="border-0 bg-white/92 p-6 shadow-[0_18px_40px_rgba(15,23,42,0.06)]">
            <div className="mb-5">
              <h2 className="text-xl font-bold text-slate-900">Desempenho por disciplina</h2>
              <p className="mt-1 text-sm text-slate-500">
                Uma visão inicial de progresso, carga e acurácia.
              </p>
            </div>

            <div className="space-y-4">
              {subjectAccuracyRanking.map((subject) => (
                <div
                  key={subject.id}
                  className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-semibold text-slate-900">{subject.name}</p>
                    <Badge className="bg-slate-900 text-white">{subject.accuracy}%</Badge>
                  </div>
                  <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-200">
                    <div
                      className="h-full rounded-full bg-[linear-gradient(90deg,#0ea5e9,#22c55e)]"
                      style={{ width: `${subject.progressPercent}%` }}
                    />
                  </div>
                  <p className="mt-2 text-sm text-slate-600">
                    Progresso {subject.progressPercent}% • meta semanal {subject.weeklyTargetMinutes} min
                  </p>
                </div>
              ))}
            </div>
          </Card>

          <Card className="border-0 bg-white/92 p-6 shadow-[0_18px_40px_rgba(15,23,42,0.06)]">
            <div className="mb-5">
              <h2 className="text-xl font-bold text-slate-900">Leitura analítica</h2>
              <p className="mt-1 text-sm text-slate-500">
                Resumo do que deve virar heatmap, tendência e alertas no MVP.
              </p>
            </div>

            <div className="grid gap-4">
              <InsightCard
                title="Matérias em risco"
                body={
                  topRiskSubjects.length > 0
                    ? `${topRiskSubjects.join(" e ")} concentram mais necessidade de reforço no mapa de dificuldade.`
                    : "Ainda não há sinal suficiente para classificar matérias em risco."
                }
              />
              <InsightCard
                title="Retorno por disciplina"
                body={
                  topAdvanceSubjects.length > 0
                    ? `${topAdvanceSubjects.join(" e ")} aparecem com melhor potencial de avanço neste momento.`
                    : "O retorno por disciplina vai aparecer conforme o histórico real crescer."
                }
              />
              <InsightCard
                title="Ação sugerida"
                body={
                  reviewQueue.length > 0
                    ? `Há ${reviewQueue.length} revisão(ões) pendente(s). Priorize a fila antes de abrir muitos tópicos novos.`
                    : `A base está equilibrada, com acurácia global em ${globalAccuracy}%. Você pode avançar conteúdo novo sem pressionar a revisão.`
                }
              />
            </div>
          </Card>
        </div>
      )}

      {activeView === "perfil" && (
        <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
          <Card className="border-0 bg-white/92 p-6 shadow-[0_18px_40px_rgba(15,23,42,0.06)]">
            <div className="mb-5">
              <h2 className="text-xl font-bold text-slate-900">Perfil do plano</h2>
              <p className="mt-1 text-sm text-slate-500">
                Primeira camada do onboarding já conectada ao banco novo.
              </p>
            </div>

            <div className="grid gap-4">
              <label className="text-sm text-slate-600">
                E-mail da conta
                <input
                  type="email"
                  value={session.user.email || ""}
                  readOnly
                  className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-slate-500 outline-none"
                />
              </label>
              <label className="text-sm text-slate-600">
                Nome do usuário
                <input
                  type="text"
                  value={plannerSettings.userName}
                  onChange={(event) =>
                    updatePlannerSettings({ userName: event.target.value })
                  }
                  className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 outline-none"
                />
              </label>
              <label className="text-sm text-slate-600">
                Workspace
                <input
                  type="text"
                  value={plannerSettings.workspaceName}
                  onChange={(event) =>
                    updatePlannerSettings({ workspaceName: event.target.value })
                  }
                  className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 outline-none"
                />
              </label>
              <label className="text-sm text-slate-600">
                Nome do plano
                <input
                  type="text"
                  value={plannerSettings.examTitle}
                  onChange={(event) =>
                    updatePlannerSettings({ examTitle: event.target.value })
                  }
                  className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 outline-none"
                />
              </label>
              <label className="text-sm text-slate-600">
                Tipo de estudo
                <select
                  value={plannerSettings.studyType}
                  onChange={(event) =>
                    updatePlannerSettings({
                      studyType: event.target.value as typeof plannerSettings.studyType,
                    })
                  }
                  className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 outline-none"
                >
                  <option value="concurso">Concurso</option>
                  <option value="vestibular">Vestibular</option>
                  <option value="enem">ENEM</option>
                  <option value="faculdade">Faculdade</option>
                  <option value="livre">Livre</option>
                </select>
              </label>
              <label className="text-sm text-slate-600">
                Data alvo
                <input
                  type="date"
                  value={plannerSettings.examDate}
                  onChange={(event) =>
                    updatePlannerSettings({ examDate: event.target.value })
                  }
                  className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 outline-none"
                />
              </label>
              <label className="text-sm text-slate-600">
                Início do ciclo
                <input
                  type="date"
                  value={safePlanStartDate}
                  onChange={(event) =>
                    updatePlannerSettings({ planStartDate: event.target.value })
                  }
                  className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 outline-none"
                />
              </label>
              <label className="text-sm text-slate-600">
                Horas líquidas por dia
                <input
                  type="number"
                  min={1}
                  max={16}
                  step={0.5}
                  value={plannerSettings.dailyStudyHours}
                  onChange={(event) =>
                    updatePlannerSettings({
                      dailyStudyHours: Number(event.target.value || 0),
                    })
                  }
                  className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 outline-none"
                />
              </label>
              <label className="text-sm text-slate-600">
                Disciplinas por dia
                <input
                  type="number"
                  min={1}
                  max={10}
                  value={plannerSettings.disciplinesPerDay}
                  onChange={(event) =>
                    updatePlannerSettings({
                      disciplinesPerDay: Number(event.target.value || 1),
                    })
                  }
                  className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 outline-none"
                />
              </label>
            </div>

            {bootstrapError && (
              <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                {bootstrapError}
              </div>
            )}

            <div className="mt-5 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={handleSaveProfile}
                disabled={bootstrapSaving || bootstrapLoading}
                className="rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {bootstrapSaving ? "Salvando..." : "Salvar perfil e plano"}
              </button>
              {(bootstrapLoading || authLoading) && (
                <span className="inline-flex items-center rounded-2xl bg-slate-100 px-4 py-3 text-sm font-medium text-slate-600">
                  Sincronizando dados...
                </span>
              )}
            </div>
          </Card>

          <Card className="border-0 bg-white/92 p-6 shadow-[0_18px_40px_rgba(15,23,42,0.06)]">
            <div className="mb-5">
              <h2 className="text-xl font-bold text-slate-900">Onboarding e edital</h2>
              <p className="mt-1 text-sm text-slate-500">
                Feche o setup do plano e centralize o edital em um fluxo manual ou em uma importação por texto.
              </p>
            </div>

            <div className="grid gap-4">
              <div className="grid gap-3 md:grid-cols-3">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex items-center gap-3">
                    <div className="rounded-2xl bg-white p-2 text-slate-700 shadow-sm">
                      <Target className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-900">Setup</p>
                      <p className="text-xs text-slate-500">Base do plano</p>
                    </div>
                  </div>
                  <div className="mt-3 grid gap-2 text-sm text-slate-600">
                    <p>{plannerSettings.userName ? "1. Perfil definido" : "1. Defina seu perfil"}</p>
                    <p>{plannerSettings.examTitle ? "2. Plano nomeado" : "2. Nomeie seu plano"}</p>
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex items-center gap-3">
                    <div className="rounded-2xl bg-white p-2 text-slate-700 shadow-sm">
                      <BookOpenCheck className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-900">Biblioteca</p>
                      <p className="text-xs text-slate-500">Plano ativo</p>
                    </div>
                  </div>
                  <div className="mt-3 grid gap-2 text-sm text-slate-600">
                    <p>{subjects.length > 0 ? "3. Disciplinas cadastradas" : "3. Cadastre disciplinas"}</p>
                    <p>{topics.length > 0 ? "4. Tópicos vinculados" : "4. Estruture os tópicos"}</p>
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex items-center gap-3">
                    <div className="rounded-2xl bg-white p-2 text-slate-700 shadow-sm">
                      <FileText className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-900">Edital</p>
                      <p className="text-xs text-slate-500">Fonte central</p>
                    </div>
                  </div>
                  <div className="mt-3 grid gap-2 text-sm text-slate-600">
                    <p>{notices.length > 0 ? "5. Edital registrado" : "5. Registre o edital"}</p>
                    <p>
                      {notices.some((notice) => notice.source_type === "url")
                        ? "6. Origem por URL identificada"
                        : "6. URL opcional para referência"}
                    </p>
                  </div>
                </div>
              </div>

              <div className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
                <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">Cadastro do edital</p>
                      <p className="mt-1 text-sm text-slate-500">
                        Registre os metadados do edital e use a URL como referência pública.
                      </p>
                    </div>
                    <Badge className="bg-white text-slate-700 shadow-sm">Manual</Badge>
                  </div>

                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                    <label className="text-sm text-slate-600 md:col-span-2">
                      Título
                      <input
                        type="text"
                        value={noticeForm.title}
                        onChange={(event) =>
                          setNoticeForm((state) => ({ ...state, title: event.target.value }))
                        }
                        className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-3 py-2.5 outline-none ring-0 transition focus:border-slate-300"
                        placeholder="Ex.: TRT 2026"
                      />
                    </label>
                    <label className="text-sm text-slate-600">
                      Organização
                      <input
                        type="text"
                        value={noticeForm.organization}
                        onChange={(event) =>
                          setNoticeForm((state) => ({
                            ...state,
                            organization: event.target.value,
                          }))
                        }
                        className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-3 py-2.5 outline-none ring-0 transition focus:border-slate-300"
                        placeholder="Ex.: Tribunal Regional do Trabalho"
                      />
                    </label>
                    <label className="text-sm text-slate-600">
                      Data da prova
                      <input
                        type="date"
                        value={noticeForm.examDate}
                        onChange={(event) =>
                          setNoticeForm((state) => ({ ...state, examDate: event.target.value }))
                        }
                        className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-3 py-2.5 outline-none ring-0 transition focus:border-slate-300"
                      />
                    </label>
                    <label className="text-sm text-slate-600 md:col-span-2">
                      URL pública do edital
                      <input
                        type="url"
                        value={noticeForm.fileUrl}
                        onChange={(event) =>
                          setNoticeForm((state) => ({ ...state, fileUrl: event.target.value }))
                        }
                        className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-3 py-2.5 outline-none ring-0 transition focus:border-slate-300"
                        placeholder="https://..."
                      />
                    </label>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-3">
                    <button
                      type="button"
                      onClick={handleCreateNotice}
                      disabled={noticesSaving}
                      className="rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {noticesSaving ? "Salvando..." : "Salvar edital"}
                    </button>
                    {noticesLoading && (
                      <span className="inline-flex items-center rounded-2xl bg-slate-100 px-4 py-3 text-sm font-medium text-slate-600">
                        Carregando editais...
                      </span>
                    )}
                  </div>
                </div>

                <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">Importação por texto</p>
                      <p className="mt-1 text-sm text-slate-500">
                        Cole o conteúdo programático para criar disciplinas e tópicos automaticamente.
                      </p>
                    </div>
                    <Badge className="bg-white text-slate-700 shadow-sm">
                      <Sparkles className="mr-1 h-3.5 w-3.5" />
                      Parser local
                    </Badge>
                  </div>

                  <label className="mt-4 block text-sm text-slate-600">
                    Estrutura do edital
                    <textarea
                      value={noticeForm.rawText}
                      onChange={(event) =>
                        setNoticeForm((state) => ({ ...state, rawText: event.target.value }))
                      }
                      className="mt-2 min-h-[220px] w-full rounded-2xl border border-slate-200 bg-white px-3 py-3 outline-none ring-0 transition focus:border-slate-300"
                      placeholder={`Disciplina: Língua Portuguesa\n- Interpretação de textos\n- Ortografia\n\nDisciplina: Direito Constitucional\n- Direitos e garantias fundamentais\n- Organização do Estado`}
                    />
                  </label>

                  <div className="mt-4 rounded-2xl border border-dashed border-slate-300 bg-white/70 px-4 py-3 text-sm text-slate-500">
                    Use uma disciplina por bloco e liste os tópicos abaixo com hífen ou numeração. Se o título ficar vazio, o sistema usa o nome do plano.
                  </div>

                  <div className="mt-4 flex flex-wrap gap-3">
                    <button
                      type="button"
                      onClick={handleImportNoticeStructure}
                      disabled={importSaving || !workspace?.id || !plan?.id || !noticeForm.rawText.trim()}
                      className="rounded-2xl bg-sky-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-sky-500 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {importSaving ? "Importando..." : "Importar estrutura"}
                    </button>
                  </div>
                </div>
              </div>

              {(noticesError || importError) && (
                <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                  {noticesError || importError}
                </div>
              )}

              {authMessage && activeView === "perfil" && (
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                  {authMessage}
                </div>
              )}

              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-slate-900">Editais cadastrados</p>
                  <Badge className="bg-slate-900 text-white">{notices.length}</Badge>
                </div>
                <div className="space-y-3">
                  {notices.length === 0 && (
                    <p className="text-sm text-slate-500">
                      Nenhum edital salvo ainda.
                    </p>
                  )}
                  {notices.map((notice) => (
                    <div
                      key={notice.id}
                      className="rounded-xl border border-white bg-white px-3 py-3"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-semibold text-slate-900">{notice.title}</p>
                          <p className="mt-1 text-sm text-slate-600">
                            {notice.organization || "Organização não informada"}
                          </p>
                          <p className="mt-1 text-xs uppercase tracking-[0.14em] text-slate-400">
                            {notice.source_type} {notice.exam_date ? `• prova ${notice.exam_date}` : ""}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeNotice(notice.id)}
                          className="rounded-xl border border-rose-200 bg-white px-3 py-2 text-xs font-semibold text-rose-700 transition hover:bg-rose-50"
                        >
                          Excluir
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </Card>
        </div>
      )}
    </AppShell>
  );
}

function mapAuthError(message: string) {
  const normalized = message.toLowerCase();

  if (normalized.includes("invalid login credentials")) {
    return "Credenciais inválidas. Confira e-mail e senha.";
  }

  if (normalized.includes("email not confirmed")) {
    return "Seu e-mail ainda não foi confirmado.";
  }

  if (normalized.includes("user already registered")) {
    return "Já existe uma conta com esse e-mail.";
  }

  if (normalized.includes("signup is disabled")) {
    return "O cadastro por e-mail está desativado na autenticação.";
  }

  return message;
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function translateTopicStatus(
  value: "not_started" | "in_progress" | "reviewing" | "completed",
) {
  if (value === "completed") return "concluído";
  if (value === "reviewing") return "em revisão";
  if (value === "in_progress") return "em andamento";
  return "não iniciado";
}

type SubjectEmphasis = "very-low" | "low" | "normal" | "high" | "max";

function getSubjectEmphasisSettings(value: SubjectEmphasis) {
  if (value === "very-low") return { weight: 0.4, targetMinutes: 60 };
  if (value === "low") return { weight: 0.7, targetMinutes: 90 };
  if (value === "high") return { weight: 1.3, targetMinutes: 240 };
  if (value === "max") return { weight: 1.6, targetMinutes: 300 };
  return { weight: 1, targetMinutes: 180 };
}

function getSubjectEmphasisFromWeight(weight: number): SubjectEmphasis {
  if (weight <= 0.5) return "very-low";
  if (weight <= 0.85) return "low";
  if (weight >= 1.5) return "max";
  if (weight >= 1.15) return "high";
  return "normal";
}

function getSubjectEmphasisLabel(value: SubjectEmphasis) {
  if (value === "very-low") return "manutenção";
  if (value === "low") return "baixa ênfase";
  if (value === "high") return "alta ênfase";
  if (value === "max") return "ênfase máxima";
  return "ênfase normal";
}

function MetricCard({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon: ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-slate-500">{label}</p>
        {icon}
      </div>
      <p className="mt-2 text-2xl font-black text-slate-950">{value}</p>
    </div>
  );
}

function PlanMiniStat({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/8 px-3 py-3">
      <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">
        {label}
      </p>
      <p className="mt-1 text-lg font-black text-white">{value}</p>
    </div>
  );
}

function IconActionButton({
  title,
  icon,
  onClick,
  variant = "default",
  disabled = false,
}: {
  title: string;
  icon: ReactNode;
  onClick: () => void;
  variant?: "default" | "danger" | "muted";
  disabled?: boolean;
}) {
  const variantClass =
    variant === "danger"
      ? "border-rose-200 bg-white text-rose-700 hover:bg-rose-50"
      : variant === "muted"
        ? "border-slate-200 bg-slate-50 text-slate-500 hover:bg-slate-100"
        : "border-slate-200 bg-white text-slate-700 hover:border-sky-300 hover:bg-sky-50 hover:text-sky-700";

  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      onClick={onClick}
      disabled={disabled}
      className={`inline-grid h-9 w-9 place-items-center rounded-xl border transition disabled:cursor-not-allowed disabled:opacity-40 [&_svg]:h-4 [&_svg]:w-4 ${variantClass}`}
    >
      {icon}
    </button>
  );
}

function PlanCallout({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/6 p-4">
      <p className="text-sm font-semibold text-current">{title}</p>
      <p className="mt-1 text-sm text-slate-300">{body}</p>
    </div>
  );
}

function InsightCard({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <p className="text-sm font-semibold text-slate-900">{title}</p>
      <p className="mt-2 text-sm leading-6 text-slate-600">{body}</p>
    </div>
  );
}
