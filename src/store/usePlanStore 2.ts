import { differenceInCalendarDays, parseISO } from "date-fns";
import { cycleDays } from "../data/cycleDays";
import { phases } from "../data/phases";
import type { CycleDay, CycleDayId, Phase } from "../types";

export const PLAN_START = "2026-04-03";
export const EXAM_DATE = "2026-07-19";

export function getPlanDay(date: string): number {
  const rawDay =
    differenceInCalendarDays(parseISO(date), parseISO(PLAN_START)) + 1;
  return Math.min(Math.max(rawDay, 1), 90);
}

export function getCycleDay(dayNumber: number): CycleDayId {
  const safeDay = Math.min(Math.max(dayNumber, 1), 90);
  const sequence: CycleDayId[] = ["A", "B", "C", "D", "E", "F"];
  return sequence[(safeDay - 1) % 6];
}

export function getPhase(dayNumber: number): Phase {
  const safeDay = Math.min(Math.max(dayNumber, 1), 90);

  return (
    phases.find(
      (phase) => safeDay >= phase.startDay && safeDay <= phase.endDay,
    ) ?? phases[phases.length - 1]
  );
}

export function getTodayCycleSessions(dayNumber: number): CycleDay {
  const cycleDay = getCycleDay(dayNumber);
  const day = cycleDays.find((item) => item.id === cycleDay);

  if (!day) {
    return cycleDays[0];
  }

  return day;
}
