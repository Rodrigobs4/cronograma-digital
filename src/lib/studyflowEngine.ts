export type StudyDifficulty = "low" | "medium" | "high";
export type StudyType = "concurso" | "vestibular" | "enem" | "faculdade" | "livre";
export type TopicState = "not_started" | "in_progress" | "reviewing" | "completed";

export interface StudySubjectInput {
  id: string;
  name: string;
  priorityWeight: number;
  difficulty: StudyDifficulty;
  progressPercent: number;
  weeklyTargetMinutes: number;
  pendingReviews: number;
  overdueReviews: number;
}

export interface WeeklyAvailability {
  date: string;
  availableMinutes: number;
}

export interface ScheduleGenerationOptions {
  maxSubjectsPerDay?: number;
  preferredBlockMinutes?: number;
}

export interface PlannedStudyBlock {
  date: string;
  subjectId: string;
  plannedMinutes: number;
  recommendedMode: "study" | "review" | "questions";
  priorityScore: number;
}

export interface ReviewPresetStep {
  offsetHours?: number;
  offsetDays?: number;
}

export interface ReviewPreset {
  code: string;
  steps: ReviewPresetStep[];
}

export interface ReviewItemInput {
  itemId: string;
  lastStudiedAt: string;
  currentStep: number;
  easeFactor: number;
  accuracyPercent?: number;
  overdueCount?: number;
}

export interface ReviewRecommendation {
  itemId: string;
  nextReviewAt: string;
  nextStep: number;
  priorityScore: number;
}

function difficultyFactor(difficulty: StudyDifficulty) {
  if (difficulty === "high") return 1.3;
  if (difficulty === "low") return 0.9;
  return 1;
}

function progressFactor(progressPercent: number) {
  return 1 + Math.max(0, 100 - progressPercent) / 100;
}

function reviewPressure(subject: StudySubjectInput) {
  return 1 + subject.pendingReviews * 0.08 + subject.overdueReviews * 0.18;
}

function emphasisFactor(priorityWeight: number) {
  return Math.max(0.15, priorityWeight) ** 1.25;
}

export function computeSubjectPriority(subject: StudySubjectInput) {
  return (
    emphasisFactor(subject.priorityWeight) *
    difficultyFactor(subject.difficulty) *
    progressFactor(subject.progressPercent) *
    reviewPressure(subject)
  );
}

export function generateWeeklySchedule(
  subjects: StudySubjectInput[],
  availability: WeeklyAvailability[],
  options: ScheduleGenerationOptions = {},
) {
  if (subjects.length === 0) return [];

  const maxSubjectsPerDay = Math.max(1, options.maxSubjectsPerDay ?? 4);
  const preferredBlockMinutes = Math.min(
    180,
    Math.max(25, options.preferredBlockMinutes ?? 50),
  );

  const weighted = subjects.map((subject) => ({
    subject,
    score: computeSubjectPriority(subject),
    allocatedMinutes: 0,
  }));

  const totalScore = weighted.reduce((sum, item) => sum + item.score, 0) || 1;
  const output: PlannedStudyBlock[] = [];

  for (const day of availability) {
    let remainingMinutes = day.availableMinutes;
    const dailyUsed = new Set<string>();

    while (remainingMinutes >= 25 && dailyUsed.size < maxSubjectsPerDay) {
      const candidate = weighted
        .filter((item) => !dailyUsed.has(item.subject.id))
        .sort((left, right) => {
          const leftGap =
            (left.subject.weeklyTargetMinutes * left.score) / totalScore - left.allocatedMinutes;
          const rightGap =
            (right.subject.weeklyTargetMinutes * right.score) / totalScore - right.allocatedMinutes;

          if (leftGap !== rightGap) return rightGap - leftGap;
          return right.score - left.score;
        })[0];

      if (!candidate) break;

      const suggestedMinutes = Math.min(
        Math.max(Math.round(day.availableMinutes / maxSubjectsPerDay), 30),
        preferredBlockMinutes,
      );
      const plannedMinutes = Math.min(suggestedMinutes, remainingMinutes);
      const recommendedMode =
        candidate.subject.overdueReviews > 0
          ? "review"
          : candidate.subject.progressPercent >= 70
            ? "questions"
            : "study";

      output.push({
        date: day.date,
        subjectId: candidate.subject.id,
        plannedMinutes,
        recommendedMode,
        priorityScore: Number(candidate.score.toFixed(2)),
      });

      candidate.allocatedMinutes += plannedMinutes;
      dailyUsed.add(candidate.subject.id);
      remainingMinutes -= plannedMinutes;
    }
  }

  return output;
}

export function generateReviewRecommendations(
  items: ReviewItemInput[],
  preset: ReviewPreset,
) {
  return items.map<ReviewRecommendation>((item) => {
    const baseStep = preset.steps[item.currentStep] ?? preset.steps[preset.steps.length - 1];
    const baseDate = new Date(item.lastStudiedAt);
    const nextReviewDate = new Date(baseDate);

    if (baseStep?.offsetHours) {
      nextReviewDate.setHours(nextReviewDate.getHours() + baseStep.offsetHours);
    }

    if (baseStep?.offsetDays) {
      nextReviewDate.setDate(nextReviewDate.getDate() + baseStep.offsetDays);
    }

    const accuracyFactor = item.accuracyPercent == null ? 1 : (100 - item.accuracyPercent) / 100;
    const overdueFactor = item.overdueCount ?? 0;
    const priorityScore =
      1 + accuracyFactor * 2 + overdueFactor * 0.4 + Math.max(0, 2.6 - item.easeFactor);

    return {
      itemId: item.itemId,
      nextReviewAt: nextReviewDate.toISOString(),
      nextStep: Math.min(item.currentStep + 1, preset.steps.length - 1),
      priorityScore: Number(priorityScore.toFixed(2)),
    };
  });
}

export function inferTopicStatus(progressPercent: number, reviewCount: number): TopicState {
  if (progressPercent >= 90 && reviewCount >= 2) return "completed";
  if (progressPercent >= 60 || reviewCount >= 1) return "reviewing";
  if (progressPercent > 0) return "in_progress";
  return "not_started";
}
