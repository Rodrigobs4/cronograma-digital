export type PhaseId = "fase1" | "fase2" | "fase3" | "fase4";
export type CycleDayId = "A" | "B" | "C" | "D" | "E" | "F";

export interface Discipline {
  id: string;
  name: string;
  shortName: string;
  emoji: string;
  estimatedQuestions: number;
  bankCount: number;
  type: "interpretacao" | "mista" | "decoreba" | "raciocinio";
  sessionsPerCycle: number;
  source?: "catalog" | "custom";
}

export interface CustomDiscipline extends Discipline {
  source: "custom";
  topics: string[];
}

export interface CatalogStatus {
  loading: boolean;
  source: "supabase" | "local";
  error: string | null;
}

export interface CycleDay {
  id: CycleDayId;
  sessions: string[];
}

export interface Phase {
  id: PhaseId;
  name: string;
  startDay: number;
  endDay: number;
  description: string;
}

export interface SessionStatus {
  disciplineId: string;
  done: boolean;
}

export interface DailyProgress {
  dayNumber: number;
  cycleDay: CycleDayId;
  sessions: SessionStatus[];
}

export interface TrackerEntry {
  dayNumber: number;
  cycleCompleted: boolean;
  disciplinesStudied: string;
  hoursInvested: string;
  observations: string;
}

export interface DisciplineProgress {
  disciplineId: string;
  currentCycle: number;
  skipCompletedTopics: boolean;
  notes: string;
  selectedTopic: string;
  customTopics: string[];
  masteryLevel: "nao_estudada" | "parcial" | "revisao";
}

export interface PlannerSettings {
  userName: string;
  workspaceName: string;
  examTitle: string;
  studyType: "concurso" | "vestibular" | "enem" | "faculdade" | "livre";
  examDate: string;
  planStartDate: string;
  dailyStudyHours: number;
  disciplinesPerDay: number;
  experienceLevel: "iniciante" | "intermediario" | "avancado";
}

export interface NewCustomDisciplineInput {
  name: string;
  shortName: string;
  emoji: string;
  estimatedQuestions: number;
  bankCount: number;
  type: Discipline["type"];
  sessionsPerCycle: number;
  topics: string[];
}

export interface PlanState {
  currentDate: string;
  completedSessions: string[];
  trackerEntries: Record<number, TrackerEntry>;
  disciplineProgress: Record<string, DisciplineProgress>;
  plannerSettings: PlannerSettings;
  customDisciplines: CustomDiscipline[];
  activeDisciplineIds: string[];
  setCurrentDate: (date: string) => void;
  toggleSession: (sessionKey: string) => void;
  updateTrackerEntry: (
    dayNumber: number,
    patch: Partial<Omit<TrackerEntry, "dayNumber">>,
  ) => void;
  updateDisciplineProgress: (
    disciplineId: string,
    patch: Partial<Omit<DisciplineProgress, "disciplineId">>,
  ) => void;
  updatePlannerSettings: (patch: Partial<PlannerSettings>) => void;
  toggleDisciplineActive: (disciplineId: string) => void;
  setActiveDisciplines: (disciplineIds: string[]) => void;
  setCustomDisciplines: (disciplines: CustomDiscipline[]) => void;
  setDisciplineProgressMap: (progress: Record<string, DisciplineProgress>) => void;
  setTrackerEntries: (entries: Record<number, TrackerEntry>) => void;
  addCustomDiscipline: (discipline: NewCustomDisciplineInput) => void;
  removeCustomDiscipline: (disciplineId: string) => void;
  addCustomTopic: (disciplineId: string, topic: string) => void;
}
