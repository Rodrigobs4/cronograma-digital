import { addDays, differenceInCalendarDays, format, parseISO } from "date-fns";
import { cycleDays } from "../data/cycleDays";
import { phases } from "../data/phases";
import type { CycleDay, CycleDayId, Phase } from "../types";

export const PLAN_START = "2026-04-03";
export const EXAM_DATE = "2026-07-19";

interface PlanOptions {
  cycleDays?: CycleDay[];
  startDate?: string;
  totalDays?: number;
}

function getSafeTotalDays(totalDays = 90) {
  return Math.max(totalDays, 1);
}

export function getAdaptivePhases(totalDays = 90): Phase[] {
  const safeTotalDays = getSafeTotalDays(totalDays);
  const phaseEndPoints = [42, 72, 84, 90].map((value) =>
    Math.min(safeTotalDays, Math.max(1, Math.round((value / 90) * safeTotalDays))),
  );

  return phases.map((phase, index) => {
    const startDay = index === 0 ? 1 : phaseEndPoints[index - 1] + 1;
    const endDay = index === phases.length - 1 ? safeTotalDays : phaseEndPoints[index];

    return {
      ...phase,
      startDay,
      endDay: Math.max(startDay, endDay),
    };
  });
}

export function getPlanDay(date: string, options: PlanOptions = {}): number {
  const startDate = options.startDate ?? PLAN_START;
  const totalDays = getSafeTotalDays(options.totalDays);
  const rawDay =
    differenceInCalendarDays(parseISO(date), parseISO(startDate)) + 1;

  return Math.min(Math.max(rawDay, 1), totalDays);
}

export function getCycleDay(dayNumber: number, options: PlanOptions = {}): CycleDayId {
  const totalDays = getSafeTotalDays(options.totalDays);
  const safeDay = Math.min(Math.max(dayNumber, 1), totalDays);
  const sequence = (options.cycleDays ?? cycleDays).map((item) => item.id) as CycleDayId[];

  if (sequence.length === 0) {
    return "A";
  }

  return sequence[(safeDay - 1) % sequence.length];
}

export function getPhase(dayNumber: number, options: PlanOptions = {}): Phase {
  const totalDays = getSafeTotalDays(options.totalDays);
  const safeDay = Math.min(Math.max(dayNumber, 1), totalDays);
  const scaledPhases = getAdaptivePhases(totalDays);

  return (
    scaledPhases.find((phase) => safeDay >= phase.startDay && safeDay <= phase.endDay) ??
    scaledPhases[scaledPhases.length - 1]
  );
}

export function getTodayCycleSessions(dayNumber: number, options: PlanOptions = {}): CycleDay {
  const sourceCycleDays = options.cycleDays ?? cycleDays;
  const cycleDay = getCycleDay(dayNumber, options);
  const day = sourceCycleDays.find((item) => item.id === cycleDay);

  if (!day) {
    return sourceCycleDays[0] ?? { id: "A", sessions: [] };
  }

  return day;
}

export function getCycleNumber(dayNumber: number) {
  return Math.floor((dayNumber - 1) / 6) + 1;
}

export function getPlanDate(dayNumber: number, startDate = PLAN_START) {
  return addDays(parseISO(startDate), dayNumber - 1);
}

export function formatPlanDate(dayNumber: number, startDate = PLAN_START) {
  return format(getPlanDate(dayNumber, startDate), "dd/MM/yyyy");
}

export function getPlannedSessions(dayNumber: number, options: PlanOptions = {}) {
  return getTodayCycleSessions(dayNumber, options).sessions;
}

export function getPlanDays(options: PlanOptions = {}) {
  const totalDays = getSafeTotalDays(options.totalDays);
  const startDate = options.startDate ?? PLAN_START;

  return Array.from({ length: totalDays }, (_, index) => {
    const dayNumber = index + 1;

    return {
      dayNumber,
      date: formatPlanDate(dayNumber, startDate),
      cycleNumber: getCycleNumber(dayNumber),
      cycleDay: getCycleDay(dayNumber, options),
      phase: getPhase(dayNumber, options),
      sessions: getPlannedSessions(dayNumber, options),
    };
  });
}
