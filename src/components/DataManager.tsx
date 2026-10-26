import { useRef, useState } from "react";
import type { ChangeEvent } from "react";
import {
  Download,
  FileJson,
  FlaskConical,
  ShieldCheck,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import type { Question } from "../types";
import {
  mergeQuestions,
  parseImport,
  serializeQuestions,
} from "../lib/importExport";
import { localDate } from "../lib/questions";
import { STORAGE_KEY } from "../lib/storage";

interface DataManagerProps {
  questions: Question[];
  onImport: (incoming: Question[]) => { added: number; skipped: number } | null;
  onLoadDemo: () => boolean;
  onRemoveDemo: () => boolean;
}

function downloadText(
  text: string,
  filename: string,
  type = "application/json",
) {
  const url = URL.createObjectURL(
    new Blob([text], { type: `${type};charset=utf-8` }),
  );
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function DataManager({
  questions,
  onImport,
  onLoadDemo,
  onRemoveDemo,
}: DataManagerProps) {
  const [pending, setPending] = useState<{
    name: string;
    questions: Question[];
  } | null>(null);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);
  const [reading, setReading] = useState(false);
  const readId = useRef(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const demoCount = questions.filter((question) => question.isDemo).length;
  const preview = pending ? mergeQuestions(questions, pending.questions) : null;

  const selectFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const requestId = ++readId.current;
    setMessage(null);
    setPending(null);
    setReading(true);
    try {
      if (file.size > 5 * 1024 * 1024)
        throw new Error("文件超过 5 MiB，请拆分后再导入。");
      const result = parseImport(await file.text());
      if (requestId !== readId.current) return;
      if (!result.ok) throw new Error(result.error);
      setPending({ name: file.name, questions: result.questions });
    } catch (error) {
      if (requestId === readId.current)
        setMessage({
          type: "error",
          text:
            error instanceof Error
              ? error.message
              : "文件读取失败，请重新选择文件。",
        });
    } finally {
      if (requestId === readId.current) {
        setReading(false);
        if (inputRef.current) inputRef.current.value = "";
      }
    }
  };

  const exportData = () => {
    try {
      downloadText(
        serializeQuestions(questions),
        `MathTrack-${localDate()}.json`,
      );
      setMessage({
        type: "success",
        text: `已生成包含 ${questions.length} 道错题的 JSON 备份，请查看浏览器下载。`,
      });
    } catch {
      setMessage({
        type: "error",
        text: "导出失败，请检查浏览器下载权限后重试。",
      });
    }
  };

  const exportRaw = () => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw === null) {
        setMessage({ type: "error", text: "当前浏览器没有已保存的原始数据。" });
        return;
      }
      downloadText(raw, `MathTrack-原始备份-${localDate()}.txt`, "text/plain");
      setMessage({
        type: "success",
        text: "已导出未经修改的本地原始备份，可用于排查数据格式问题。",
      });
    } catch {
      setMessage({
        type: "error",
        text: "无法读取或导出原始数据，请检查浏览器存储和下载权限。",
      });
    }
  };

  const confirmImport = () => {
    if (!pending) return;
    const result = onImport(pending.questions);
    if (!result) {
      setMessage({
        type: "error",
        text: "导入未保存，已有记录没有被覆盖。请查看页面顶部的提示。",
      });
      return;
    }
    setPending(null);
    setMessage({
      type: "success",
      text: `导入完成：新增 ${result.added} 道，跳过 ${result.skipped} 道同 ID 记录。`,
    });
  };

  return (
    <div className="data-manager">
      <div className="notice">
        <ShieldCheck size={20} aria-hidden="true" />
        <span>
          你的数据由你掌握。记录仅保存在当前浏览器，请定期导出备份；清除浏览器数据会删除本地记录。
        </span>
      </div>
      {message && (
        <div
          className={`notice ${message.type}`}
          role={message.type === "error" ? "alert" : "status"}
        >
          {message.text}
        </div>
      )}
      <div className="data-grid">
        <section className="card data-card">
          <div className="data-icon">
            <Download size={25} aria-hidden="true" />
          </div>
          <h2 className="section-title">导出备份</h2>
          <p className="muted">
            将全部 {questions.length} 道错题保存为 JSON
            文件。题目、标签、复做安排和演示标记都会保留。
          </p>
          <button className="button primary" onClick={exportData}>
            <Download size={17} aria-hidden="true" />
            导出 JSON
          </button>
          <p className="field-hint">建议每周备份一次，或在更换设备前导出。</p>
        </section>
        <section className="card data-card">
          <div className="data-icon">
            <Upload size={25} aria-hidden="true" />
          </div>
          <h2 className="section-title">导入记录</h2>
          <p className="muted">
            选择 MathTrack 导出的 JSON 文件。完整校验后合并，同 ID
            记录会跳过，已有内容保持不变。
          </p>
          <input
            className="file-input"
            ref={inputRef}
            type="file"
            accept=".json,application/json"
            id="import-file"
            onChange={selectFile}
            aria-label="选择 JSON 备份文件"
            disabled={reading}
          />
          <button
            className="button secondary"
            onClick={() => inputRef.current?.click()}
            disabled={reading}
          >
            <Upload size={17} aria-hidden="true" />
            {reading ? "正在校验…" : "选择 JSON 文件"}
          </button>
          <p className="field-hint">
            单文件最多 5 MiB，合并后最多 10,000 条记录。
          </p>
        </section>
      </div>
      {pending && preview && (
        <section
          className="card import-preview"
          aria-labelledby="import-preview-title"
        >
          <div className="section-heading">
            <h2 id="import-preview-title" className="section-title">
              <FileJson size={20} aria-hidden="true" /> 导入预览
            </h2>
            <button
              className="icon-button"
              aria-label="取消导入"
              onClick={() => setPending(null)}
            >
              <X size={18} />
            </button>
          </div>
          <p className="muted">文件：{pending.name}</p>
          <p>
            校验通过，共 {pending.questions.length} 条记录。将新增{" "}
            <strong>{preview.added}</strong> 道，跳过{" "}
            <strong>{preview.skipped}</strong> 道同 ID 记录。
          </p>
          {preview.questions.length > 10000 && (
            <p className="form-error" role="alert">
              合并后超过 10,000 条上限，请减少导入记录。
            </p>
          )}
          <div className="button-group">
            <button
              className="button primary"
              onClick={confirmImport}
              disabled={preview.questions.length > 10000}
            >
              确认合并导入
            </button>
            <button
              className="button secondary"
              onClick={() => setPending(null)}
            >
              取消
            </button>
          </div>
        </section>
      )}
      <section className="card data-card demo-data-card">
        <div className="data-icon">
          <FlaskConical size={25} aria-hidden="true" />
        </div>
        <h2 className="section-title">演示数据</h2>
        <p className="muted">
          用 6
          道虚构样例体验筛选和统计，不含真实真题内容或个人数据。每道样例均带有「演示」标记，可单独编辑或删除。
        </p>
        <div className="button-group">
          <button
            className="button secondary"
            onClick={() => {
              if (onLoadDemo())
                setMessage({
                  type: "success",
                  text: "演示数据已载入，已有的同 ID 样例会自动跳过。",
                });
            }}
          >
            <FlaskConical size={17} aria-hidden="true" />
            载入演示数据
          </button>
          <button
            className="button danger"
            disabled={demoCount === 0}
            onClick={() => {
              if (
                window.confirm(
                  `确定删除全部 ${demoCount} 道演示题目？这些样例的编辑内容也会删除，正式记录不受影响。`,
                ) &&
                onRemoveDemo()
              ) {
                setMessage({
                  type: "success",
                  text: "演示数据已删除，正式记录已保留。",
                });
              }
            }}
          >
            <Trash2 size={17} aria-hidden="true" />
            删除演示数据{demoCount > 0 ? `（${demoCount}）` : ""}
          </button>
        </div>
      </section>
      <section className="card data-card">
        <h2 className="section-title">本地数据恢复</h2>
        <p className="muted">
          若本地数据校验失败，应用会暂停写入并保留原始内容。可先下载原始备份进行检查，再按照
          README 的恢复步骤操作。
        </p>
        <button className="button secondary" onClick={exportRaw}>
          <Download size={17} aria-hidden="true" />
          导出本地原始备份
        </button>
      </section>
    </div>
  );
}
