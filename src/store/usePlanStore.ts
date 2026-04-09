import { create } from "zustand";
import { persist } from "zustand/middleware";
import type {
  DisciplineProgress,
  NewCustomDisciplineInput,
  PlanState,
  TrackerEntry,
} from "../types";

function getTodayISODate() {
  return new Date().toISOString().slice(0, 10);
}

function createDefaultPlannerSettings() {
  const today = getTodayISODate();

  return {
    userName: "Seu perfil",
    workspaceName: "Workspace principal",
    examTitle: "PMAL 2026",
    studyType: "concurso" as const,
    examDate: "2026-07-19",
    planStartDate: today,
    dailyStudyHours: 4,
    disciplinesPerDay: 4,
    experienceLevel: "intermediario" as const,
  };
}

function createDefaultTrackerEntry(dayNumber: number): TrackerEntry {
  return {
    dayNumber,
    cycleCompleted: false,
    disciplinesStudied: "",
    hoursInvested: "",
    observations: "",
  };
}

function createDefaultDisciplineProgress(
  disciplineId: string,
): DisciplineProgress {
  return {
    disciplineId,
    currentCycle: 1,
    skipCompletedTopics: false,
    notes: "",
    selectedTopic: "",
    customTopics: [],
    masteryLevel: "nao_estudada",
  };
}

function slugifyDisciplineName(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function createCustomDiscipline(input: NewCustomDisciplineInput) {
  const slugBase = slugifyDisciplineName(input.name) || "disciplina";

  return {
    id: `custom_${slugBase}`,
    name: input.name.trim(),
    shortName: input.shortName.trim() || input.name.trim(),
    emoji: input.emoji.trim() || "📘",
    estimatedQuestions: input.estimatedQuestions,
    bankCount: input.bankCount,
    type: input.type,
    sessionsPerCycle: input.sessionsPerCycle,
    topics: input.topics.filter(Boolean),
    source: "custom" as const,
  };
}

export const usePlanStore = create<PlanState>()(
  persist(
    (set) => ({
      currentDate: getTodayISODate(),
      completedSessions: [],
      trackerEntries: {},
      disciplineProgress: {},
      plannerSettings: createDefaultPlannerSettings(),
      customDisciplines: [],
      activeDisciplineIds: [],
      setCurrentDate: (date) => set({ currentDate: date }),
      toggleSession: (sessionKey) =>
        set((state) => {
          const alreadyCompleted = state.completedSessions.includes(sessionKey);

          return {
            completedSessions: alreadyCompleted
              ? state.completedSessions.filter((item) => item !== sessionKey)
              : [...state.completedSessions, sessionKey],
          };
        }),
      updateTrackerEntry: (dayNumber, patch) =>
        set((state) => ({
          trackerEntries: {
            ...state.trackerEntries,
            [dayNumber]: {
              ...(state.trackerEntries[dayNumber] ??
                createDefaultTrackerEntry(dayNumber)),
              ...patch,
            },
          },
        })),
      updateDisciplineProgress: (disciplineId, patch) =>
        set((state) => ({
          disciplineProgress: {
            ...state.disciplineProgress,
            [disciplineId]: {
              ...(state.disciplineProgress[disciplineId] ??
                createDefaultDisciplineProgress(disciplineId)),
              ...patch,
            },
          },
        })),
      updatePlannerSettings: (patch) =>
        set((state) => ({
          plannerSettings: {
            ...state.plannerSettings,
            ...patch,
          },
        })),
      toggleDisciplineActive: (disciplineId) =>
        set((state) => {
          const isActive = state.activeDisciplineIds.includes(disciplineId);

          return {
            activeDisciplineIds: isActive
              ? state.activeDisciplineIds.filter((item) => item !== disciplineId)
              : [...state.activeDisciplineIds, disciplineId],
          };
        }),
      setActiveDisciplines: (disciplineIds) =>
        set({
          activeDisciplineIds: Array.from(new Set(disciplineIds)),
        }),
      setCustomDisciplines: (disciplines) =>
        set({
          customDisciplines: disciplines,
        }),
      setDisciplineProgressMap: (progress) =>
        set({
          disciplineProgress: progress,
        }),
      setTrackerEntries: (entries) =>
        set({
          trackerEntries: entries,
        }),
      addCustomDiscipline: (discipline) =>
        set((state) => {
          const customDiscipline = createCustomDiscipline(discipline);
          const alreadyExists = state.customDisciplines.some(
            (item) => item.id === customDiscipline.id,
          );

          if (alreadyExists) {
            return state;
          }

          return {
            customDisciplines: [...state.customDisciplines, customDiscipline],
            activeDisciplineIds: [...state.activeDisciplineIds, customDiscipline.id],
            disciplineProgress: {
              ...state.disciplineProgress,
              [customDiscipline.id]:
                state.disciplineProgress[customDiscipline.id] ??
                createDefaultDisciplineProgress(customDiscipline.id),
            },
          };
        }),
      removeCustomDiscipline: (disciplineId) =>
        set((state) => {
          const nextProgress = { ...state.disciplineProgress };
          delete nextProgress[disciplineId];

          return {
            customDisciplines: state.customDisciplines.filter(
              (discipline) => discipline.id !== disciplineId,
            ),
            activeDisciplineIds: state.activeDisciplineIds.filter(
              (item) => item !== disciplineId,
            ),
            disciplineProgress: nextProgress,
          };
        }),
      addCustomTopic: (disciplineId, topic) =>
        set((state) => {
          const normalizedTopic = topic.trim();

          if (!normalizedTopic) {
            return state;
          }

          const current =
            state.disciplineProgress[disciplineId] ??
            createDefaultDisciplineProgress(disciplineId);

          const customTopics = current.customTopics.includes(normalizedTopic)
            ? current.customTopics
            : [...current.customTopics, normalizedTopic];

          return {
            disciplineProgress: {
              ...state.disciplineProgress,
              [disciplineId]: {
                ...current,
                customTopics,
                selectedTopic: normalizedTopic,
              },
            },
          };
        }),
    }),
    {
      name: "pmal-plan-store",
    },
  ),
);
