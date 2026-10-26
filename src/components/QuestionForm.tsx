import { useEffect, useId, useRef, useState } from "react";
import type { FormEvent } from "react";
import { X } from "lucide-react";
import { STATUSES, SUBJECTS } from "../types";
import type { MasteryStatus, Question, QuestionDraft, Subject } from "../types";

interface QuestionFormProps {
  question?: Question | null;
  onSave: (draft: QuestionDraft) => boolean;
  onClose: () => void;
}

function isValidDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return (
    Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value
  );
}

export function QuestionForm({ question, onSave, onClose }: QuestionFormProps) {
  const id = useId();
  const dialog = useRef<HTMLDialogElement>(null);
  const firstInput = useRef<HTMLInputElement>(null);
  const [year, setYear] = useState(
    String(
      question?.year ??
        Math.min(2100, Math.max(1987, new Date().getFullYear())),
    ),
  );
  const [questionNumber, setQuestionNumber] = useState(
    question?.questionNumber ?? "",
  );
  const [subject, setSubject] = useState<Subject>(
    question?.subject ?? SUBJECTS[0],
  );
  const [tags, setTags] = useState(question?.tags.join("，") ?? "");
  const [tagsEdited, setTagsEdited] = useState(false);
  const [errorReason, setErrorReason] = useState(question?.errorReason ?? "");
  const [status, setStatus] = useState<MasteryStatus>(
    question?.status ?? STATUSES[0],
  );
  const [reviewDate, setReviewDate] = useState(question?.reviewDate ?? "");
  const [notes, setNotes] = useState(question?.notes ?? "");
  const [error, setError] = useState("");

  useEffect(() => {
    const previouslyFocused = document.activeElement;
    const element = dialog.current;
    if (element && !element.open) element.showModal();
    firstInput.current?.focus();
    return () => {
      if (element?.open) element.close();
      if (
        previouslyFocused instanceof HTMLElement &&
        previouslyFocused.isConnected
      )
        previouslyFocused.focus();
    };
  }, []);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const numericYear = Number(year);
    const normalizedTags =
      question && !tagsEdited
        ? question.tags
        : [
            ...new Set(
              tags
                .split(/[,，]/)
                .map((tag) => tag.trim())
                .filter(Boolean),
            ),
          ];
    if (
      !year.trim() ||
      !Number.isInteger(numericYear) ||
      numericYear < 1987 ||
      numericYear > 2100
    ) {
      setError("请输入 1987–2100 之间的整数年份。");
      firstInput.current?.focus();
      return;
    }
    if (!questionNumber.trim() || questionNumber.trim().length > 64) {
      setError("请填写题号，最多 64 个字符。");
      return;
    }
    if (
      normalizedTags.length > 20 ||
      normalizedTags.some((tag) => tag.length > 40)
    ) {
      setError("最多填写 20 个知识点标签，每个标签不超过 40 个字符。");
      return;
    }
    if (!errorReason.trim() || errorReason.trim().length > 2000) {
      setError("请填写错误原因，最多 2000 个字符。");
      return;
    }
    if (reviewDate && !isValidDate(reviewDate)) {
      setError("请选择有效的复做日期。");
      return;
    }
    if (notes.trim().length > 10000) {
      setError("备注不能超过 10000 个字符。");
      return;
    }
    setError("");
    const saved = onSave({
      year: numericYear,
      questionNumber: questionNumber.trim(),
      subject,
      tags: normalizedTags,
      errorReason: errorReason.trim(),
      status,
      reviewDate: reviewDate || null,
      notes: notes.trim(),
    });
    if (saved) onClose();
    else setError("保存未完成，请查看页面提示后重试。当前填写的内容已保留。");
  }

  return (
    <dialog
      ref={dialog}
      className="modal"
      aria-labelledby={`${id}-title`}
      aria-describedby={`${id}-description`}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        if (event.target !== event.currentTarget) return;
        const rect = event.currentTarget.getBoundingClientRect();
        if (
          event.clientX < rect.left ||
          event.clientX > rect.right ||
          event.clientY < rect.top ||
          event.clientY > rect.bottom
        )
          onClose();
      }}
    >
      <div className="modal-header">
        <div>
          <h2 id={`${id}-title`}>{question ? "编辑错题" : "记录一道错题"}</h2>
          <p id={`${id}-description`}>
            记下错因，让下一次解题更有把握。带 * 的项目为必填项。
          </p>
        </div>
        <button
          type="button"
          className="icon-button"
          aria-label="关闭错题表单"
          onClick={onClose}
        >
          <X size={20} />
        </button>
      </div>
      <form onSubmit={submit} noValidate>
        <div className="modal-body">
          {question?.isDemo && (
            <p className="field-hint">
              这是一条演示记录，修改后仍保留演示标记。
            </p>
          )}
          <div className="form-grid">
            <label className="field" htmlFor={`${id}-year`}>
              <span>真题年份 *</span>
              <input
                ref={firstInput}
                id={`${id}-year`}
                type="number"
                inputMode="numeric"
                min="1987"
                max="2100"
                step="1"
                required
                value={year}
                onChange={(event) => setYear(event.target.value)}
              />
            </label>
            <label className="field" htmlFor={`${id}-question`}>
              <span>题号 *</span>
              <input
                id={`${id}-question`}
                required
                maxLength={64}
                placeholder="例如：18 或 18（2）"
                value={questionNumber}
                onChange={(event) => setQuestionNumber(event.target.value)}
              />
            </label>
            <label className="field" htmlFor={`${id}-subject`}>
              <span>科目 *</span>
              <select
                id={`${id}-subject`}
                required
                value={subject}
                onChange={(event) => setSubject(event.target.value as Subject)}
              >
                {SUBJECTS.map((item) => (
                  <option key={item}>{item}</option>
                ))}
              </select>
            </label>
            <label className="field" htmlFor={`${id}-status`}>
              <span>掌握状态 *</span>
              <select
                id={`${id}-status`}
                required
                value={status}
                onChange={(event) =>
                  setStatus(event.target.value as MasteryStatus)
                }
              >
                {STATUSES.map((item) => (
                  <option key={item}>{item}</option>
                ))}
              </select>
            </label>
            <label className="field full-width" htmlFor={`${id}-tags`}>
              <span id={`${id}-tags-label`}>知识点标签</span>
              <input
                id={`${id}-tags`}
                aria-labelledby={`${id}-tags-label`}
                aria-describedby={`${id}-tags-hint`}
                placeholder="例如：极限，泰勒公式"
                value={tags}
                onChange={(event) => {
                  setTagsEdited(true);
                  setTags(event.target.value);
                }}
              />
              <span id={`${id}-tags-hint`} className="field-hint">
                用中文或英文逗号分隔，最多 20 个标签，每个最多 40 字。
              </span>
            </label>
            <label className="field full-width" htmlFor={`${id}-reason`}>
              <span>错误原因 *</span>
              <textarea
                id={`${id}-reason`}
                rows={3}
                required
                maxLength={2000}
                placeholder="是概念模糊、思路偏差，还是计算疏漏？"
                value={errorReason}
                onChange={(event) => setErrorReason(event.target.value)}
              />
            </label>
            <label className="field full-width" htmlFor={`${id}-date`}>
              <span id={`${id}-date-label`}>复做日期</span>
              <input
                id={`${id}-date`}
                type="date"
                aria-labelledby={`${id}-date-label`}
                aria-describedby={`${id}-date-hint`}
                value={reviewDate}
                onChange={(event) => setReviewDate(event.target.value)}
              />
              <span id={`${id}-date-hint`} className="field-hint">
                可留空。未掌握和巩固中的错题始终进入复习列表。
              </span>
            </label>
            <label className="field full-width" htmlFor={`${id}-notes`}>
              <span>备注</span>
              <textarea
                id={`${id}-notes`}
                rows={3}
                maxLength={10000}
                placeholder="记录解题思路、关键步骤或复做心得……"
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
              />
            </label>
          </div>
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
        </div>
        <div className="modal-footer">
          <button type="button" className="button secondary" onClick={onClose}>
            取消
          </button>
          <button type="submit" className="button primary">
            {question ? "保存修改" : "保存错题"}
          </button>
        </div>
      </form>
    </dialog>
  );
}
