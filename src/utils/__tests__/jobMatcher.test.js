import { describe, it, expect, beforeEach } from "vitest";
import { extractKeywords, calculateKeywordMatch, calculateDualScore, getMatchLabelV2 } from "../jobMatcher.js";

describe("extractKeywords", () => {
  it("should extract tech keywords from English text", () => {
    const text = "We need someone skilled in Python, PyTorch, and Docker";
    const kw = extractKeywords(text);
    expect(kw).toContain("python");
    expect(kw).toContain("pytorch");
    expect(kw).toContain("docker");
  });

  it("should extract Chinese skill keywords", () => {
    const text = "熟悉深度学习、计算机视觉、自然语言处理等技术";
    const kw = extractKeywords(text);
    expect(kw).toContain("深度学习");
    expect(kw).toContain("计算机视觉");
    expect(kw).toContain("自然语言处理");
  });

  it("should return empty array for empty input", () => {
    expect(extractKeywords("")).toEqual([]);
    expect(extractKeywords(null)).toEqual([]);
    expect(extractKeywords(undefined)).toEqual([]);
  });

  it("should deduplicate keywords", () => {
    const kw = extractKeywords("python python pytorch pytorch");
    expect(kw.length).toBe(2);
  });
});

describe("calculateKeywordMatch", () => {
  const resumeText = `
    Skilled in Python, PyTorch, YOLO, LangChain, RAG, Docker.
    Experience with deep learning, computer vision, natural language processing.
    Frontend: Vue.js, Vite. Backend: FastAPI, Streamlit.
  `;

  it("should score highly when JD matches resume skills", () => {
    const jdText = "Looking for Python, PyTorch, deep learning, computer vision engineer";
    const result = calculateKeywordMatch(jdText, resumeText);
    expect(result.score).toBeGreaterThan(50);
    expect(result.matchedKeywords.length).toBeGreaterThan(2);
  });

  it("should score low when JD has no overlap", () => {
    const jdText = "Looking for Java, Spring Boot, MySQL backend developer";
    const result = calculateKeywordMatch(jdText, resumeText);
    expect(result.score).toBeLessThan(30);
  });

  it("should return 0 for empty inputs", () => {
    expect(calculateKeywordMatch("", "").score).toBe(0);
  });

  it("should include matched keywords in output", () => {
    const result = calculateKeywordMatch("Python developer", "Python expert");
    expect(result.matchedKeywords).toContain("python");
  });
});

describe("calculateDualScore", () => {
  it("should return keyword score when AI score is null", () => {
    expect(calculateDualScore(80, null)).toBe(80);
  });

  it("should combine keyword and AI scores equally", () => {
    expect(calculateDualScore(80, 60)).toBe(70); // 80*0.5 + 60*0.5 = 70
  });

  it("should handle edge cases", () => {
    expect(calculateDualScore(0, 0)).toBe(0);
    expect(calculateDualScore(100, 100)).toBe(100);
  });
});

describe("getMatchLabelV2", () => {
  it("should return correct label for different score ranges", () => {
    expect(getMatchLabelV2(85).text).toBe("完美匹配");
    expect(getMatchLabelV2(70).text).toBe("高度匹配");
    expect(getMatchLabelV2(50).text).toBe("部分匹配");
    expect(getMatchLabelV2(30).text).toBe("较低匹配");
    expect(getMatchLabelV2(10).text).toBe("暂不匹配");
  });

  it("should include numeric level", () => {
    expect(getMatchLabelV2(85).level).toBe(5);
    expect(getMatchLabelV2(10).level).toBe(1);
  });
});
