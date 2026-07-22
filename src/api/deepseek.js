const API_BASE = 'https://api.deepseek.com/v1'
const MAX_RETRIES = 3
const RETRY_DELAY = 1000

async function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function fetchWithRetry(url, options, retries = MAX_RETRIES) {
  for (let i = 0; i < retries; i++) {
    try {
      const response = await fetch(url, options)
      if (!response.ok) {
        const error = await response.json().catch(() => ({}))
        throw new Error(error.error?.message || `HTTP ${response.status}`)
      }
      return await response.json()
    } catch (err) {
      if (i === retries - 1) throw err
      await delay(RETRY_DELAY * (i + 1))
    }
  }
}

export function getApiKey() {
  return localStorage.getItem('deepseek_api_key') || ''
}

export async function chat(messages, options = {}) {
  const apiKey = getApiKey()
  if (!apiKey) throw new Error('请先设置 DeepSeek API Key')

  const {
    maxTokens = 2000,
    temperature = 0.7,
    onStream
  } = options

  if (onStream) {
    return streamChat(messages, apiKey, { maxTokens, temperature, onStream })
  }

  const data = await fetchWithRetry(`${API_BASE}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: 'deepseek-chat',
      messages,
      max_tokens: maxTokens,
      temperature
    })
  })

  return data.choices[0].message.content
}

export async function streamChat(messages, apiKey, { maxTokens, temperature, onStream }) {
  const response = await fetch(`${API_BASE}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: 'deepseek-chat',
      messages,
      max_tokens: maxTokens,
      temperature,
      stream: true
    })
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({}))
    throw new Error(error.error?.message || `HTTP ${response.status}`)
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let fullContent = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    const chunk = decoder.decode(value, { stream: true })
    const lines = chunk.split('\n').filter(l => l.startsWith('data: '))

    for (const line of lines) {
      const data = line.slice(6).trim()
      if (data === '[DONE]') continue
      try {
        const parsed = JSON.parse(data)
        const content = parsed.choices?.[0]?.delta?.content || ''
        fullContent += content
        onStream(fullContent)
      } catch { /* skip parse errors */ }
    }
  }

  return fullContent
}

export function buildChatSystemPrompt(context) {
  return `你是一个专业的简历生成和求职助手。你拥有一份求职者的个人资料数据。

你需要根据用户的需求，基于这些数据提供帮助。你的任务包括：

1. 简历生成：根据用户的目标岗位和公司，从资料中筛选最相关的工作经历、项目经验、技能等，生成一份专业的简历。使用简洁、正式的商业语言，突出成就和量化结果。

2. 问题回答：回答用户关于个人资料的问题，如"我有哪些项目经验？"等。

3. 求职建议：结合用户背景，给出求职策略和建议。当需要联网信息时，请在回答中说明"建议搜索"相关内容。

4. 岗位分析：当用户提供JD时，逐项分析匹配度，给出优劣势评估和改进建议。

当前的个人资料：
${JSON.stringify(context, null, 2)}

请注意：
- 简历生成时，只使用提供的资料中的真实信息，不要编造
- 回答要简洁、专业、有针对性`
}

export function buildHrSystemPrompt(context) {
  return `你是一个求职者的个人AI助手。有人在招聘过程中对你感兴趣，想了解关于这位求职者的更多信息。

以下是该求职者的个人资料：
${JSON.stringify(context, null, 2)}

你的任务：
1. 回答HR关于这位求职者的项目细节、工作经历、技能等方面的问题
2. 只基于提供的资料回答，不要编造任何信息
3. 如果问题超出资料范围，诚实地回答"资料中没有相关记录"
4. 每次回答限制在500字以内
5. 用专业、诚恳的语气
6. 回答要简洁、突出重点`
}


/**
 * 把个人资料转成 AI 容易理解的自然语言段落（比原始 JSON 好读多了）
 */
function formatProfileForPrompt(data) {
  const b = data.basicInfo || {};
  let text = "===== 个人信息 =====\n";
  text += "姓名：" + (b.name || "未填写") + "\n";
  text += "电话：" + (b.phone || "") + "\n";
  text += "邮箱：" + (b.email || "") + "\n";
  text += "目标岗位：" + (b.targetPosition || "未填写") + "\n";
  text += "个人简介：" + (b.summary || "无") + "\n\n";

  if (data.workExperiences && data.workExperiences.length > 0) {
    text += "===== 工作经历 =====\n";
    for (const exp of data.workExperiences) {
      text += "公司：" + (exp.company || "未知") + " | 职位：" + (exp.position || "") + " | " + (exp.startDate || "") + " ~ " + (exp.endDate || "至今") + "\n";
      text += "  工作描述：" + (exp.description || "无") + "\n";
      text += "  主要成就：" + (exp.achievements || "未填写") + "\n\n";
    }
  }

  if (data.projects && data.projects.length > 0) {
    text += "===== 项目经验 =====\n";
    for (const proj of data.projects) {
      text += "项目：" + (proj.name || "") + " | 角色：" + (proj.role || "") + " | 技术栈：" + (proj.techStack || "") + "\n";
      text += "  描述：" + (proj.description || "无") + "\n\n";
    }
  }

  if (data.education && data.education.length > 0) {
    text += "===== 教育背景 =====\n";
    for (const edu of data.education) {
      text += edu.school + " | " + (edu.major || "") + " | " + (edu.degree || "") + " | " + (edu.startDate || "") + " ~ " + (edu.endDate || "") + "\n";
    }
    text += "\n";
  }

  if (data.skills && data.skills.length > 0) {
    const grouped = {};
    for (const s of data.skills) {
      const cat = s.category || "其他";
      if (!grouped[cat]) grouped[cat] = [];
      grouped[cat].push(s.name);
    }
    text += "===== 技能清单 =====\n";
    for (const [cat, names] of Object.entries(grouped)) {
      text += cat + "：" + names.join("、") + "\n";
    }
    text += "\n";
  }

  if (data.certificates && data.certificates.length > 0) {
    text += "===== 证书/其他 =====\n";
    for (const c of data.certificates) {
      text += (c.name || "") + "（" + (c.issuer || "") + "）" + (c.date ? " - " + c.date : "") + "\n";
    }
  }
  return text;
}

/**
 * 简历生成专用 System Prompt（专注、带 STAR 法则、带示例）
 */
function buildResumeSystemPrompt(profileText, jobDescription, templateText) {
  let prompt = "你是一名顶尖的简历优化专家。你的任务是把用户的原始经历数据改写成一份有说服力、量化突出、ATS友好的简历。\n\n";
  prompt += "## 核心写作原则\n";
  prompt += "1. STAR法则：每段经历尽量按「背景/任务 -> 行动 -> 量化结果」组织\n";
  prompt += "2. 量化优先：尽可能用数字说明效果，如「性能提升60%」「覆盖10万用户」「减少30%耗时」\n";
  prompt += "3. 动词开头：每条经历用有力的动词开头（主导/设计/搭建/优化/重构/推动/落地）\n";
  prompt += "4. 相关性过滤：只选用和目标岗位最相关的经历，不相关的简写或省略\n";
  prompt += "5. 诚实原则：只使用提供的资料，不要编造经历或数据\n\n";

  if (jobDescription) {
    prompt += "## JD 对齐要求（三步处理）\n";
    prompt += "第一步：从JD中提取关键词（技术栈、业务领域、软技能）\n";
    prompt += "第二步：在用户经历中找到能匹配这些关键词的经历，重点展开\n";
    prompt += "第三步：对难以匹配的经历可以简写\n\n";
    prompt += "【岗位描述】\n" + jobDescription + "\n\n";
  }

  prompt += "## 写得好 vs 写得差的对比示例\n";
  prompt += "❌ 差：「负责前端开发工作，参与多个项目」\n";
  prompt += "✅ 好：「主导公司核心产品的前端架构升级，从Vue2迁移至Vue3，打包体积缩小40%，首屏加载从3s优化至0.8s」\n\n";
  prompt += "❌ 差：「参与数据库优化工作」\n";
  prompt += "✅ 好：「重构3个核心SQL查询，引入索引优化策略，接口响应时间从2s降至200ms，QPS提升5倍」\n\n";
  prompt += "❌ 差：「负责团队管理」\n";
  prompt += "✅ 好：「带领8人前端团队，建立Code Review机制和自动化CI/CD流水线，发布效率提升60%，线上Bug减少70%」\n\n";
  prompt += "## 用户资料\n";
  prompt += profileText;

  if (templateText) {
    prompt += "\n\n## 模板结构（请严格遵守）\n";
    prompt += "下面是你需要参照的简历模板的文本结构。请按以下要求填写：\n";
    prompt += "1. 严格遵守模板的章节顺序和标题命名，不要增减章节\n";
    prompt += "2. 模板中的占位符如 [姓名]、[电话]、[邮箱] 等，请用用户的实际信息替换\n";
    prompt += "3. 模板中的图片区域（如 [照片]）标注，请保留不删\n";
    prompt += "4. 如果你不确定某个占位符该填什么，保留原占位符不要改动\n";
    prompt += "5. 输出时请包含模板中出现的所有文字和占位符，只把能确定的用用户数据替换\n\n";
    prompt += "### 模板原文：\n" + templateText + "\n";
  }

  return prompt;
}

/**
 * 岗位分析专用 System Prompt
 */
function buildAnalyzeSystemPrompt(context) {
  const text = formatProfileForPrompt(context);
  return "你是一名专业的招聘匹配分析师。请根据求职者的个人资料和目标岗位描述，进行逐项匹配分析。\n\n"
    + "分析要求：\n"
    + "1. 逐条对比JD要求与用户能力\n"
    + "2. 给出准确的匹配度百分比\n"
    + "3. 明确指出优势和改进方向\n"
    + "4. 给出具体可执行的行动建议\n\n"
    + "## 求职者资料\n" + text;
}

export async function generateResume(profileData, targetCompany, targetPosition, jobDescription, templateText) {
  const profileText = formatProfileForPrompt(profileData);
  const systemPrompt = buildResumeSystemPrompt(profileText, jobDescription, templateText);

  let userPrompt = "请基于上面的资料，为「" + (targetCompany || "") + "」的「" + targetPosition + "」岗位生成一份针对性简历。\n\n";
  userPrompt += "输出格式要求：\n\n";
  userPrompt += "【个人简介】\n2-3句话突出核心竞争力，包含年限、技术栈、行业背景\n\n";
  userPrompt += "【工作经历】\n每段包含：公司、职位、时间\n每条经历按STAR法则展开，2-4条子弹点，每点用动词开头且尽量量化\n\n";
  userPrompt += "【项目经验】\n每个项目包含：项目名、角色、技术栈\n重点写你在项目中的具体贡献和效果\n\n";
  userPrompt += "【教育背景】\n学校、专业、学位、时间\n\n";
  userPrompt += "【技能】\n按类别分组列出相关技能\n\n";
  userPrompt += "【其他】\n证书、语言等\n\n";
  userPrompt += "要求：\n";
  userPrompt += "- 整份简历控制在1页A4以内\n";
  userPrompt += "- 使用专业、正式的中文\n";
  userPrompt += "- 和岗位无关的经历可以省略\n";
  userPrompt += "- 不要编造任何信息";

  return await chat([
    { role: "system", content: systemPrompt },
    { role: "user", content: userPrompt }
  ], { maxTokens: 5000, temperature: 0.7 });
}

export async function analyzeJob(profileData, jobDescription) {
  const systemPrompt = buildAnalyzeSystemPrompt(profileData);
  const userPrompt = "请分析以下JD与求职者的匹配度。\n\nJD内容：\n" + jobDescription + "\n\n请输出：\n1. 匹配项（列出满足的JD要求）\n2. 不匹配项（列出不满足的JD要求）\n3. 匹配度评分（百分比）\n4. 优势分析\n5. 改进建议\n6. 行动清单（按优先级排序的学习路径）";

  return await chat([
    { role: "system", content: systemPrompt },
    { role: "user", content: userPrompt }
  ], { maxTokens: 4000, temperature: 0.3 });
}

export async function hrQuestion(context, question) {
  const prompt = `HR提问：${question}`

  return await chat([
    { role: 'system', content: buildHrSystemPrompt(context) },
    { role: 'user', content: prompt }
  ], { maxTokens: 500, temperature: 0.3 })
}
