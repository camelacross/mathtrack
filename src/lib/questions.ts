import { SUBJECTS } from "../types";
import type { Filters, Question, QuestionDraft, QuestionStats } from "../types";

export const EMPTY_FILTERS: Filters = {
  query: "",
  year: "",
  subject: "",
  tag: "",
  status: "",
};

/** A local calendar date: UTC conversion would move dates near midnight. */
export function localDate(date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function filterQuestions(
  questions: Question[],
  filters: Filters,
): Question[] {
  const query = filters.query.trim().toLocaleLowerCase();
  return questions.filter((question) => {
    const searchable = [
      question.year,
      question.questionNumber,
      question.subject,
      ...question.tags,
      question.errorReason,
      question.notes,
      question.status,
    ]
      .join(" ")
      .toLocaleLowerCase();
    return (
      (!query || searchable.includes(query)) &&
      (!filters.year || String(question.year) === filters.year) &&
      (!filters.subject || question.subject === filters.subject) &&
      (!filters.tag || question.tags.includes(filters.tag)) &&
      (!filters.status || question.status === filters.status)
    );
  });
}

export function isDue(question: Question, today = localDate()): boolean {
  return question.reviewDate !== null && question.reviewDate <= today;
}

export function getReviewQuestions(
  questions: Question[],
  today = localDate(),
): Question[] {
  return questions
    .filter(
      (question) => question.status !== "已掌握" || isDue(question, today),
    )
    .sort(
      (a, b) =>
        Number(isDue(b, today)) - Number(isDue(a, today)) ||
        (a.reviewDate ?? "9999-12-31").localeCompare(
          b.reviewDate ?? "9999-12-31",
        ) ||
        b.year - a.year ||
        a.questionNumber.localeCompare(b.questionNumber, "zh-CN", {
          numeric: true,
        }),
    );
}

export function getStats(
  questions: Question[],
  today = localDate(),
): QuestionStats {
  const mastered = questions.filter(
    (question) => question.status === "已掌握",
  ).length;
  const tags = new Map<string, number>();
  const years = new Map<
    number,
    { year: number; count: number; mastered: number }
  >();
  for (const question of questions) {
    for (const tag of new Set(question.tags))
      tags.set(tag, (tags.get(tag) ?? 0) + 1);
    const year = years.get(question.year) ?? {
      year: question.year,
      count: 0,
      mastered: 0,
    };
    year.count += 1;
    year.mastered += Number(question.status === "已掌握");
    years.set(question.year, year);
  }
  return {
    total: questions.length,
    mastered,
    masteryRate: questions.length
      ? Math.round((mastered / questions.length) * 100)
      : 0,
    reviewCount: getReviewQuestions(questions, today).length,
    subjects: SUBJECTS.map((name) => ({
      name,
      count: questions.filter((question) => question.subject === name).length,
      mastered: questions.filter(
        (question) => question.subject === name && question.status === "已掌握",
      ).length,
    })),
    tags: [...tags.entries()]
      .map(([name, count]) => ({ name, count }))
      .sort(
        (a, b) => b.count - a.count || a.name.localeCompare(b.name, "zh-CN"),
      ),
    years: [...years.values()].sort((a, b) => b.year - a.year),
  };
}

export function createQuestion(draft: QuestionDraft): Question {
  const now = new Date().toISOString();
  return {
    ...draft,
    questionNumber: draft.questionNumber.trim(),
    tags: [...new Set(draft.tags.map((tag) => tag.trim()).filter(Boolean))],
    errorReason: draft.errorReason.trim(),
    notes: draft.notes.trim(),
    id: createId(),
    isDemo: false,
    createdAt: now,
    updatedAt: now,
  };
}

/** getRandomValues also works on local-network HTTP previews. */
function createId(): string {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (value) =>
    value.toString(16).padStart(2, "0"),
  ).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
