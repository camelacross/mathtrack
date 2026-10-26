import {
  ArrowDownRight,
  ArrowRight,
  BookOpen,
  CheckCheck,
  CircleCheck,
  Clock3,
  Sparkles,
  TrendingUp,
} from "lucide-react";
import type { Question } from "../types";
import { getStats } from "../lib/questions";
import { EmptyState, QuestionTable } from "./QuestionList";

export function Dashboard({
  questions,
  today,
  onReview,
  onList,
  onAdd,
  onDemo,
  onEdit,
  onDelete,
}: {
  questions: Question[];
  today: string;
  onReview: () => void;
  onList: () => void;
  onAdd: () => void;
  onDemo: () => void;
  onEdit: (q: Question) => void;
  onDelete: (q: Question) => void;
}) {
  const stats = getStats(questions, today);
  const subjectColors = ["#34735c", "#90b49b", "#d5c6a3"];
  const first = stats.total ? (stats.subjects[0].count / stats.total) * 100 : 0;
  const second = stats.total
    ? (stats.subjects[1].count / stats.total) * 100 + first
    : 0;
  const maxTags = Math.max(1, ...stats.tags.map((tag) => tag.count));
  const maxYears = Math.max(1, ...stats.years.map((year) => year.count));
  return (
    <>
      <section className="hero">
        <div className="hero-copy">
          <div className="eyebrow">
            <span className="tiny-dot" /> 每一次订正，都是向目标靠近
          </div>
          <h2>把薄弱点，变成得分点。</h2>
          <p>
            从记录到理解，从复做到掌握。
            <br className="mobile-break" />
            让你的数学进步有迹可循。
          </p>
          <div className="hero-actions">
            <button
              className="button primary"
              onClick={stats.total ? onReview : onAdd}
            >
              {stats.total ? "开始今日复习" : "记录第一道错题"}
              <ArrowRight size={16} />
            </button>
            <span>
              {stats.total
                ? `${stats.reviewCount} 道错题值得再看一遍`
                : "用一道错题，开启进步循环"}
            </span>
          </div>
        </div>
        <div className="math-art" aria-hidden="true">
          <div className="math-orbit orbit-one" />
          <div className="math-orbit orbit-two" />
          <span className="math-formula">∫</span>
          <span className="math-small formula-one">f(x)</span>
          <span className="math-small formula-two">Δ progress</span>
          <svg viewBox="0 0 240 120">
            <path
              d="M10 100 Q60 110 100 73 T220 10"
              fill="none"
              stroke="#6b9679"
              strokeWidth="2"
            />
            <path
              d="M10 100 H230 M25 110 V10"
              fill="none"
              stroke="#a9bda7"
              strokeWidth="1"
              strokeDasharray="4 5"
            />
            <circle cx="150" cy="47" r="5" fill="#477c59" />
            <circle cx="220" cy="10" r="5" fill="#477c59" />
          </svg>
          <span className="art-check">
            <CheckCheck size={20} />
          </span>
        </div>
      </section>
      <div className="stats-grid">
        {[
          {
            label: "累计错题",
            value: stats.total,
            suffix: "道",
            text: "每一次记录，都是进步的起点",
            icon: BookOpen,
            color: "green",
          },
          {
            label: "待复习",
            value: stats.reviewCount,
            suffix: "道",
            text: "未掌握与已到期的复做题目",
            icon: Clock3,
            color: "amber",
          },
          {
            label: "已掌握",
            value: stats.mastered,
            suffix: "道",
            text: "理解思路，也能独立完成",
            icon: CircleCheck,
            color: "blue",
          },
          {
            label: "整体掌握率",
            value: stats.masteryRate,
            suffix: "%",
            text: stats.total
              ? "已掌握题数 / 累计错题数"
              : "录入后，开始积累你的进步",
            icon: TrendingUp,
            color: "purple",
          },
        ].map((stat) => (
          <article className="card stat-card" key={stat.label}>
            <div className="stat-top">
              <span>{stat.label}</span>
              <span className={`stat-icon ${stat.color}`}>
                <stat.icon size={19} />
              </span>
            </div>
            <div className="stat-number">
              {stat.value}
              <span>{stat.suffix}</span>
            </div>
            <p>{stat.text}</p>
          </article>
        ))}
      </div>
      <div className="analytics-grid">
        <section className="card subject-card">
          <div className="section-heading">
            <h2>科目分布</h2>
            <span className="muted">共 3 个科目</span>
          </div>
          <div className="subject-chart">
            <div
              className="donut"
              role="img"
              aria-label={`科目分布：${stats.subjects.map((s) => `${s.name} ${s.count} 道`).join("，")}`}
              style={{
                background: stats.total
                  ? `conic-gradient(${subjectColors[0]} 0% ${first}%, ${subjectColors[1]} ${first}% ${second}%, ${subjectColors[2]} ${second}% 100%)`
                  : "#edf0ec",
              }}
            >
              <div>
                <strong>{stats.total}</strong>
                <span>全部错题</span>
              </div>
            </div>
            <div className="chart-legend">
              {stats.subjects.map((s, index) => (
                <div key={s.name}>
                  <span
                    className="legend-dot"
                    style={{ background: subjectColors[index] }}
                  />
                  <span>{s.name}</span>
                  <strong>
                    {s.count}
                    <small> 道</small>
                  </strong>
                </div>
              ))}
            </div>
          </div>
        </section>
        <section className="card ranking-card">
          <div className="section-heading">
            <h2>高频错误知识点</h2>
            <span className="muted">TOP 5</span>
          </div>
          {stats.tags.length ? (
            <div className="ranking-list">
              {stats.tags.slice(0, 5).map((tag, index) => (
                <div className="ranking-row" key={tag.name}>
                  <span className={`rank ${index === 0 ? "first-rank" : ""}`}>
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <div>
                    <div className="ranking-label">
                      <span>{tag.name}</span>
                      <strong>
                        {tag.count}
                        <small> 道</small>
                      </strong>
                    </div>
                    <div className="bar-track">
                      <div
                        style={{ width: `${(tag.count / maxTags) * 100}%` }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="chart-empty">
              <Sparkles size={25} />
              <p>薄弱点，还等你来发现</p>
              <span>录入知识点标签后，自动生成排名</span>
            </div>
          )}
          <div className="chart-footnote">
            按包含该知识点的错题数量统计，一题可包含多个知识点。
          </div>
        </section>
      </div>
      <section className="card year-card">
        <div className="section-heading">
          <h2>真题年份统计</h2>
          <span className="year-legend">
            <span className="legend-dot" />
            错题数
            <span className="legend-dot mastered-dot" />
            已掌握
          </span>
        </div>
        {stats.years.length ? (
          <div className="year-chart">
            {stats.years.map((item) => (
              <div className="year-column" key={item.year}>
                <span className="year-count">
                  {item.count}
                  <span> / {item.mastered}</span>
                </span>
                <div className="year-bar-area">
                  <div
                    className="year-bar"
                    style={{
                      height: `${Math.max(5, (item.count / maxYears) * 100)}%`,
                    }}
                  >
                    <div
                      style={{
                        height: `${(item.mastered / item.count) * 100}%`,
                      }}
                    />
                  </div>
                </div>
                <span>{item.year}</span>
              </div>
            ))}
          </div>
        ) : (
          <div className="year-empty">
            <ArrowDownRight size={22} />
            <span>
              每一年的真题，都将成为你进步的刻度。录入后查看年份分布。
            </span>
          </div>
        )}
      </section>
      <section className="card recent-card">
        <div className="section-heading">
          <h2>
            最近记录{" "}
            <span className="muted heading-note">及时回顾，让思路留下来</span>
          </h2>
          <button className="text-button" onClick={onList}>
            全部错题
            <ArrowRight size={15} />
          </button>
        </div>
        {questions.length ? (
          <QuestionTable
            questions={[...questions]
              .sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt))
              .slice(0, 4)}
            onEdit={onEdit}
            onDelete={onDelete}
          />
        ) : (
          <EmptyState
            title="你的错题本，正等待第一笔"
            description="录入自己的错题，或加载 6 条虚构演示记录，先看看 MathTrack 如何工作。"
            action="体验演示数据"
            onAction={onDemo}
          />
        )}
      </section>
      <p className="dashboard-footer">
        <span />
        一点点积累，让每一道错题都有价值。
      </p>
    </>
  );
}
