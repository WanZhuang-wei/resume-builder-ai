import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { metrics } from "../metrics.js";
import { calculateATSScore } from "../atsScorer.js";

describe("history snapshots", () => {
  beforeEach(() => { metrics.clear(); metrics.clearHistory(); });
  afterEach(() => {
    metrics.clearHistory();
    const keys = Object.keys(localStorage);
    for (const k of keys) {
      if (k.startsWith("resume_metrics_")) localStorage.removeItem(k);
    }
  });

  it("should save and retrieve snapshots", () => {
    metrics.recordApiCall({ duration: 100, success: true });
    metrics.saveSnapshot();
    const h = metrics.getHistory();
    expect(h.length).toBe(1);
    expect(h[0].api.totalCalls).toBe(1);
    expect(h[0].date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("should keep multiple snapshots", () => {
    metrics.recordApiCall({ duration: 100, success: true });
    metrics.saveSnapshot();
    metrics.recordParse({ format: "pdf", duration: 500, success: true });
    metrics.saveSnapshot();
    expect(metrics.getHistory().length).toBe(2);
  });

  it("should persist snapshots across clear", () => {
    metrics.recordApiCall({ duration: 100, success: true });
    metrics.saveSnapshot();
    metrics.clear();
    const h = metrics.getHistory();
    expect(h.length).toBe(1);
  });
});

describe("ATS scorer integration", () => {
  it("should produce reasonable scores for real resume text", () => {
    const resume = ["姓名：韦万壮","电话：15117894129","邮箱：test@test.com","教育背景：遵义医科大学 本科","技能：Python, PyTorch","工作经验：3年AI开发","主导了RAG系统搭建","项目经验：2个AI项目"].join("\n");
    const r = calculateATSScore(resume);
    expect(r.score).toBeGreaterThan(30);
    expect(r.passedCount).toBeGreaterThan(5);
  });

  it("should detect missing sections", () => {
    const r = calculateATSScore("hello world");
    expect(r.score).toBeLessThan(30);
  });
});
