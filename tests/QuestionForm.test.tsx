import { beforeAll, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QuestionForm } from "../src/components/QuestionForm";
import type { Question } from "../src/types";

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

const fixture: Question = {
  id: "edit-test",
  year: 2024,
  questionNumber: "数学二 · 18",
  subject: "线性代数",
  tags: ["特征值", "二次型"],
  errorReason: "忽略对称性",
  status: "巩固中",
  reviewDate: "2026-11-01",
  notes: "重新推导",
  isDemo: false,
  createdAt: "2026-10-26T00:00:00.000Z",
  updatedAt: "2026-10-26T00:00:00.000Z",
};

describe("QuestionForm", () => {
  it("validates required values without saving", async () => {
    const save = vi.fn(() => true);
    render(<QuestionForm onSave={save} onClose={vi.fn()} />);
    await userEvent.click(screen.getByRole("button", { name: "保存错题" }));
    expect(screen.getByRole("alert")).toHaveTextContent("请填写题号");
    expect(save).not.toHaveBeenCalled();
    await userEvent.type(screen.getByLabelText("题号 *"), "第 1 题");
    await userEvent.click(screen.getByRole("button", { name: "保存错题" }));
    expect(screen.getByRole("alert")).toHaveTextContent("请填写错误原因");
    expect(save).not.toHaveBeenCalled();
  });

  it("saves a normalized draft with deduplicated tags and an optional date", async () => {
    const save = vi.fn(() => true);
    const close = vi.fn();
    render(<QuestionForm onSave={save} onClose={close} />);
    fireEvent.change(screen.getByLabelText("真题年份 *"), {
      target: { value: "2025" },
    });
    await userEvent.type(screen.getByLabelText("题号 *"), "  第 8 题  ");
    await userEvent.type(
      screen.getByLabelText("错误原因 *"),
      "  展开阶数不足  ",
    );
    await userEvent.type(
      screen.getByLabelText("知识点标签"),
      " 极限，泰勒公式, 极限, ",
    );
    await userEvent.click(screen.getByRole("button", { name: "保存错题" }));
    expect(save).toHaveBeenCalledWith({
      year: 2025,
      questionNumber: "第 8 题",
      subject: "高等数学",
      tags: ["极限", "泰勒公式"],
      errorReason: "展开阶数不足",
      status: "未掌握",
      reviewDate: null,
      notes: "",
    });
    expect(close).toHaveBeenCalledOnce();
  });

  it("prepopulates every field when editing and supports status/date changes", async () => {
    const save = vi.fn(() => true);
    render(<QuestionForm question={fixture} onSave={save} onClose={vi.fn()} />);
    expect(screen.getByLabelText("真题年份 *")).toHaveValue(2024);
    expect(screen.getByLabelText("题号 *")).toHaveValue(fixture.questionNumber);
    expect(screen.getByLabelText("科目 *")).toHaveValue("线性代数");
    expect(screen.getByLabelText("知识点标签")).toHaveValue("特征值，二次型");
    expect(screen.getByLabelText("错误原因 *")).toHaveValue("忽略对称性");
    expect(screen.getByLabelText("掌握状态 *")).toHaveValue("巩固中");
    expect(screen.getByLabelText("复做日期")).toHaveValue("2026-11-01");
    expect(screen.getByLabelText("备注")).toHaveValue("重新推导");
    await userEvent.selectOptions(
      screen.getByLabelText("掌握状态 *"),
      "已掌握",
    );
    fireEvent.change(screen.getByLabelText("复做日期"), {
      target: { value: "" },
    });
    await userEvent.click(screen.getByRole("button", { name: "保存修改" }));
    expect(save).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "已掌握",
        reviewDate: null,
        notes: "重新推导",
      }),
    );
  });

  it("preserves imported literal commas in tags when editing only another field", async () => {
    const save = vi.fn(() => true);
    const importedTags = ["连续,可导", "可微，偏导"];
    render(
      <QuestionForm
        question={{ ...fixture, tags: importedTags }}
        onSave={save}
        onClose={vi.fn()}
      />,
    );
    await userEvent.clear(screen.getByLabelText("备注"));
    await userEvent.type(
      screen.getByLabelText("备注"),
      "只修改复做心得，不改变已有知识点",
    );
    await userEvent.click(screen.getByRole("button", { name: "保存修改" }));
    expect(save).toHaveBeenCalledWith(
      expect.objectContaining({
        tags: importedTags,
        notes: "只修改复做心得，不改变已有知识点",
      }),
    );
  });

  it("rejects invalid years and excessive tags", async () => {
    const save = vi.fn(() => true);
    render(<QuestionForm question={fixture} onSave={save} onClose={vi.fn()} />);
    fireEvent.change(screen.getByLabelText("真题年份 *"), {
      target: { value: "1986" },
    });
    await userEvent.click(screen.getByRole("button", { name: "保存修改" }));
    expect(screen.getByRole("alert")).toHaveTextContent("1987–2100");
    fireEvent.change(screen.getByLabelText("真题年份 *"), {
      target: { value: "2024" },
    });
    fireEvent.change(screen.getByLabelText("知识点标签"), {
      target: {
        value: Array.from({ length: 21 }, (_, i) => `标签${i}`).join(","),
      },
    });
    await userEvent.click(screen.getByRole("button", { name: "保存修改" }));
    expect(screen.getByRole("alert")).toHaveTextContent(
      "最多填写 20 个知识点标签",
    );
    expect(save).not.toHaveBeenCalled();
  });

  it("cancels without writing and handles native Escape cancellation", async () => {
    const save = vi.fn(() => true);
    const close = vi.fn();
    render(<QuestionForm question={fixture} onSave={save} onClose={close} />);
    await userEvent.click(screen.getByRole("button", { name: "取消" }));
    expect(close).toHaveBeenCalledOnce();
    fireEvent(
      screen.getByRole("dialog"),
      new Event("cancel", { bubbles: false, cancelable: true }),
    );
    expect(close).toHaveBeenCalledTimes(2);
    expect(save).not.toHaveBeenCalled();
  });

  it("keeps the form and entered content when persistence fails", async () => {
    const save = vi.fn(() => false);
    const close = vi.fn();
    render(<QuestionForm question={fixture} onSave={save} onClose={close} />);
    await userEvent.click(screen.getByRole("button", { name: "保存修改" }));
    expect(save).toHaveBeenCalledOnce();
    expect(close).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog")).toBeVisible();
    expect(screen.getByLabelText("错误原因 *")).toHaveValue("忽略对称性");
    expect(screen.getByRole("alert")).toHaveTextContent("当前填写的内容已保留");
  });
});
