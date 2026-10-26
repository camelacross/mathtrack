import { useEffect, useRef, useState } from "react";
import type { MasteryStatus, Question, QuestionDraft } from "../types";
import { createQuestion } from "../lib/questions";
import { createDemoQuestions } from "../lib/demo";
import { mergeQuestions } from "../lib/importExport";
import { readQuestions, STORAGE_KEY, writeQuestions } from "../lib/storage";

export function useQuestions() {
  const [initial] = useState(() => readQuestions());
  const snapshot = useRef(initial);
  const [questions, setQuestions] = useState(initial.questions);
  const [error, setError] = useState<string | null>(initial.error);
  const [storageBlocked, setStorageBlocked] = useState(initial.blocked);

  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (
        (event.key === STORAGE_KEY || event.key === null) &&
        event.newValue !== snapshot.current.raw
      ) {
        snapshot.current.blocked = true;
        setStorageBlocked(true);
        setError(
          "本地数据已在其他页面发生变化。请刷新页面加载最新数据后继续操作。",
        );
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const persist = (next: Question[]): boolean => {
    if (snapshot.current.blocked) return false;
    const result = writeQuestions(next, snapshot.current.raw);
    if (!result.ok) {
      snapshot.current.blocked = result.blocked;
      setStorageBlocked(result.blocked);
      setError(result.error);
      return false;
    }
    snapshot.current = {
      questions: result.questions,
      raw: result.raw,
      error: null,
      blocked: false,
    };
    setQuestions(result.questions);
    setError(null);
    return true;
  };

  const update = (id: string, draft: QuestionDraft): boolean => {
    if (!snapshot.current.questions.some((question) => question.id === id)) {
      setError("这道题已不存在，请刷新页面后重试。");
      return false;
    }
    return persist(
      snapshot.current.questions.map((question) =>
        question.id === id
          ? { ...question, ...draft, updatedAt: new Date().toISOString() }
          : question,
      ),
    );
  };

  const importQuestions = (incoming: Question[]) => {
    const merged = mergeQuestions(snapshot.current.questions, incoming);
    if (!persist(merged.questions)) return null;
    return { added: merged.added, skipped: merged.skipped };
  };

  return {
    questions,
    error,
    storageBlocked,
    add: (draft: QuestionDraft) =>
      persist([...snapshot.current.questions, createQuestion(draft)]),
    update,
    remove: (id: string) =>
      persist(
        snapshot.current.questions.filter((question) => question.id !== id),
      ),
    setStatus: (id: string, status: MasteryStatus) => {
      const question = snapshot.current.questions.find(
        (item) => item.id === id,
      );
      if (!question) {
        setError("这道题已不存在，请刷新页面后重试。");
        return false;
      }
      return update(id, {
        ...question,
        status,
        reviewDate: status === "已掌握" ? null : question.reviewDate,
      });
    },
    importQuestions,
    loadDemo: () => importQuestions(createDemoQuestions()) !== null,
    removeDemo: () =>
      persist(
        snapshot.current.questions.filter((question) => !question.isDemo),
      ),
  };
}
