import { useEffect, useState } from "react";
import {
  ArrowUpRight,
  BookOpen,
  ChartNoAxesCombined,
  Check,
  Database,
  GraduationCap,
  LayoutDashboard,
  Leaf,
  Plus,
  RotateCcw,
  ShieldCheck,
  X,
} from "lucide-react";
import type { Question } from "./types";
import { useQuestions } from "./hooks/useQuestions";
import { getReviewQuestions, localDate } from "./lib/questions";
import { Dashboard } from "./components/Dashboard";
import { QuestionList, ReviewList } from "./components/QuestionList";
import { QuestionForm } from "./components/QuestionForm";
import { DataManager } from "./components/DataManager";

const pages = [
  {
    id: "overview",
    label: "学习概览",
    icon: LayoutDashboard,
    subtitle: "看见积累，也看清下一步的方向。",
  },
  {
    id: "questions",
    label: "我的错题本",
    icon: BookOpen,
    subtitle: "整理每一次失误，留住真正有用的思考。",
  },
  {
    id: "review",
    label: "复习计划",
    icon: RotateCcw,
    subtitle: "有重点地再做一次，把薄弱环节逐个攻克。",
  },
  {
    id: "data",
    label: "数据管理",
    icon: Database,
    subtitle: "你的学习记录，由你自己保管。",
  },
] as const;
type Page = (typeof pages)[number]["id"];
function readPage(): Page {
  const hash = window.location.hash.slice(1);
  return pages.find((p) => p.id === hash)?.id ?? "overview";
}

export default function App() {
  const data = useQuestions();
  const [page, setPage] = useState<Page>(readPage);
  const [editing, setEditing] = useState<Question | null | undefined>(
    undefined,
  );
  const [toast, setToast] = useState("");
  const [today, setToday] = useState(localDate);
  useEffect(() => {
    const listener = () => setPage(readPage());
    window.addEventListener("hashchange", listener);
    return () => window.removeEventListener("hashchange", listener);
  }, []);
  useEffect(() => {
    const id = window.setInterval(() => setToday(localDate()), 30_000);
    return () => window.clearInterval(id);
  }, []);
  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(""), 4000);
    return () => window.clearTimeout(timer);
  }, [toast]);
  const navigate = (next: Page) => {
    window.location.hash = next;
    setPage(next);
    window.scrollTo({ top: 0, behavior: "instant" });
  };
  const currentPage = pages.find((p) => p.id === page)!;
  const review = getReviewQuestions(data.questions, today);
  const demoCount = data.questions.filter((q) => q.isDemo).length;
  const onDelete = (q: Question) => {
    if (
      window.confirm(
        `确定删除 ${q.year} 年第 ${q.questionNumber} 题？此操作无法撤销。`,
      ) &&
      data.remove(q.id)
    )
      setToast("错题已删除");
  };
  const onDemo = () => {
    if (data.loadDemo()) setToast("已加载演示数据，所有演示记录均已标记");
  };
  return (
    <div className="app-shell">
      <a
        className="skip-link"
        href="#main-content"
        onClick={(event) => {
          event.preventDefault();
          document.getElementById("main-content")?.focus();
          document.getElementById("main-content")?.scrollIntoView();
        }}
      >
        跳转到主要内容
      </a>
      <aside className="sidebar">
        <a className="brand" href="#overview" aria-label="MathTrack 首页">
          <span className="brand-mark">
            <ChartNoAxesCombined size={24} strokeWidth={2.2} />
          </span>
          <span>
            MathTrack<small>考研数学 · 进步有迹可循</small>
          </span>
        </a>
        <span className="nav-caption">我的学习空间</span>
        <nav aria-label="主要导航">
          {pages.map((item) => (
            <a
              href={`#${item.id}`}
              key={item.id}
              className={`nav-item ${page === item.id ? "active" : ""}`}
              aria-current={page === item.id ? "page" : undefined}
            >
              <item.icon size={19} />
              <span>{item.label}</span>
              {item.id === "review" && review.length > 0 && (
                <span className="nav-count">{review.length}</span>
              )}
            </a>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="study-note">
            <span className="study-note-icon">
              <Leaf size={20} />
            </span>
            <h3>不是刷过，而是掌握。</h3>
            <p>
              把每一次失误，
              <br />
              变成下一次的从容。
            </p>
            <span className="note-line" />
          </div>
          <div className="local-indicator">
            <span />
            <span>本地存储 · 无需登录</span>
            <ShieldCheck size={14} />
          </div>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <div>
            <GraduationCap size={17} />
            <span>考研数学学习工作台</span>
            <span className="topbar-separator">/</span>
            <span>{currentPage.label}</span>
          </div>
          <span className="topbar-right">
            <span className="live-dot" />
            专注此刻，积累进步
          </span>
        </header>
        <main id="main-content" tabIndex={-1}>
          <div className="page-header">
            <div>
              <span className="eyebrow page-eyebrow">YOUR MATH JOURNEY</span>
              <h1>
                {currentPage.label}
                <span className="title-dot">.</span>
              </h1>
              <p>{currentPage.subtitle}</p>
            </div>
            <div className="page-header-actions">
              <span className="today-label">
                {new Intl.DateTimeFormat("zh-CN", {
                  month: "long",
                  day: "numeric",
                  weekday: "long",
                }).format(new Date(`${today}T12:00:00`))}
              </span>
              <button
                className="button primary"
                onClick={() => setEditing(null)}
              >
                <Plus size={17} />
                录入错题
              </button>
            </div>
          </div>
          {data.error && (
            <div className="notice error" role="alert">
              <strong>数据操作未完成</strong>
              <p>{data.error}</p>
              <button
                className="text-button"
                onClick={() => window.location.reload()}
              >
                重新读取本地数据
              </button>
            </div>
          )}
          {demoCount > 0 && (
            <div className="demo-banner">
              <div>
                <span className="demo-badge">演示模式</span>
                <span>
                  当前含 {demoCount} 条虚构演示记录，统计包含演示数据。
                </span>
              </div>
              <button className="text-button" onClick={() => navigate("data")}>
                管理演示数据
                <ArrowUpRight size={14} />
              </button>
            </div>
          )}
          {page === "overview" && (
            <Dashboard
              questions={data.questions}
              today={today}
              onReview={() => navigate("review")}
              onList={() => navigate("questions")}
              onAdd={() => setEditing(null)}
              onDemo={onDemo}
              onEdit={setEditing}
              onDelete={onDelete}
            />
          )}
          {page === "questions" && (
            <QuestionList
              questions={data.questions}
              onEdit={setEditing}
              onDelete={onDelete}
              onAdd={() => setEditing(null)}
            />
          )}
          {page === "review" && (
            <ReviewList
              questions={review}
              today={today}
              onEdit={setEditing}
              onStatus={(id, status) => {
                if (data.setStatus(id, status))
                  setToast(
                    status === "已掌握"
                      ? "本轮复习已完成，复做日期已清除"
                      : "掌握状态已更新",
                  );
              }}
            />
          )}
          {page === "data" && (
            <DataManager
              questions={data.questions}
              onImport={data.importQuestions}
              onLoadDemo={data.loadDemo}
              onRemoveDemo={data.removeDemo}
            />
          )}
        </main>
        <footer className="app-footer">
          <span>
            MathTrack <span className="footer-dot">·</span> 学有所思，错有所获
          </span>
          <span>
            <ShieldCheck size={13} />
            数据仅保存在当前浏览器，请定期导出备份。
          </span>
        </footer>
      </div>
      {editing !== undefined && (
        <QuestionForm
          question={editing}
          onClose={() => setEditing(undefined)}
          onSave={(draft) => {
            const saved = editing
              ? data.update(editing.id, draft)
              : data.add(draft);
            if (saved) setToast(editing ? "错题已更新" : "错题已保存");
            return saved;
          }}
        />
      )}
      {toast && (
        <div className="toast" role="status">
          <Check size={17} />
          {toast}
          <button
            className="icon-button"
            aria-label="关闭提示"
            onClick={() => setToast("")}
          >
            <X size={15} />
          </button>
        </div>
      )}
    </div>
  );
}
