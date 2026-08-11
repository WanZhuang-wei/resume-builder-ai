import { describe, it, expect } from "vitest";
import { calculateATSScore, getATSScoreLabel } from "../atsScorer.js";

const fullResume = [
  "姓名：韦万壮",
  "电话：15117894129",
  "邮箱：3519543133@qq.com",
  "教育背景：遵义医科大学 本科",
  "技能：Python, PyTorch, YOLO, LangChain",
  "工作经历：3年AI开发经验",
  "主导设计并搭建了完整的RAG系统",
  "项目经验：参与3个AI项目",
  "获奖：省级三等奖",
].join("\n");

describe("calculateATSScore", () => {
  it("should return high score for complete resume", () => {
    const r = calculateATSScore(fullResume);
    expect(r.score).toBeGreaterThanOrEqual(50);
    expect(r.level).toMatch(/优秀|良好|一般/);
    expect(r.passedCount).toBeGreaterThan(5);
  });

  it("should return 0 for empty text", () => {
    const r = calculateATSScore("");
    expect(r.score).toBe(0);
    expect(r.suggestions[0]).toContain("过短");
  });

  it("should return low score for minimal text", () => {
    const r = calculateATSScore("hello world");
    expect(r.score).toBeLessThan(30);
  });

  it("should include improvement suggestions", () => {
    const r = calculateATSScore("姓名：张三 电话 13800138000");
    expect(r.suggestions.length).toBeGreaterThan(0);
  });

  it("should include detail breakdown", () => {
    const r = calculateATSScore(fullResume);
    expect(r.details.length).toBeGreaterThan(0);
    expect(r.details[0].name).toBeTruthy();
    expect(typeof r.details[0].passed).toBe("boolean");
  });
});

describe("getATSScoreLabel", () => {
  it("should return correct label for each level", () => {
    expect(getATSScoreLabel(90).text).toBe("ATS友好");
    expect(getATSScoreLabel(80).text).toBe("良好");
    expect(getATSScoreLabel(60).text).toBe("一般");
    expect(getATSScoreLabel(40).text).toBe("待优化");
    expect(getATSScoreLabel(20).text).toBe("较差");
  });
});
