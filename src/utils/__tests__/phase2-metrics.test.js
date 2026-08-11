import { describe, it, expect, beforeEach } from "vitest";
import { createPinia, setActivePinia } from "pinia";
import { estimateAccuracy } from "../parser.js";

describe("estimateAccuracy", () => {
  const fullResume = [
    "姓名：韦万壮",
    "电话：15117894129",
    "邮箱：3519543133@qq.com",
    "教育背景：遵义医科大学 本科",
    "技能：Python, PyTorch, YOLO",
    "工作经验：3年软件开发经验",
    "项目经验：参与3个AI项目开发",
  ].join("\n");

  it("should return high score for complete resume text", () => {
    expect(estimateAccuracy(fullResume)).toBeGreaterThanOrEqual(85);
  });

  it("should return 0 for empty or short text", () => {
    expect(estimateAccuracy("")).toBe(0);
    expect(estimateAccuracy(null)).toBe(0);
    expect(estimateAccuracy("short")).toBe(0);
  });

  it("should return partial score for incomplete resume", () => {
    const partial = ["姓名：张三", "技能：Python, Java", "有3年工作经验"].join("\n");
    const score = estimateAccuracy(partial);
    expect(score).toBeGreaterThan(0);
    expect(score).toBeLessThan(100);
  });

  it("should score higher with more fields present", () => {
    const minimal = "姓名：张三 电话：13800138000";
    const moderate = "姓名：张三 电话：13800138000 邮箱：test@test.com 本科";
    expect(estimateAccuracy(moderate)).toBeGreaterThan(estimateAccuracy(minimal));
  });
});

describe("share store viewCount (via Pinia)", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it("should increment and retrieve view count", async () => {
    const { useShareStore } = await import("../../stores/share.js");
    const store = useShareStore();
    expect(store.getViewCount("token-12345")).toBe(0);
    store.incrementViewCount("token-12345");
    expect(store.getViewCount("token-12345")).toBe(1);
    store.incrementViewCount("token-12345");
    expect(store.getViewCount("token-12345")).toBe(2);
  });

  it("should handle empty token", async () => {
    const { useShareStore } = await import("../../stores/share.js");
    const store = useShareStore();
    store.incrementViewCount(null);
    store.incrementViewCount("");
    // should not throw
    expect(true).toBe(true);
  });

  it("should maintain separate counts for different tokens", async () => {
    const { useShareStore } = await import("../../stores/share.js");
    const store = useShareStore();
    store.incrementViewCount("token-a");
    store.incrementViewCount("token-b");
    store.incrementViewCount("token-a");
    expect(store.getViewCount("token-a")).toBe(2);
    expect(store.getViewCount("token-b")).toBe(1);
  });
});
