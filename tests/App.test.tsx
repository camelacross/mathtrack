import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "../src/App";
import { STORAGE_KEY } from "../src/lib/storage";
import type { ExportData, Question } from "../src/types";

beforeAll(() => {
  Object.defineProperty(HTMLDialogElement.prototype, "showModal", {
    configurable: true,
    value: function (this: HTMLDialogElement) {
      this.setAttribute("open", "");
    },
  });
  Object.defineProperty(HTMLDialogElement.prototype, "close", {
    configurable: true,
    value: function (this: HTMLDialogElement) {
      this.removeAttribute("open");
    },
  });
});

beforeEach(() => {
  localStorage.clear();
  window.history.replaceState({}, "", "/#overview");
  vi.spyOn(window, "scrollTo").mockImplementation(() => undefined);
  vi.spyOn(window, "confirm").mockReturnValue(true);
});

function savedQuestions(): Question[] {
  return (JSON.parse(localStorage.getItem(STORAGE_KEY)!) as ExportData)
    .questions;
}

async function navigate(name: string) {
  await userEvent.click(
    within(screen.getByRole("navigation", { name: "主要导航" })).getByRole(
      "link",
      { name: new RegExp(`^${name}`) },
    ),
  );
  await screen.findByRole("heading", { level: 1, name: new RegExp(name) });
}

describe("MathTrack application workflows", () => {
  it("loads labeled demos, filters, persists a new question, completes review, and removes only demos", async () => {
    const view = render(<App />);
    expect(screen.getByText("你的错题本，正等待第一笔")).toBeVisible();
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();

    await userEvent.click(screen.getByRole("button", { name: "体验演示数据" }));
    expect(screen.getByText("演示模式")).toBeVisible();
    expect(savedQuestions()).toHaveLength(6);
    expect(savedQuestions().every((question) => question.isDemo)).toBe(true);

    await navigate("我的错题本");
    expect(screen.getAllByRole("row")).toHaveLength(7);
    await userEvent.selectOptions(
      screen.getByRole("combobox", { name: /^年份/ }),
      "2025",
    );
    expect(screen.getAllByRole("row")).toHaveLength(3);
    await userEvent.selectOptions(
      screen.getByRole("combobox", { name: /^科目/ }),
      "线性代数",
    );
    await userEvent.selectOptions(
      screen.getByRole("combobox", { name: /^知识点/ }),
      "特征值",
    );
    expect(screen.getAllByRole("row")).toHaveLength(2);
    await userEvent.selectOptions(
      screen.getByRole("combobox", { name: /^掌握状态/ }),
      "已掌握",
    );
    expect(screen.getByText("没有找到匹配的错题")).toBeVisible();
    await userEvent.click(screen.getByRole("button", { name: "重置筛选" }));
    await userEvent.type(
      screen.getByRole("textbox", { name: "搜索错题" }),
      "换元",
    );
    expect(screen.getAllByRole("row")).toHaveLength(2);
    await userEvent.click(screen.getByRole("button", { name: "重置筛选" }));

    await userEvent.click(screen.getByRole("button", { name: "录入错题" }));
    const form = within(screen.getByRole("dialog"));
    fireEvent.change(form.getByLabelText("真题年份 *"), {
      target: { value: "2026" },
    });
    await userEvent.type(form.getByLabelText("题号 *"), "99");
    await userEvent.selectOptions(form.getByLabelText("科目 *"), "线性代数");
    await userEvent.type(form.getByLabelText("知识点标签"), "矩阵秩，线性相关");
    await userEvent.type(
      form.getByLabelText("错误原因 *"),
      "初等变换时漏掉一列",
    );
    fireEvent.change(form.getByLabelText("复做日期"), {
      target: { value: "2026-01-01" },
    });
    await userEvent.type(form.getByLabelText("备注"), "测试用虚构记录");
    await userEvent.click(form.getByRole("button", { name: "保存错题" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(savedQuestions()).toHaveLength(7);
    expect(
      savedQuestions().find((question) => question.questionNumber === "99"),
    ).toMatchObject({
      isDemo: false,
      year: 2026,
      status: "未掌握",
      reviewDate: "2026-01-01",
    });

    view.unmount();
    render(<App />);
    expect(screen.getAllByRole("row")).toHaveLength(8);
    expect(
      screen.getByRole("button", { name: "2026 年 · 第 99 题" }),
    ).toBeVisible();
    await navigate("复习计划");
    const reviewHeading = screen.getByRole("heading", {
      name: "2026 年 · 第 99 题",
    });
    const reviewCard = reviewHeading.closest("article");
    expect(reviewCard).not.toBeNull();
    await userEvent.click(
      within(reviewCard!).getByRole("button", { name: "本轮已掌握" }),
    );
    expect(
      screen.queryByRole("heading", { name: "2026 年 · 第 99 题" }),
    ).not.toBeInTheDocument();
    expect(
      savedQuestions().find((question) => question.questionNumber === "99"),
    ).toMatchObject({ status: "已掌握", reviewDate: null });

    await navigate("数据管理");
    await userEvent.click(
      screen.getByRole("button", { name: "删除演示数据（6）" }),
    );
    expect(window.confirm).toHaveBeenCalledOnce();
    expect(savedQuestions()).toHaveLength(1);
    expect(savedQuestions()[0]).toMatchObject({
      questionNumber: "99",
      isDemo: false,
      status: "已掌握",
    });
    expect(screen.queryByText("演示模式")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "删除演示数据" })).toBeDisabled();
    await navigate("复习计划");
    expect(screen.getByText("当前复习已完成")).toBeVisible();
  });

  it("edits an existing question and respects deletion cancellation before deleting it", async () => {
    render(<App />);
    await userEvent.click(
      screen.getByRole("button", { name: "记录第一道错题" }),
    );
    let form = within(screen.getByRole("dialog"));
    await userEvent.type(form.getByLabelText("题号 *"), "30");
    await userEvent.type(form.getByLabelText("错误原因 *"), "计算失误");
    await userEvent.click(form.getByRole("button", { name: "保存错题" }));
    const original = savedQuestions()[0];
    await navigate("我的错题本");
    await userEvent.click(
      screen.getByRole("button", { name: `编辑 ${original.year} 年第 30 题` }),
    );
    form = within(screen.getByRole("dialog"));
    await userEvent.clear(form.getByLabelText("错误原因 *"));
    await userEvent.type(
      form.getByLabelText("错误原因 *"),
      "检查后确认是概念理解错误",
    );
    await userEvent.selectOptions(form.getByLabelText("掌握状态 *"), "巩固中");
    await userEvent.click(form.getByRole("button", { name: "保存修改" }));
    expect(savedQuestions()).toHaveLength(1);
    expect(savedQuestions()[0]).toMatchObject({
      id: original.id,
      errorReason: "检查后确认是概念理解错误",
      status: "巩固中",
    });
    expect(screen.getByText("检查后确认是概念理解错误")).toBeVisible();

    vi.mocked(window.confirm).mockReturnValueOnce(false);
    await userEvent.click(
      screen.getByRole("button", { name: `删除 ${original.year} 年第 30 题` }),
    );
    expect(savedQuestions()).toHaveLength(1);
    await userEvent.click(
      screen.getByRole("button", { name: `删除 ${original.year} 年第 30 题` }),
    );
    expect(savedQuestions()).toHaveLength(0);
    expect(screen.getByText("从第一道错题开始")).toBeVisible();
  });

  it("protects corrupted local data instead of replacing it with newly entered records or demos", async () => {
    const corruptData = '{"version":1,"questions":"damaged"}';
    localStorage.setItem(STORAGE_KEY, corruptData);
    render(<App />);
    expect(screen.getByRole("alert")).toHaveTextContent("本地数据校验失败");
    await userEvent.click(screen.getByRole("button", { name: "体验演示数据" }));
    expect(localStorage.getItem(STORAGE_KEY)).toBe(corruptData);
    expect(screen.queryByText("演示模式")).not.toBeInTheDocument();
    await userEvent.click(
      screen.getByRole("button", { name: "记录第一道错题" }),
    );
    const form = within(screen.getByRole("dialog"));
    await userEvent.type(form.getByLabelText("题号 *"), "12");
    await userEvent.type(form.getByLabelText("错误原因 *"), "保留未保存的输入");
    await userEvent.click(form.getByRole("button", { name: "保存错题" }));
    await waitFor(() =>
      expect(form.getByRole("alert")).toHaveTextContent("当前填写的内容已保留"),
    );
    expect(form.getByLabelText("错误原因 *")).toHaveValue("保留未保存的输入");
    expect(localStorage.getItem(STORAGE_KEY)).toBe(corruptData);
  });

  it("orders recent records by the actual timestamp and the question list by exam year", async () => {
    const base: Question = {
      id: "recent",
      year: 2024,
      questionNumber: "31",
      subject: "高等数学",
      tags: [],
      errorReason: "虚构测试记录",
      status: "未掌握",
      reviewDate: null,
      notes: "",
      isDemo: false,
      createdAt: "2026-01-01T00:00:00Z",
      updatedAt: "2026-10-26T08:00:00Z",
    };
    const records: Question[] = [
      base,
      {
        ...base,
        id: "older",
        year: 2025,
        questionNumber: "32",
        updatedAt: "2026-10-26T10:00:00+08:00",
      },
    ];
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        version: 1,
        exportedAt: "2026-10-26T09:00:00Z",
        questions: records,
      }),
    );
    render(<App />);
    expect(
      within(screen.getAllByRole("row")[1]).getByRole("button", {
        name: "2024 年 · 第 31 题",
      }),
    ).toBeVisible();
    await navigate("我的错题本");
    expect(
      within(screen.getAllByRole("row")[1]).getByRole("button", {
        name: "2025 年 · 第 32 题",
      }),
    ).toBeVisible();
  });
});
