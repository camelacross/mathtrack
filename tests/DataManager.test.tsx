import { describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DataManager } from "../src/components/DataManager";
import type { Question } from "../src/types";

const existing: Question = {
  id: "saved-question",
  year: 2025,
  questionNumber: "19",
  subject: "高等数学",
  tags: ["定积分"],
  errorReason: "换元遗漏上下限",
  status: "未掌握",
  reviewDate: null,
  notes: "原来的笔记",
  isDemo: false,
  createdAt: "2026-10-26T10:00:00.000Z",
  updatedAt: "2026-10-26T10:00:00.000Z",
};
const incoming: Question = {
  ...existing,
  id: "new-question",
  questionNumber: "20",
};

function backup(questions: unknown[]): string {
  return JSON.stringify({
    version: 1,
    exportedAt: "2026-10-26T10:00:00.000Z",
    questions,
  });
}

function jsonFile(text: string, name = "MathTrack-backup.json") {
  const file = new File([text], name, { type: "application/json" });
  const read = vi.fn(async () => text);
  Object.defineProperty(file, "text", { value: read });
  return { file, read };
}

function setup(
  result: { added: number; skipped: number } | null = { added: 1, skipped: 0 },
) {
  const onImport = vi.fn((_questions: Question[]) => result);
  render(
    <DataManager
      questions={[existing]}
      onImport={onImport}
      onLoadDemo={vi.fn(() => true)}
      onRemoveDemo={vi.fn(() => true)}
    />,
  );
  return {
    onImport,
    user: userEvent.setup(),
    input: screen.getByLabelText("选择 JSON 备份文件"),
  };
}

describe("DataManager import workflow", () => {
  it.each([
    ["malformed JSON", "{ invalid json", "无法解析 JSON"],
    [
      "invalid record in an otherwise valid backup",
      backup([incoming, { ...incoming, id: "bad-record", year: "2025" }]),
      "年份须为",
    ],
  ])(
    "rejects %s before offering a preview or changing records",
    async (_name, text, message) => {
      const { onImport, user, input } = setup();
      await user.upload(input, jsonFile(text).file);
      expect(await screen.findByRole("alert")).toHaveTextContent(message);
      expect(
        screen.queryByRole("region", { name: "导入预览" }),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByRole("button", { name: "确认合并导入" }),
      ).not.toBeInTheDocument();
      expect(onImport).not.toHaveBeenCalled();
      expect(input).not.toBeDisabled();
    },
  );

  it("previews added and duplicate counts, then imports only after confirmation", async () => {
    const { onImport, user, input } = setup({ added: 1, skipped: 1 });
    const changedDuplicate = { ...existing, notes: "导入文件中的另一版笔记" };
    await user.upload(
      input,
      jsonFile(backup([changedDuplicate, incoming])).file,
    );
    const preview = await screen.findByRole("region", { name: "导入预览" });
    expect(preview).toHaveTextContent(
      "校验通过，共 2 条记录。将新增 1 道，跳过 1 道同 ID 记录。",
    );
    expect(preview).toHaveTextContent("MathTrack-backup.json");
    expect(onImport).not.toHaveBeenCalled();
    expect(existing.notes).toBe("原来的笔记");
    await user.click(
      within(preview).getByRole("button", { name: "确认合并导入" }),
    );
    expect(onImport).toHaveBeenCalledOnce();
    expect(onImport).toHaveBeenCalledWith([changedDuplicate, incoming]);
    expect(screen.getByRole("status")).toHaveTextContent(
      "导入完成：新增 1 道，跳过 1 道同 ID 记录。",
    );
    expect(
      screen.queryByRole("region", { name: "导入预览" }),
    ).not.toBeInTheDocument();
  });

  it("allows cancelling a validated preview without any write", async () => {
    const { onImport, user, input } = setup();
    await user.upload(input, jsonFile(backup([incoming])).file);
    const preview = await screen.findByRole("region", { name: "导入预览" });
    await user.click(within(preview).getByRole("button", { name: "取消" }));
    expect(
      screen.queryByRole("region", { name: "导入预览" }),
    ).not.toBeInTheDocument();
    expect(onImport).not.toHaveBeenCalled();
  });

  it("retains the validated preview when saving fails so the user can retry", async () => {
    const { onImport, user, input } = setup(null);
    await user.upload(input, jsonFile(backup([incoming])).file);
    const preview = await screen.findByRole("region", { name: "导入预览" });
    await user.click(
      within(preview).getByRole("button", { name: "确认合并导入" }),
    );
    expect(onImport).toHaveBeenCalledOnce();
    expect(screen.getByRole("alert")).toHaveTextContent(
      "导入未保存，已有记录没有被覆盖",
    );
    expect(
      screen.getByRole("region", { name: "导入预览" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "确认合并导入" })).toBeEnabled();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("rejects an oversized file before reading its contents", async () => {
    const { onImport, user, input } = setup();
    const { file, read } = jsonFile("{}");
    Object.defineProperty(file, "size", { value: 5 * 1024 * 1024 + 1 });
    await user.upload(input, file);
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "文件超过 5 MiB",
    );
    expect(read).not.toHaveBeenCalled();
    expect(onImport).not.toHaveBeenCalled();
    expect(
      screen.queryByRole("region", { name: "导入预览" }),
    ).not.toBeInTheDocument();
  });
});
