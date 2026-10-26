import type { Question } from "../types";
import { localDate } from "./questions";

export function createDemoQuestions(today = localDate()): Question[] {
  const now = new Date().toISOString();
  const nextWeek = new Date(`${today}T12:00:00`);
  nextWeek.setDate(nextWeek.getDate() + 7);
  const shared = { isDemo: true, createdAt: now, updatedAt: now };
  return [
    {
      ...shared,
      id: "demo-calculus-01",
      year: 2025,
      questionNumber: "18",
      subject: "高等数学",
      tags: ["定积分", "积分换元"],
      errorReason: "换元后遗漏了积分上下限的同步变换。",
      status: "未掌握",
      reviewDate: today,
      notes:
        "【虚构演示数据】仅展示记录方式，年份和题号不对应真实题目。复做时先写清变量与积分区间。",
    },
    {
      ...shared,
      id: "demo-calculus-02",
      year: 2024,
      questionNumber: "7",
      subject: "高等数学",
      tags: ["多元函数", "偏导数"],
      errorReason: "未区分偏导数存在与函数可微的条件。",
      status: "巩固中",
      reviewDate: today,
      notes: "【虚构演示数据】不对应真实真题。整理可微、连续和偏导存在的关系。",
    },
    {
      ...shared,
      id: "demo-algebra-01",
      year: 2025,
      questionNumber: "21",
      subject: "线性代数",
      tags: ["特征值", "矩阵对角化"],
      errorReason: "计算重特征值后，没有检查对应特征向量的线性无关性。",
      status: "未掌握",
      reviewDate: null,
      notes:
        "【虚构演示数据】不对应真实真题。先判断可对角化的条件，再进行计算。",
    },
    {
      ...shared,
      id: "demo-probability-01",
      year: 2023,
      questionNumber: "22",
      subject: "概率论与数理统计",
      tags: ["条件概率", "全概率公式"],
      errorReason: "没有按完备事件组拆分样本空间。",
      status: "已掌握",
      reviewDate: localDate(nextWeek),
      notes:
        "【虚构演示数据】不对应真实真题。完成一次独立复做后，安排后续巩固。",
    },
    {
      ...shared,
      id: "demo-calculus-03",
      year: 2023,
      questionNumber: "16",
      subject: "高等数学",
      tags: ["定积分", "积分应用"],
      errorReason: "分段区间判断不完整，遗漏一段积分。",
      status: "已掌握",
      reviewDate: null,
      notes: "【虚构演示数据】不对应真实真题。先画图确认区间，再列积分。",
    },
    {
      ...shared,
      id: "demo-algebra-02",
      year: 2024,
      questionNumber: "10",
      subject: "线性代数",
      tags: ["二次型", "矩阵对角化"],
      errorReason: "正交变换时没有将特征向量单位化。",
      status: "巩固中",
      reviewDate: localDate(nextWeek),
      notes:
        "【虚构演示数据】不对应真实真题。检查正交矩阵的列向量是否标准正交。",
    },
  ];
}
