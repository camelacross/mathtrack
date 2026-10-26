export const SUBJECTS = ["高等数学", "线性代数", "概率论与数理统计"] as const;
export const STATUSES = ["未掌握", "巩固中", "已掌握"] as const;
export type Subject = (typeof SUBJECTS)[number];
export type MasteryStatus = (typeof STATUSES)[number];

export interface Question {
  id: string;
  year: number;
  questionNumber: string;
  subject: Subject;
  tags: string[];
  errorReason: string;
  status: MasteryStatus;
  reviewDate: string | null;
  notes: string;
  isDemo: boolean;
  createdAt: string;
  updatedAt: string;
}

export type QuestionDraft = Omit<
  Question,
  "id" | "createdAt" | "updatedAt" | "isDemo"
>;
export interface Filters {
  query: string;
  year: string;
  subject: Subject | "";
  tag: string;
  status: MasteryStatus | "";
}
export interface ExportData {
  version: 1;
  exportedAt: string;
  questions: Question[];
}
export interface QuestionStats {
  total: number;
  mastered: number;
  masteryRate: number;
  reviewCount: number;
  subjects: { name: Subject; count: number; mastered: number }[];
  tags: { name: string; count: number }[];
  years: { year: number; count: number; mastered: number }[];
}
