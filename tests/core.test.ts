import { describe, expect, it, vi } from "vitest";
import {
  SUBJECTS,
  type Filters,
  type Question,
  type QuestionDraft,
} from "../src/types";
import {
  EMPTY_FILTERS,
  createQuestion,
  filterQuestions,
  getReviewQuestions,
  getStats,
  isDue,
  localDate,
} from "../src/lib/questions";
import {
  mergeQuestions,
  parseImport,
  serializeQuestions,
} from "../src/lib/importExport";
import { createDemoQuestions } from "../src/lib/demo";

const today = "2026-10-26";
const timestamp = "2026-10-01T10:00:00.000Z";

function question(overrides: Partial<Question> = {}): Question {
  return {
    id: "question-a",
    year: 2024,
    questionNumber: "18",
    subject: "高等数学",
    tags: ["定积分", "换元积分法"],
    errorReason: "换元后遗漏积分上下限",
    status: "未掌握",
    reviewDate: "2026-10-26",
    notes: "注意 Jacobian 因子",
    isDemo: false,
    createdAt: timestamp,
    updatedAt: timestamp,
    ...overrides,
  };
}

function envelope(
  questions: unknown[],
  overrides: Record<string, unknown> = {},
): string {
  return JSON.stringify({
    version: 1,
    exportedAt: timestamp,
    questions,
    ...overrides,
  });
}

const records = [
  question(),
  question({
    id: "question-b",
    year: 2023,
    questionNumber: "21",
    subject: "线性代数",
    tags: ["特征值", "相似矩阵"],
    status: "已掌握",
    reviewDate: null,
    errorReason: "特征向量计算错误",
    notes: "",
  }),
  question({
    id: "question-c",
    year: 2024,
    questionNumber: "9",
    subject: "概率论与数理统计",
    tags: ["条件概率"],
    status: "巩固中",
    reviewDate: "2026-10-30",
    errorReason: "事件包含关系理解错误",
    notes: "",
  }),
];

describe("错题筛选", () => {
  const filter = (patch: Partial<Filters>) =>
    filterQuestions(records, { ...EMPTY_FILTERS, ...patch });

  it("空条件保留全部记录，不修改原数组", () => {
    const snapshot = JSON.stringify(records);
    expect(filter({})).toHaveLength(3);
    expect(JSON.stringify(records)).toBe(snapshot);
  });

  it("年份、科目、标签及状态共同生效", () => {
    expect(filter({ year: "2024" })).toHaveLength(2);
    expect(filter({ subject: "线性代数" }).map(({ id }) => id)).toEqual([
      "question-b",
    ]);
    expect(filter({ tag: "定积分" }).map(({ id }) => id)).toEqual([
      "question-a",
    ]);
    expect(filter({ status: "巩固中" }).map(({ id }) => id)).toEqual([
      "question-c",
    ]);
    expect(
      filter({
        year: "2024",
        subject: "高等数学",
        tag: "定积分",
        status: "未掌握",
      }),
    ).toEqual([records[0]]);
    expect(filter({ year: "2024", subject: "线性代数" })).toEqual([]);
  });

  it.each([
    ["2023", ["question-b"]],
    ["21", ["question-b"]],
    ["概率", ["question-c"]],
    ["换元", ["question-a"]],
    ["上下限", ["question-a"]],
    [" jacobian ", ["question-a"]],
    ["已掌握", ["question-b"]],
    ["不存在的知识点", []],
  ])("搜索 %s 匹配题目信息", (query, expectedIds) => {
    expect(filter({ query }).map(({ id }) => id)).toEqual(expectedIds);
  });

  it("关键词搜索与下拉筛选取交集", () => {
    expect(filter({ query: "2024", subject: "概率论与数理统计" })).toEqual([
      records[2],
    ]);
    expect(filter({ query: "2023", status: "未掌握" })).toEqual([]);
  });
});

describe("复习计划和本地日期", () => {
  it("使用本地年月日，不经过 UTC 日期截断", () => {
    expect(localDate(new Date(2026, 0, 2, 0, 5))).toBe("2026-01-02");
    expect(localDate(new Date(2026, 11, 31, 23, 55))).toBe("2026-12-31");
  });

  it("当天和过去的复做日期均已到期，空日期和未来日期未到期", () => {
    expect(isDue(question({ reviewDate: today }), today)).toBe(true);
    expect(isDue(question({ reviewDate: "2026-10-25" }), today)).toBe(true);
    expect(isDue(question({ reviewDate: "2026-10-27" }), today)).toBe(false);
    expect(isDue(question({ reviewDate: null }), today)).toBe(false);
  });

  it("未掌握或巩固中的题总会进入计划；已掌握的题只有到期才进入", () => {
    const input = [
      question({ id: "future", reviewDate: "2026-10-28" }),
      question({
        id: "mastered-future",
        status: "已掌握",
        reviewDate: "2026-10-28",
      }),
      question({ id: "mastered-due", status: "已掌握", reviewDate: today }),
      question({ id: "pending", status: "巩固中", reviewDate: null }),
      question({ id: "mastered-no-date", status: "已掌握", reviewDate: null }),
      question({ id: "overdue", reviewDate: "2026-10-20" }),
    ];
    expect(getReviewQuestions(input, today).map(({ id }) => id)).toEqual([
      "overdue",
      "mastered-due",
      "future",
      "pending",
    ]);
    expect(input.map(({ id }) => id)).toEqual([
      "future",
      "mastered-future",
      "mastered-due",
      "pending",
      "mastered-no-date",
      "overdue",
    ]);
  });

  it("同一天的题目优先显示较新年份", () => {
    const input = [
      question({ id: "old", year: 2020 }),
      question({ id: "new", year: 2025 }),
    ];
    expect(getReviewQuestions(input, today).map(({ id }) => id)).toEqual([
      "new",
      "old",
    ]);
  });
});

describe("仪表盘统计", () => {
  it("空列表各项统计为零且没有 NaN", () => {
    const stats = getStats([], today);
    expect(stats).toMatchObject({
      total: 0,
      mastered: 0,
      masteryRate: 0,
      reviewCount: 0,
      tags: [],
      years: [],
    });
    expect(stats.subjects).toEqual(
      SUBJECTS.map((name) => ({ name, count: 0, mastered: 0 })),
    );
    expect(Number.isFinite(stats.masteryRate)).toBe(true);
  });

  it("正确计算各科数量、已掌握数、掌握率与复习数", () => {
    const stats = getStats(records, today);
    expect(stats).toMatchObject({
      total: 3,
      mastered: 1,
      masteryRate: 33,
      reviewCount: 2,
    });
    expect(stats.subjects).toEqual([
      { name: "高等数学", count: 1, mastered: 0 },
      { name: "线性代数", count: 1, mastered: 1 },
      { name: "概率论与数理统计", count: 1, mastered: 0 },
    ]);
    expect(stats.years).toEqual([
      { year: 2024, count: 2, mastered: 0 },
      { year: 2023, count: 1, mastered: 1 },
    ]);
  });

  it("单题重复标签只计一次，知识点按出现题数降序排列", () => {
    const stats = getStats(
      [
        question({ tags: ["定积分", "定积分", "微分方程"] }),
        question({ id: "b", tags: ["定积分"] }),
        question({ id: "c", tags: [] }),
      ],
      today,
    );
    expect(stats.tags).toEqual([
      { name: "定积分", count: 2 },
      { name: "微分方程", count: 1 },
    ]);
  });

  it("全部掌握时为 100%，但到期题仍计入复习", () => {
    const stats = getStats([question({ status: "已掌握" })], today);
    expect(stats).toMatchObject({
      total: 1,
      mastered: 1,
      masteryRate: 100,
      reviewCount: 1,
    });
  });
});

describe("新增与演示数据", () => {
  it("新增真实错题生成独立 ID 和时间戳", () => {
    const draft: QuestionDraft = {
      year: 2024,
      questionNumber: "18",
      subject: "高等数学",
      tags: ["定积分"],
      errorReason: "漏写上下限",
      status: "未掌握",
      reviewDate: null,
      notes: "",
    };
    const first = createQuestion(draft);
    const second = createQuestion(draft);
    expect(first).toMatchObject({ ...draft, isDemo: false });
    expect(first.id).toBeTruthy();
    expect(first.id).not.toBe(second.id);
    expect(Number.isFinite(Date.parse(first.createdAt))).toBe(true);
    expect(first.updatedAt).toBe(first.createdAt);
  });

  it("局域网 HTTP 缺少 randomUUID 时仍能生成不同的合法 UUID", () => {
    const originalCrypto = globalThis.crypto;
    const getRandomValues = vi.fn(
      originalCrypto.getRandomValues.bind(originalCrypto),
    );
    vi.stubGlobal("crypto", { getRandomValues });
    const draft: QuestionDraft = {
      year: 2024,
      questionNumber: "18",
      subject: "高等数学",
      tags: ["定积分"],
      errorReason: "漏写上下限",
      status: "未掌握",
      reviewDate: null,
      notes: "",
    };
    try {
      const first = createQuestion(draft);
      const second = createQuestion(draft);
      const uuidV4 =
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
      expect(first.id).toMatch(uuidV4);
      expect(second.id).toMatch(uuidV4);
      expect(first.id).not.toBe(second.id);
      expect(getRandomValues).toHaveBeenCalledTimes(2);
      expect(first).toMatchObject({ ...draft, isDemo: false });
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("演示记录全部明确标记且能正常导出再导入", () => {
    const demos = createDemoQuestions(today);
    expect(demos).toHaveLength(6);
    expect(new Set(demos.map(({ id }) => id)).size).toBe(demos.length);
    expect(new Set(demos.map(({ subject }) => subject)).size).toBe(3);
    expect(
      demos.every(
        ({ isDemo, notes }) => isDemo && /演示|示例|虚构/.test(notes),
      ),
    ).toBe(true);
    expect(parseImport(serializeQuestions(demos))).toMatchObject({
      ok: true,
      questions: demos,
    });
  });
});

describe("JSON 导入校验", () => {
  it("接受完整合法导出及空导出", () => {
    expect(parseImport(envelope(records))).toEqual({
      ok: true,
      questions: records,
    });
    expect(parseImport(envelope([]))).toEqual({ ok: true, questions: [] });
  });

  it.each([
    "",
    "{",
    "null",
    "[]",
    "1",
    '"string"',
    "{}",
    envelope(records, { version: 2 }),
    envelope(records, { version: "1" }),
    envelope(records, { exportedAt: "not-a-date" }),
    envelope(records, { questions: {} }),
    JSON.stringify({ version: 1, questions: records }),
  ])("拒绝错误 JSON 或不受支持的顶层格式 %#", (input) => {
    const result = parseImport(input);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.length).toBeGreaterThan(0);
  });

  it.each([
    ["id", ""],
    ["id", " ".repeat(3)],
    ["id", "x".repeat(101)],
    ["year", 1986],
    ["year", 2101],
    ["year", 2024.5],
    ["year", "2024"],
    ["questionNumber", ""],
    ["questionNumber", "x".repeat(65)],
    ["questionNumber", 18],
    ["subject", "数学分析"],
    ["subject", null],
    ["tags", "积分"],
    ["tags", [3]],
    ["tags", [""]],
    ["tags", ["x".repeat(41)]],
    ["tags", Array.from({ length: 21 }, (_, i) => `标签${i}`)],
    ["errorReason", "  "],
    ["errorReason", "x".repeat(2001)],
    ["errorReason", null],
    ["status", "完成"],
    ["status", 1],
    ["reviewDate", "2026-02-29"],
    ["reviewDate", "2026-04-31"],
    ["reviewDate", "2026-13-01"],
    ["reviewDate", "2026-01-00"],
    ["reviewDate", "2026-2-01"],
    ["reviewDate", "2026-10-26T00:00:00Z"],
    ["reviewDate", ""],
    ["reviewDate", false],
    ["notes", 3],
    ["notes", "x".repeat(10001)],
    ["isDemo", "false"],
    ["isDemo", 0],
    ["createdAt", "invalid"],
    ["createdAt", "2026-02-30T12:00:00.000Z"],
    ["updatedAt", null],
    ["updatedAt", "2026-10-26"],
  ])("拒绝无效字段 %s %#", (field, value) => {
    const result = parseImport(envelope([{ ...question(), [field]: value }]));
    expect(result.ok).toBe(false);
  });

  it.each(Object.keys(question()))("拒绝缺少必需字段 %s 的记录", (field) => {
    const incomplete: Record<string, unknown> = { ...question() };
    delete incomplete[field];
    expect(parseImport(envelope([incomplete])).ok).toBe(false);
  });

  it("接受闰年日期及边界年份", () => {
    expect(
      parseImport(
        envelope([
          question({ year: 1987, reviewDate: "2024-02-29" }),
          question({ id: "upper", year: 2100, reviewDate: null }),
        ]),
      ).ok,
    ).toBe(true);
  });

  it("规范化外部输入中的首尾空格并去重标签", () => {
    const result = parseImport(
      envelope([
        question({
          id: " example ",
          questionNumber: " 18 ",
          tags: [" 定积分 ", "定积分"],
          errorReason: " 漏写上下限 ",
        }),
      ]),
    );
    expect(result).toMatchObject({
      ok: true,
      questions: [
        {
          id: "example",
          questionNumber: "18",
          tags: ["定积分"],
          errorReason: "漏写上下限",
        },
      ],
    });
  });

  it("任意一条记录错误使整个导入失败，不返回部分数据", () => {
    const result = parseImport(
      envelope([question(), { ...question({ id: "bad" }), subject: "无效" }]),
    );
    expect(result.ok).toBe(false);
    expect(result).not.toHaveProperty("questions");
  });

  it("拒绝文件内重复 ID，包括去空格后重复的 ID", () => {
    expect(parseImport(envelope([question(), question()])).ok).toBe(false);
    expect(
      parseImport(envelope([question(), question({ id: " question-a " })])).ok,
    ).toBe(false);
  });

  it("拒绝非对象记录和超大文件", () => {
    expect(parseImport(envelope([null])).ok).toBe(false);
    expect(parseImport(envelope([[]])).ok).toBe(false);
    expect(parseImport(envelope(["bad"])).ok).toBe(false);
    expect(parseImport(" ".repeat(5 * 1024 * 1024 + 1)).ok).toBe(false);
  });

  it("拒绝超过 10000 条记录的文件", () => {
    const input = Array.from({ length: 10001 }, (_, index) =>
      question({ id: `q-${index}`, tags: [], notes: "" }),
    );
    expect(parseImport(envelope(input)).ok).toBe(false);
  });

  it("不会把外部额外属性或 __proto__ 字段带入应用记录", () => {
    const unsafe = JSON.parse(
      JSON.stringify(question()).replace(
        '"id":',
        '"__proto__":{"polluted":true},"extra":"ignore","id":',
      ),
    ) as unknown;
    const result = parseImport(envelope([unsafe]));
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(Object.hasOwn(result.questions[0], "__proto__")).toBe(false);
      expect(Object.hasOwn(result.questions[0], "extra")).toBe(false);
      expect(Object.getPrototypeOf(result.questions[0])).toBe(Object.prototype);
    }
    expect(Object.hasOwn(Object.prototype, "polluted")).toBe(false);
  });
});

describe("导出与安全合并", () => {
  it("导出格式带版本与时间，并完整保留中文字段", () => {
    const output = serializeQuestions(records);
    const parsed = JSON.parse(output) as {
      version: number;
      exportedAt: string;
      questions: Question[];
    };
    expect(parsed.version).toBe(1);
    expect(Number.isFinite(Date.parse(parsed.exportedAt))).toBe(true);
    expect(parsed.questions).toEqual(records);
    expect(parseImport(output)).toEqual({ ok: true, questions: records });
  });

  it("同 ID 永不覆盖；只追加新题，准确报告追加和跳过数量", () => {
    const existing = [question({ notes: "保留现有笔记" })];
    const incoming = [
      question({ notes: "外部旧笔记" }),
      question({ id: "new", year: 2025 }),
    ];
    const beforeExisting = JSON.stringify(existing);
    const beforeIncoming = JSON.stringify(incoming);
    const result = mergeQuestions(existing, incoming);
    expect(result).toMatchObject({ added: 1, skipped: 1 });
    expect(result.questions).toEqual([existing[0], incoming[1]]);
    expect(JSON.stringify(existing)).toBe(beforeExisting);
    expect(JSON.stringify(incoming)).toBe(beforeIncoming);
  });

  it("重复导入同一备份不会新增副本", () => {
    const first = mergeQuestions([], records);
    const second = mergeQuestions(first.questions, records);
    expect(first).toMatchObject({ added: 3, skipped: 0 });
    expect(second).toEqual({ questions: records, added: 0, skipped: 3 });
  });

  it("导入空备份保留现有记录", () => {
    expect(mergeQuestions(records, [])).toEqual({
      questions: records,
      added: 0,
      skipped: 0,
    });
  });
});
