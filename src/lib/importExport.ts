import { STATUSES, SUBJECTS } from "../types";
import type { ExportData, Question } from "../types";

export const MAX_IMPORT_BYTES = 5 * 1024 * 1024;
export const MAX_QUESTIONS = 10_000;
export type ImportResult =
  | { ok: true; questions: Question[] }
  | { ok: false; error: string };

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function isValidDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value))
    return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return (
    Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value
  );
}

function isTimestamp(value: unknown): value is string {
  if (
    typeof value !== "string" ||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/.test(
      value,
    )
  )
    return false;
  if (!isValidDate(value.slice(0, 10))) return false;
  // Date.parse accepts 24:00:00 by rolling to the next day; keep actual clock times only.
  if (
    Number(value.slice(11, 13)) > 23 ||
    Number(value.slice(14, 16)) > 59 ||
    Number(value.slice(17, 19)) > 59
  )
    return false;
  return Number.isFinite(Date.parse(value));
}

function requiredString(value: unknown, max: number): value is string {
  return (
    typeof value === "string" && value.trim().length > 0 && value.length <= max
  );
}

function parseQuestion(value: unknown, index: number): Question {
  const prefix = `第 ${index + 1} 条记录`;
  if (!isObject(value)) throw new Error(`${prefix}必须是对象。`);
  if (!requiredString(value.id, 100))
    throw new Error(`${prefix}的 ID 无效（须为 1–100 字符）。`);
  if (
    typeof value.year !== "number" ||
    !Number.isInteger(value.year) ||
    value.year < 1987 ||
    value.year > 2100
  )
    throw new Error(`${prefix}的年份须为 1987–2100 的整数。`);
  if (!requiredString(value.questionNumber, 64))
    throw new Error(`${prefix}的题号须为 1–64 字符。`);
  if (
    typeof value.subject !== "string" ||
    !(SUBJECTS as readonly string[]).includes(value.subject)
  )
    throw new Error(`${prefix}的科目无效。`);
  if (
    !Array.isArray(value.tags) ||
    value.tags.length > 20 ||
    !value.tags.every((tag) => requiredString(tag, 40))
  )
    throw new Error(
      `${prefix}的知识点须为最多 20 个标签，每个标签 1–40 字符。`,
    );
  if (!requiredString(value.errorReason, 2000))
    throw new Error(`${prefix}的错误原因须为 1–2000 字符。`);
  if (
    typeof value.status !== "string" ||
    !(STATUSES as readonly string[]).includes(value.status)
  )
    throw new Error(`${prefix}的掌握状态无效。`);
  if (value.reviewDate !== null && !isValidDate(value.reviewDate))
    throw new Error(`${prefix}的复做日期须为真实的 YYYY-MM-DD 日期或 null。`);
  if (typeof value.notes !== "string" || value.notes.length > 10_000)
    throw new Error(`${prefix}的备注须为不超过 10000 字符的文本。`);
  if (typeof value.isDemo !== "boolean")
    throw new Error(`${prefix}的演示标记须为布尔值。`);
  if (!isTimestamp(value.createdAt) || !isTimestamp(value.updatedAt))
    throw new Error(`${prefix}的创建或更新时间须为有效 ISO 时间戳。`);

  // Reconstruct fields explicitly so unknown input keys never enter application state.
  return {
    id: value.id.trim(),
    year: value.year,
    questionNumber: value.questionNumber.trim(),
    subject: value.subject as Question["subject"],
    tags: [...new Set((value.tags as string[]).map((tag) => tag.trim()))],
    errorReason: value.errorReason.trim(),
    status: value.status as Question["status"],
    reviewDate: value.reviewDate,
    notes: value.notes,
    isDemo: value.isDemo,
    createdAt: value.createdAt,
    updatedAt: value.updatedAt,
  };
}

export function parseImport(text: string): ImportResult {
  if (
    text.length > MAX_IMPORT_BYTES ||
    new TextEncoder().encode(text).byteLength > MAX_IMPORT_BYTES
  ) {
    return { ok: false, error: "文件超过 5 MiB，请拆分后导入。" };
  }
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return {
      ok: false,
      error: "无法解析 JSON，请选择 MathTrack 导出的 JSON 文件。",
    };
  }
  if (
    !isObject(data) ||
    data.version !== 1 ||
    !isTimestamp(data.exportedAt) ||
    !Array.isArray(data.questions)
  ) {
    return {
      ok: false,
      error:
        "格式不正确：需要 version: 1、有效的 exportedAt 时间戳和 questions 数组。",
    };
  }
  if (data.questions.length > MAX_QUESTIONS)
    return { ok: false, error: "单次最多导入 10000 条记录。" };
  try {
    const ids = new Set<string>();
    const questions = data.questions.map((value, index) => {
      const question = parseQuestion(value, index);
      if (ids.has(question.id))
        throw new Error(`第 ${index + 1} 条记录的 ID 重复，请修正文件后重试。`);
      ids.add(question.id);
      return question;
    });
    return { ok: true, questions };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "导入数据无效。",
    };
  }
}

export function serializeQuestions(questions: Question[]): string {
  const data: ExportData = {
    version: 1,
    exportedAt: new Date().toISOString(),
    questions,
  };
  return JSON.stringify(data, null, 2);
}

/** Existing IDs always win, including when incoming content has changed. */
export function mergeQuestions(
  existing: Question[],
  incoming: Question[],
): { questions: Question[]; added: number; skipped: number } {
  const ids = new Set(existing.map((question) => question.id));
  const additions: Question[] = [];
  for (const question of incoming) {
    if (ids.has(question.id)) continue;
    ids.add(question.id);
    additions.push(question);
  }
  return {
    questions: [...existing, ...additions],
    added: additions.length,
    skipped: incoming.length - additions.length,
  };
}
