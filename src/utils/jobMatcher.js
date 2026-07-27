// 双引擎匹配度评分 — 关键词提取 + Jaccard 相似度

// ===== 关键词提取 =====

/** 中文/英文技术关键词正则 */
const TECH_PATTERN = /[A-Za-z][A-Za-z0-9+#.-]{1,}/g;
const CHINESE_SKILLS = [
  "深度学习","机器学习","自然语言处理","计算机视觉","多模态","大模型",
  "知识库","向量数据库","数据分析","数据挖掘","数据清洗","数据标注",
  "模型部署","模型训练","模型量化","模型压缩","迁移学习","微调",
  "前端开发","后端开发","全栈开发","接口开发","系统集成",
  "分布式","容器化","自动化测试","敏捷开发","项目管理",
  "需求分析","架构设计","技术文档","代码审查","性能优化",
  "电商","金融","医疗","教育","制造","零售","物流",
  "人工智能","神经网络","强化学习","图像处理","语音识别",
  "文本生成","语义理解","信息抽取","情感分析","推荐系统",
  "异常检测","时序预测","目标检测","图像分割","关键点检测",
  "特征工程","数据可视化","统计分析","假设检验","AB测试",
  "产品原型","用户研究","交互设计","视觉设计","服务设计",
  "数字孪生","边缘计算","云计算","物联网","区块链"
];

const TECH_TERMS = [
  "python","java","javascript","typescript","node.js","c++","go","rust","ruby",
  "pytorch","tensorflow","keras","scikit-learn","onnx","tensorrt",
  "yolo","detectron","fastai","huggingface","transformers",
  "langchain","langgraph","llamaindex","haystack","chromadb","pinecone","weaviate",
  "deepseek","openai","claude","gemini","qwen","dify","fastgpt",
  "docker","kubernetes","nginx","redis","kafka","rabbitmq",
  "gradio","streamlit","dash","flask","fastapi","express",
  "vue","react","angular","svelte","vite","webpack",
  "mysql","postgresql","mongodb","sqlite","elasticsearch",
  "git","github","gitlab","ci/cd","jenkins","github actions",
  "pandas","numpy","scipy","opencv","pydicom","matplotlib",
  "rag","agent","mcp","aigc","prompt","fine-tuning","lora",
  "playwright","selenium","puppeteer","tesseract","ocr",
  "stable diffusion","clip","dall-e","whisper","asr","tts",
  "rpa","uipath","power automate","codex","cursor"
];

/**
 * 从文本中提取关键词（中文技能词 + 英文技术词）
 */
export function extractKeywords(text) {
  if (!text) return [];
  const lower = text.toLowerCase();

  // 提取英文技术词
  const engMatches = lower.match(TECH_PATTERN) || [];
  const engKeywords = engMatches
    .map(w => w.toLowerCase().trim())
    .filter(w => TECH_TERMS.some(term => w.includes(term) || term.includes(w)))
    .filter((w, i, arr) => arr.indexOf(w) === i); // dedup

  // 提取中文技能词
  const cnKeywords = CHINESE_SKILLS.filter(skill => lower.includes(skill));

  // 合并去重
  return [...new Set([...cnKeywords, ...engKeywords])];
}

/**
 * 计算 Jaccard 相似度（0-100）
 * J(A,B) = |A ∩ B| / |A ∪ B|
 */
export function calculateKeywordMatch(jdText, resumeText) {
  const jdKw = extractKeywords(jdText);
  const resumeKw = extractKeywords(resumeText);

  if (jdKw.length === 0 && resumeKw.length === 0) return { score: 0, jdKeywords: [], resumeKeywords: [], matchedKeywords: [], jdCoverage: 0, resumeRelevance: 0 };

  const intersection = jdKw.filter(k => resumeKw.includes(k));
  // For match rate, we measure: what % of JD keywords appear in the resume
  // This is more meaningful than pure Jaccard for job matching
  const matchRate = jdKw.length > 0
    ? (intersection.length / jdKw.length) * 100
    : 0;

  // Also compute how many resume keywords are relevant to the JD
  const relevantRate = resumeKw.length > 0
    ? (intersection.length / resumeKw.length) * 100
    : 0;

  // Combined score: weighted average (JD coverage 60% + resume relevance 40%)
  const combinedScore = matchRate * 0.6 + relevantRate * 0.4;

  return {
    score: Math.round(combinedScore * 10) / 10,
    jdKeywords: jdKw,
    resumeKeywords: resumeKw,
    matchedKeywords: intersection,
    jdCoverage: Math.round(matchRate * 10) / 10,
    resumeRelevance: Math.round(relevantRate * 10) / 10,
  };
}

/**
 * 双引擎评分 = 关键词匹配(50%) + AI语义评分(50%)
 * @param {number} keywordScore - 从 calculateKeywordMatch 得到的分数
 * @param {number} aiScore - AI 分析给出的分数 (null 表示未提供)
 */
export function calculateDualScore(keywordScore, aiScore = null) {
  if (aiScore === null) {
    return Math.round(keywordScore);
  }
  return Math.round(keywordScore * 0.5 + aiScore * 0.5);
}

/**
 * 根据分数返回匹配度标签 (含数字等级)
 */
export function getMatchLabelV2(score) {
  if (score >= 80) return { text: "完美匹配", color: "#07c160", level: 5 };
  if (score >= 65) return { text: "高度匹配", color: "#1989fa", level: 4 };
  if (score >= 45) return { text: "部分匹配", color: "#ff976a", level: 3 };
  if (score >= 25) return { text: "较低匹配", color: "#ff6b6b", level: 2 };
  return { text: "暂不匹配", color: "#ccc", level: 1 };
}



// ===== 以下函数由 git 历史恢复 =====

/**
 * 计算用户与岗位的匹配度 (0-100)
 */
export function computeMatchScore(userProfile, job) {
  let score = 0
  let totalWeight = 0
  const userSkills = (userProfile.skills || []).map(s => s.name?.toLowerCase().trim()).filter(Boolean)
  const jobSkills = (job.requiredSkills || []).map(s => s.toLowerCase().trim())
  if (userSkills.length > 0 && jobSkills.length > 0) {
    const matched = jobSkills.filter(js => userSkills.some(us => us.includes(js) || js.includes(us))).length
    score += (matched / jobSkills.length) * 50
    totalWeight += 50
  }
  const userExps = userProfile.workExperiences || []
  const totalYears = userExps.reduce((sum, exp) => {
    if (!exp.startDate) return sum
    const start = new Date(exp.startDate)
    const end = exp.endDate && exp.endDate !== '至今' ? new Date(exp.endDate) : new Date()
    return sum + (end - start) / (365.25 * 24 * 60 * 60 * 1000)
  }, 0)
  if (totalYears > 0) {
    const jobMin = job.experienceMin || 0
    const jobMax = job.experienceMax || 99
    let expScore = totalYears >= jobMin && totalYears <= jobMax ? 1.0 : totalYears < jobMin ? Math.max(0, totalYears / jobMin) : Math.max(0, 1 - (totalYears - jobMax) * 0.1)
    score += expScore * 20
    totalWeight += 20
  }
  const userEducation = userProfile.education?.[0]
  const eduLevels = { '高中': 1, '大专': 2, '本科': 3, '硕士': 4, '博士': 5 }
  if (userEducation?.degree && job.education) {
    const userLevel = eduLevels[userEducation.degree] || 0
    const jobLevel = eduLevels[job.education] || 0
    score += userLevel >= jobLevel ? 15 : (userLevel / jobLevel) * 10
    totalWeight += 15
  }
  const target = userProfile.basicInfo?.targetPosition?.toLowerCase() || ''
  if (target) {
    const jobTitle = job.title.toLowerCase()
    score += (jobTitle.includes(target) || target.includes(jobTitle) ? 1.0 : 0) * 10
    totalWeight += 10
  }
  return totalWeight > 0 ? Math.round((score / totalWeight) * 100) : 0
}

/**
 * 获取 Top N 匹配岗位
 */
export function getTopMatches(userProfile, allJobs, limit = 10) {
  return allJobs.map(job => ({ ...job, matchScore: computeMatchScore(userProfile, job) }))
    .sort((a, b) => b.matchScore - a.matchScore).slice(0, limit)
}

/**
 * 随机获取岗位（排除指定 ID）
 */
export function getRandomMatches(allJobs, excludeIds = [], count = 5) {
  return allJobs.filter(j => !excludeIds.includes(j.id || j.title))
    .sort(() => Math.random() - 0.5).slice(0, count)
}

/**
 * 根据分数返回匹配度标签
 */
export function getMatchLabel(score) {
  if (score >= 80) return { text: '完美匹配', color: '#07c160' }
  if (score >= 60) return { text: '高度匹配', color: '#1989fa' }
  if (score >= 40) return { text: '部分匹配', color: '#ff976a' }
  if (score >= 20) return { text: '较低匹配', color: '#ff6b6b' }
  return { text: '暂不匹配', color: '#ccc' }
}

/**
 * 构建 AI 对话的岗位系统提示
 */
export function buildJobsSystemPrompt(jobContext) {
  if (!jobContext || jobContext.length === 0) return ''
  const jobList = jobContext.map((j, i) =>
    String(i + 1) + ". " + j.title + "（" + j.subCategory + "）匹配度 " + j.matchScore + "%\n技能要求：" + (j.requiredSkills || []).join("、") + "\n岗位描述：" + (j.description || "")
  ).join("\n\n")
  return "\n\n【岗位数据库信息】\n以下是为用户推荐的岗位列表：\n" + jobList + "\n\n你可以基于这些信息回答关于求职方向、技能要求、行业发展等问题。"
}



