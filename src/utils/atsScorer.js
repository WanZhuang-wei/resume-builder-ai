import { metrics } from "@/utils/metrics";

export function calculateATSScore(resumeText) {
  if (!resumeText || typeof resumeText !== "string" || resumeText.trim().length < 20) {
    return { score: 0, level: "无法评估", passed: 0, total: 0, suggestions: ["简历文本过短，无法评估"] };
  }

  const checks = [
    { pattern: /(教育背景|教育|学历|学校|大学|学院)[\s\S]{0,30}/i, weight: 10, name: "教育背景", tip: "添加教育背景章节" },
    { pattern: /(工作经历|工作经验|工作|实习|就职)[\s\S]{0,30}/i,  weight: 12, name: "工作经历", tip: "添加工作经历章节" },
    { pattern: /(技能|掌握|熟练|精通|核心技术|Skills)[\s\S]{0,20}/i, weight: 10, name: "技能", tip: "添加技能清单章节" },
    { pattern: /(项目经历|项目经验|项目|Projects)[\s\S]{0,20}/i,     weight: 10, name: "项目经验", tip: "添加项目经验章节" },
    { pattern: /1\d{10}/, weight: 8, name: "手机号", tip: "添加联系方式" },
    { pattern: /[\w.-]+@[\w.-]+\.\w+/, weight: 7, name: "邮箱", tip: "添加邮箱地址" },
    { pattern: /(姓名|名字|Name)[：:\s]/i, weight: 5, name: "姓名", tip: "添加姓名" },
    { pattern: /\d+[%％]/, weight: 8, name: "量化成果(百分比)", tip: "用百分比量化工作成果" },
    { pattern: /\d+\s*[+\-×x]|\d{2,}(?:\s*万|\s*千|\s*以上\b)/, weight: 7, name: "量化数据(规模/数量)", tip: "用具体数字说明工作规模" },
    { pattern: /(Python|Java|PyTorch|TensorFlow|Vue|React|Docker|K8s)/i, weight: 10, name: "技术关键词", tip: "增加具体技术栈关键词" },
    { pattern: /(主导|设计|搭建|优化|重构|推动|负责)/, weight: 8, name: "动词开头", tip: "用强动词开头描述工作内容" },
    { pattern: /(获奖|荣誉|证书|Certification)/i, weight: 5, name: "证书/荣誉", tip: "添加证书或荣誉" },
  ];

  let score = 0;
  const suggestions = [];
  let passed = 0;

  for (const c of checks) {
    if (c.pattern.test(resumeText)) {
      score += c.weight;
      passed++;
    } else {
      suggestions.push(c.tip);
    }
  }

  const totalWeight = checks.reduce((s, c) => s + c.weight, 0);
  const finalScore = Math.round((score / totalWeight) * 100);

  let level = "较差";
  if (finalScore >= 85) level = "优秀";
  else if (finalScore >= 70) level = "良好";
  else if (finalScore >= 50) level = "一般";
  else if (finalScore >= 30) level = "待优化";

  return {
    score: finalScore,
    level,
    passed: passed + "/" + checks.length,
    passedCount: passed,
    totalChecks: checks.length,
    suggestions: suggestions.slice(0, 5),
    details: checks.map(c => ({
      name: c.name,
      passed: c.pattern.test(resumeText),
      weight: c.weight,
    })),
  };
}

export function getATSScoreLabel(score) {
  if (score >= 85) return { text: "ATS友好", color: "#07c160", level: "A" };
  if (score >= 70) return { text: "良好",    color: "#1989fa", level: "B" };
  if (score >= 50) return { text: "一般",    color: "#ff976a", level: "C" };
  if (score >= 30) return { text: "待优化",  color: "#ff6b6b", level: "D" };
  return { text: "较差",     color: "#ccc",  level: "E" };
}
