import {
  CalendarDays,
  ChevronRight,
  Pencil,
  Search,
  Trash2,
} from "lucide-react";
import type { Filters, MasteryStatus, Question } from "../types";
import { STATUSES, SUBJECTS } from "../types";
import { EMPTY_FILTERS, filterQuestions } from "../lib/questions";
import { useState } from "react";

export function StatusBadge({ status }: { status: MasteryStatus }) {
  return (
    <span className={`status-badge status-${STATUSES.indexOf(status)}`}>
      <span />
      {status}
    </span>
  );
}

export function QuestionTable({
  questions,
  onEdit,
  onDelete,
}: {
  questions: Question[];
  onEdit: (q: Question) => void;
  onDelete: (q: Question) => void;
}) {
  return (
    <div className="table-scroll">
      <table className="question-table">
        <thead>
          <tr>
            <th>真题 / 题号</th>
            <th>科目与知识点</th>
            <th>错误原因</th>
            <th>掌握状态</th>
            <th>复做日期</th>
            <th>
              <span className="sr-only">操作</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {questions.map((q) => (
            <tr key={q.id}>
              <td>
                <button className="question-link" onClick={() => onEdit(q)}>
                  {q.year} 年 · 第 {q.questionNumber} 题
                </button>
                {q.isDemo && <span className="demo-label">演示数据</span>}
              </td>
              <td>
                <span className="subject-name">{q.subject}</span>
                <div className="tags">
                  {q.tags.length ? (
                    q.tags.map((tag) => <span key={tag}>{tag}</span>)
                  ) : (
                    <span>未分类</span>
                  )}
                </div>
              </td>
              <td>
                <p className="reason-text" title={q.errorReason}>
                  {q.errorReason}
                </p>
              </td>
              <td>
                <StatusBadge status={q.status} />
              </td>
              <td>
                <span className="date-text">{q.reviewDate ?? "未安排"}</span>
              </td>
              <td>
                <div className="row-actions">
                  <button
                    className="icon-button"
                    aria-label={`编辑 ${q.year} 年第 ${q.questionNumber} 题`}
                    onClick={() => onEdit(q)}
                  >
                    <Pencil size={15} />
                  </button>
                  <button
                    className="icon-button delete-button"
                    aria-label={`删除 ${q.year} 年第 ${q.questionNumber} 题`}
                    onClick={() => onDelete(q)}
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function EmptyState({
  title,
  description,
  action,
  onAction,
}: {
  title: string;
  description: string;
  action?: string;
  onAction?: () => void;
}) {
  return (
    <div className="empty-state">
      <span className="empty-icon">
        <Search size={25} />
      </span>
      <h3>{title}</h3>
      <p>{description}</p>
      {action && (
        <button className="button secondary" onClick={onAction}>
          {action}
          <ChevronRight size={15} />
        </button>
      )}
    </div>
  );
}

export function QuestionList({
  questions,
  onEdit,
  onDelete,
  onAdd,
}: {
  questions: Question[];
  onEdit: (q: Question) => void;
  onDelete: (q: Question) => void;
  onAdd: () => void;
}) {
  const [filters, setFilters] = useState<Filters>({ ...EMPTY_FILTERS });
  const [page, setPage] = useState(1);
  const filtered = filterQuestions(questions, filters).sort(
    (a, b) =>
      b.year - a.year ||
      a.questionNumber.localeCompare(b.questionNumber, "zh-CN", {
        numeric: true,
      }),
  );
  const tags = [...new Set(questions.flatMap((q) => q.tags))].sort((a, b) =>
    a.localeCompare(b, "zh-CN"),
  );
  const years = [...new Set(questions.map((q) => q.year))].sort(
    (a, b) => b - a,
  );
  const updateFilter = (patch: Partial<Filters>) => {
    setFilters((current) => ({ ...current, ...patch }));
    setPage(1);
  };
  const pageSize = 12;
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, totalPages);
  return (
    <section className="card list-card" aria-label="错题列表">
      <div className="filter-area">
        <label className="search-input">
          <Search size={18} />
          <input
            aria-label="搜索错题"
            placeholder="搜索年份、题号、知识点、错因或备注…"
            value={filters.query}
            onChange={(e) => updateFilter({ query: e.target.value })}
          />
        </label>
        <div className="filter-row">
          <label>
            <span>年份</span>
            <select
              aria-label="年份"
              value={filters.year}
              onChange={(e) => updateFilter({ year: e.target.value })}
            >
              <option value="">全部年份</option>
              {years.map((year) => (
                <option key={year} value={year}>
                  {year} 年
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>科目</span>
            <select
              aria-label="科目"
              value={filters.subject}
              onChange={(e) =>
                updateFilter({ subject: e.target.value as Filters["subject"] })
              }
            >
              <option value="">全部科目</option>
              {SUBJECTS.map((subject) => (
                <option key={subject}>{subject}</option>
              ))}
            </select>
          </label>
          <label>
            <span>知识点</span>
            <select
              aria-label="知识点"
              value={filters.tag}
              onChange={(e) => updateFilter({ tag: e.target.value })}
            >
              <option value="">全部知识点</option>
              {tags.map((tag) => (
                <option key={tag}>{tag}</option>
              ))}
            </select>
          </label>
          <label>
            <span>掌握状态</span>
            <select
              aria-label="掌握状态"
              value={filters.status}
              onChange={(e) =>
                updateFilter({ status: e.target.value as Filters["status"] })
              }
            >
              <option value="">全部状态</option>
              {STATUSES.map((status) => (
                <option key={status}>{status}</option>
              ))}
            </select>
          </label>
          <button
            className="text-button reset-filter"
            onClick={() => {
              setFilters({ ...EMPTY_FILTERS });
              setPage(1);
            }}
          >
            重置筛选
          </button>
        </div>
      </div>
      <div className="list-summary">
        <span>
          共 <strong>{filtered.length}</strong> 道错题
        </span>
        <span className="muted">按真题年份由近到远排列</span>
      </div>
      {filtered.length ? (
        <QuestionTable
          questions={filtered.slice(
            (safePage - 1) * pageSize,
            safePage * pageSize,
          )}
          onEdit={onEdit}
          onDelete={onDelete}
        />
      ) : (
        <EmptyState
          title={questions.length ? "没有找到匹配的错题" : "从第一道错题开始"}
          description={
            questions.length
              ? "试试调整关键词，或清空筛选条件。"
              : "记录当时的思路与错因，为下一次进步留下线索。"
          }
          action={questions.length ? "清空筛选" : "录入错题"}
          onAction={
            questions.length ? () => updateFilter({ ...EMPTY_FILTERS }) : onAdd
          }
        />
      )}
      {totalPages > 1 && (
        <div className="pagination">
          <button
            className="button secondary"
            disabled={safePage === 1}
            onClick={() => setPage(safePage - 1)}
          >
            上一页
          </button>
          <span>
            {safePage} / {totalPages}
          </span>
          <button
            className="button secondary"
            disabled={safePage === totalPages}
            onClick={() => setPage(safePage + 1)}
          >
            下一页
          </button>
        </div>
      )}
    </section>
  );
}

export function ReviewList({
  questions,
  today,
  onEdit,
  onStatus,
}: {
  questions: Question[];
  today: string;
  onEdit: (q: Question) => void;
  onStatus: (id: string, status: MasteryStatus) => void;
}) {
  const [dueOnly, setDueOnly] = useState(false);
  const shown = dueOnly
    ? questions.filter((q) => q.reviewDate && q.reviewDate <= today)
    : questions;
  return (
    <>
      <div className="review-intro card">
        <div>
          <span className="eyebrow">REVIEW & REFLECT</span>
          <h2>让做过的题，成为真正会的题。</h2>
          <p>
            先独立复做，再回看错因。标记「已掌握」将完成本轮复习并清除复做日期。
          </p>
        </div>
        <div className="review-count">
          <strong>{questions.length}</strong>
          <span>道题等待巩固</span>
        </div>
      </div>
      <div className="section-heading">
        <h2>
          复习清单 <span className="count-badge">{shown.length}</span>
        </h2>
        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={dueOnly}
            onChange={(e) => setDueOnly(e.target.checked)}
          />
          仅看今日到期 / 已逾期
        </label>
      </div>
      {shown.length ? (
        <div className="review-grid">
          {shown.map((q, index) => (
            <article className="card review-card" key={q.id}>
              <div className="review-card-top">
                <span className="review-index">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <StatusBadge status={q.status} />
              </div>
              <h3>
                {q.year} 年 · 第 {q.questionNumber} 题{" "}
                {q.isDemo && <span className="demo-label">演示数据</span>}
              </h3>
              <p className="muted">{q.subject}</p>
              <div className="tags">
                {q.tags.map((tag) => (
                  <span key={tag}>{tag}</span>
                ))}
              </div>
              <div className="review-reason">
                <span>上次错因</span>
                <p>{q.errorReason}</p>
              </div>
              {q.notes && (
                <details>
                  <summary>查看备注</summary>
                  <p className="notes-text">{q.notes}</p>
                </details>
              )}
              <div
                className={`review-due ${q.reviewDate && q.reviewDate <= today ? "is-due" : ""}`}
              >
                <CalendarDays size={14} />
                {q.reviewDate
                  ? `${q.reviewDate}${q.reviewDate < today ? " · 已逾期" : q.reviewDate === today ? " · 今日复做" : " · 已安排"}`
                  : "尚未安排复做日期"}
                <button className="text-button" onClick={() => onEdit(q)}>
                  调整
                </button>
              </div>
              <div className="review-actions">
                <label>
                  <span className="sr-only">
                    {q.year} 年第 {q.questionNumber} 题掌握状态
                  </span>
                  <select
                    value={q.status}
                    onChange={(e) =>
                      onStatus(q.id, e.target.value as MasteryStatus)
                    }
                  >
                    {STATUSES.map((status) => (
                      <option key={status}>{status}</option>
                    ))}
                  </select>
                </label>
                <button
                  className="button primary"
                  onClick={() => onStatus(q.id, "已掌握")}
                >
                  本轮已掌握 <ChevronRight size={14} />
                </button>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="card">
          <EmptyState
            title={dueOnly ? "今天没有到期的复习" : "当前复习已完成"}
            description={
              dueOnly
                ? "取消勾选可以查看其他尚未掌握的题目。"
                : "未掌握、巩固中或复做日期到期的题目会出现在这里。"
            }
          />
        </div>
      )}
    </>
  );
}
