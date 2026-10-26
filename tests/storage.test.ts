import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { QuestionDraft } from "../src/types";
import { useQuestions } from "../src/hooks/useQuestions";
import { createQuestion } from "../src/lib/questions";
import { parseImport, serializeQuestions } from "../src/lib/importExport";
import { readQuestions, STORAGE_KEY, writeQuestions } from "../src/lib/storage";

const draft: QuestionDraft = {
  year: 2025,
  questionNumber: "17",
  subject: "高等数学",
  tags: ["定积分"],
  errorReason: "积分区间拆分错误",
  status: "未掌握",
  reviewDate: "2026-01-01",
  notes: "",
};

beforeEach(() => window.localStorage.clear());

describe("localStorage 安全持久化", () => {
  it("首次使用为空，不会静默写入演示数据", () => {
    const { result } = renderHook(() => useQuestions());
    expect(result.current.questions).toEqual([]);
    expect(result.current.error).toBeNull();
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it("保存完成后更新状态，并能从存储恢复全部字段", () => {
    const { result, unmount } = renderHook(() => useQuestions());
    act(() => expect(result.current.add(draft)).toBe(true));
    const saved = result.current.questions[0];
    expect(saved).toMatchObject(draft);
    expect(saved.isDemo).toBe(false);
    unmount();
    const reloaded = renderHook(() => useQuestions());
    expect(reloaded.result.current.questions).toEqual([saved]);
  });

  it("损坏的数据保持原样并阻止写入", () => {
    const broken = '{"version":1,"questions":"broken"}';
    localStorage.setItem(STORAGE_KEY, broken);
    const { result } = renderHook(() => useQuestions());
    expect(result.current.storageBlocked).toBe(true);
    expect(result.current.error).toContain("校验失败");
    act(() => expect(result.current.add(draft)).toBe(false));
    act(() => expect(result.current.loadDemo()).toBe(false));
    expect(localStorage.getItem(STORAGE_KEY)).toBe(broken);
    expect(result.current.questions).toEqual([]);
  });

  it("无法访问存储时安全返回只读错误", () => {
    const storage = {
      getItem: () => {
        throw new DOMException("Denied", "SecurityError");
      },
      setItem: vi.fn(),
    };
    expect(readQuestions(storage)).toMatchObject({
      questions: [],
      blocked: true,
    });
    expect(storage.setItem).not.toHaveBeenCalled();
  });

  it("存储满时不更新内存、不删除已有记录，恢复权限后可重试", () => {
    const original = createQuestion(draft);
    const raw = serializeQuestions([original]);
    localStorage.setItem(STORAGE_KEY, raw);
    const { result } = renderHook(() => useQuestions());
    const set = vi
      .spyOn(Storage.prototype, "setItem")
      .mockImplementation(() => {
        throw new DOMException("Full", "QuotaExceededError");
      });
    act(() => expect(result.current.remove(original.id)).toBe(false));
    expect(result.current.questions).toEqual([original]);
    expect(result.current.error).toContain("保存失败");
    expect(localStorage.getItem(STORAGE_KEY)).toBe(raw);
    set.mockRestore();
    act(() => expect(result.current.remove(original.id)).toBe(true));
    expect(result.current.questions).toEqual([]);
    expect(result.current.error).toBeNull();
  });

  it("检测其他页面的更新，避免使用旧快照覆盖记录", () => {
    const { result } = renderHook(() => useQuestions());
    const outside = serializeQuestions([createQuestion(draft)]);
    localStorage.setItem(STORAGE_KEY, outside);
    act(() =>
      expect(result.current.add({ ...draft, questionNumber: "18" })).toBe(
        false,
      ),
    );
    expect(localStorage.getItem(STORAGE_KEY)).toBe(outside);
    expect(result.current.storageBlocked).toBe(true);
    expect(result.current.error).toContain("其他页面");
  });

  it("接到其他标签页的 storage 事件后提示刷新", () => {
    const { result } = renderHook(() => useQuestions());
    act(() =>
      window.dispatchEvent(
        new StorageEvent("storage", { key: STORAGE_KEY, newValue: "new-data" }),
      ),
    );
    expect(result.current.storageBlocked).toBe(true);
    expect(result.current.error).toContain("刷新页面");
  });

  it("写入之前校验整个数据集，非法记录不会部分保存", () => {
    const question = createQuestion(draft);
    const setItem = vi.fn();
    const storage = { getItem: () => null, setItem };
    const result = writeQuestions(
      [question, { ...question, id: "bad", year: 1900 }],
      null,
      storage,
    );
    expect(result.ok).toBe(false);
    expect(setItem).not.toHaveBeenCalled();
  });
});

describe("错题操作", () => {
  it("编辑保留记录身份和演示标记，更新后可删除", () => {
    const { result } = renderHook(() => useQuestions());
    act(() => result.current.loadDemo());
    const original = result.current.questions[0];
    act(() =>
      expect(
        result.current.update(original.id, { ...draft, notes: "修改演示备注" }),
      ).toBe(true),
    );
    const updated = result.current.questions.find(
      (question) => question.id === original.id,
    );
    expect(updated).toMatchObject({
      id: original.id,
      createdAt: original.createdAt,
      isDemo: true,
      notes: "修改演示备注",
    });
    act(() => expect(result.current.remove(original.id)).toBe(true));
    expect(
      result.current.questions.some((question) => question.id === original.id),
    ).toBe(false);
  });

  it("复习完成时设置已掌握并清除到期日期", () => {
    const { result } = renderHook(() => useQuestions());
    act(() => result.current.add(draft));
    const id = result.current.questions[0].id;
    act(() => expect(result.current.setStatus(id, "巩固中")).toBe(true));
    expect(result.current.questions[0].reviewDate).toBe(draft.reviewDate);
    act(() => expect(result.current.setStatus(id, "已掌握")).toBe(true));
    expect(result.current.questions[0]).toMatchObject({
      status: "已掌握",
      reviewDate: null,
    });
  });

  it("导入同 ID 只跳过，保留已有内容并增加新记录", () => {
    const { result } = renderHook(() => useQuestions());
    act(() => result.current.add(draft));
    const original = result.current.questions[0];
    const incoming = createQuestion({ ...draft, questionNumber: "20" });
    act(() =>
      expect(
        result.current.importQuestions([
          { ...original, notes: "不应覆盖" },
          incoming,
        ]),
      ).toEqual({ added: 1, skipped: 1 }),
    );
    expect(result.current.questions).toEqual([original, incoming]);
  });

  it("演示数据重复加载不增加数量，移除演示不影响正式题目", () => {
    const { result } = renderHook(() => useQuestions());
    act(() => result.current.add(draft));
    const original = result.current.questions[0];
    act(() => result.current.loadDemo());
    expect(result.current.questions).toHaveLength(7);
    expect(
      result.current.questions.filter((question) => question.isDemo),
    ).toHaveLength(6);
    act(() => result.current.loadDemo());
    expect(result.current.questions).toHaveLength(7);
    act(() => result.current.removeDemo());
    expect(result.current.questions).toEqual([original]);
    const stored = parseImport(localStorage.getItem(STORAGE_KEY)!);
    expect(stored).toEqual({ ok: true, questions: [original] });
  });

  it("更新不存在的题目不写入存储", () => {
    const { result } = renderHook(() => useQuestions());
    act(() => expect(result.current.update("missing", draft)).toBe(false));
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
    expect(result.current.error).toContain("不存在");
  });
});
