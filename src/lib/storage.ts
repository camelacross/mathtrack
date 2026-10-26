import type { Question } from "../types";
import { parseImport, serializeQuestions } from "./importExport";

export const STORAGE_KEY = "mathtrack.v1";
export type StorageAccess = Pick<Storage, "getItem" | "setItem">;

export interface StorageSnapshot {
  questions: Question[];
  raw: string | null;
  error: string | null;
  blocked: boolean;
}

export type StorageWriteResult =
  | { ok: true; raw: string; questions: Question[] }
  | { ok: false; error: string; blocked: boolean };

export function readQuestions(storage?: StorageAccess): StorageSnapshot {
  try {
    const raw = (storage ?? window.localStorage).getItem(STORAGE_KEY);
    if (raw === null)
      return { questions: [], raw, error: null, blocked: false };
    const result = parseImport(raw);
    if (!result.ok) {
      return {
        questions: [],
        raw,
        blocked: true,
        error: `本地数据校验失败，已保留原始内容并暂停写入。${result.error} 请在「数据管理」导出本地原始备份后修复。`,
      };
    }
    return { questions: result.questions, raw, error: null, blocked: false };
  } catch {
    return {
      questions: [],
      raw: null,
      blocked: true,
      error:
        "无法访问浏览器本地存储，已暂停写入。请允许本站使用本地存储后刷新页面。",
    };
  }
}

/** Only update the visible state after this write succeeds. */
export function writeQuestions(
  questions: Question[],
  expectedRaw: string | null,
  storage?: StorageAccess,
): StorageWriteResult {
  try {
    const target = storage ?? window.localStorage;
    if (target.getItem(STORAGE_KEY) !== expectedRaw) {
      return {
        ok: false,
        blocked: true,
        error:
          "本地数据已在其他页面发生变化，本次操作未保存。请刷新页面加载最新数据后重试。",
      };
    }
    const raw = serializeQuestions(questions);
    const validation = parseImport(raw);
    if (!validation.ok)
      return {
        ok: false,
        blocked: false,
        error: `未保存：${validation.error}`,
      };
    target.setItem(STORAGE_KEY, raw);
    return { ok: true, raw, questions: validation.questions };
  } catch {
    return {
      ok: false,
      blocked: false,
      error:
        "保存失败，原有数据未改变。可能是浏览器存储空间不足或存储权限受限，请先导出备份后重试。",
    };
  }
}
