import { metrics } from '@/utils/metrics'
import { logAction } from '@/utils/actionLog'
import { getDeviceId } from '@/utils/tracker'

const API_BASE = 'https://api.deepseek.com/v1'
const MAX_RETRIES = 3
const RETRY_DELAY = 1000

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function fetchWithRetry(url, options, retries = MAX_RETRIES) {
  let retriesUsed = 0
  for (let i = 0; i < retries; i++) {
    try {
      const response = await fetch(url, options)
      if (!response.ok) {
        const error = await response.json().catch(() => ({}))
        throw new Error(error.error?.message || 'HTTP ' + response.status)
      }
      const data = await response.json()
      return { data, retriesUsed }
    } catch (err) {
      retriesUsed = i + 1
      if (i === retries - 1) {
        err.retriesUsed = retriesUsed
        throw err
      }
      await delay(RETRY_DELAY * (i + 1))
    }
  }
}

export function getApiKey() {
  return localStorage.getItem('deepseek_api_key') || ''
}

export function isServerAiEnabled() {
  // 生产环境（部署到 Cloudflare/EdgeOne）使用服务器端密钥代理；本地开发回退到浏览器本地 Key
  return !import.meta.env.DEV && typeof window !== 'undefined'
}

export function hasAiAccess() {
  return !!(getApiKey() || isServerAiEnabled())
}

class ProxyNotAvailable extends Error {}

function aiProxyUrl() {
  return window.location.origin + '/api/ai/chat'
}

async function parseSseResponse(response, onStream) {
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
      } catch {
        // skip parse errors
      }
    }
  }
  return fullContent
}

async function chatViaServerProxy(messages, { maxTokens, temperature, onStream, feature }) {
  let response
  try {
    response = await fetch(aiProxyUrl(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages,
        maxTokens,
        temperature,
        stream: !!onStream,
        deviceId: getDeviceId(),
        feature
      })
    })
  } catch (err) {
    // 服务器代理不可达（例如本地开发时没有该接口），回退本地 Key
    throw new ProxyNotAvailable(err && err.message)
  }
  if (response.status === 404 || response.status === 405 || response.status === 501) {
    throw new ProxyNotAvailable('proxy not deployed')
  }
  if (!response.ok) {
    const err = await response.json().catch(() => ({}))
    throw new Error(err.error || '服务器 AI 接口错误（HTTP ' + response.status + '）')
  }
  if (onStream) {
    return parseSseResponse(response, onStream)
  }
  const data = await response.json()
  if (!data.content) throw new Error('服务器 AI 返回内容为空')
  return data.content
}

export async function chat(messages, options = {}) {
  const { maxTokens = 2000, temperature = 0.7, onStream } = options
  const startTime = performance.now()

  // 生产环境优先走服务器端代理（key 在服务器，浏览器无需配置）
  if (isServerAiEnabled()) {
    try {
      const content = await chatViaServerProxy(messages, { maxTokens, temperature, onStream, feature: options.feature })
      const duration = performance.now() - startTime
      logAction('api.chat', { status: 'success', durationMs: duration, payload: { via: 'server-proxy', model: 'deepseek-chat', maxTokens, messageCount: messages.length } })
      metrics.recordApiCall({ duration, success: true, retries: 0 })
      return content
    } catch (err) {
      const duration = performance.now() - startTime
      if (err instanceof ProxyNotAvailable) {
        // 服务器代理未部署，回退到本地 Key
      } else {
        logAction('api.chat', { status: 'failed', durationMs: duration, payload: { via: 'server-proxy', messageCount: messages.length }, error: err })
        metrics.recordApiCall({ duration, success: false, retries: 0 })
        throw err
      }
    }
  }

  const apiKey = getApiKey()
  if (!apiKey) throw new Error('请先设置 DeepSeek API Key')

  if (onStream) {
    return streamChat(messages, apiKey, { maxTokens, temperature, onStream })
  }

  try {
    const result = await fetchWithRetry(API_BASE + '/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + apiKey
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages,
        max_tokens: maxTokens,
        temperature
      })
    })
    const duration = performance.now() - startTime
    logAction('api.chat', { status: 'success', durationMs: duration, payload: { via: 'direct', messageCount: messages.length, retries: result.retriesUsed } })
    metrics.recordApiCall({ duration, success: true, retries: result.retriesUsed })
    return result.data.choices[0].message.content
  } catch (err) {
    const duration = performance.now() - startTime
    logAction('api.chat', { status: 'failed', durationMs: duration, payload: { via: 'direct', messageCount: messages.length, retries: err.retriesUsed || 0 }, error: err })
    metrics.recordApiCall({ duration, success: false, retries: err.retriesUsed || 0 })
    throw err
  }
}

export async function streamChat(messages, apiKey, { maxTokens, temperature, onStream }) {
  const startTime = performance.now()
  logAction('api.stream', { status: 'started', payload: { model: 'deepseek-chat', maxTokens, messageCount: messages.length } })

  try {
    const response = await fetch(API_BASE + '/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + apiKey
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
      throw new Error(error.error?.message || 'HTTP ' + response.status)
    }

    const fullContent = await parseSseResponse(response, onStream)

    const duration = performance.now() - startTime
    logAction('api.stream', { status: 'success', durationMs: duration, payload: { messageCount: messages.length, firstTokenMs: null } })
    metrics.recordApiCall({ duration, firstToken: null, success: true })
    return fullContent
  } catch (err) {
    const duration = performance.now() - startTime
    logAction('api.stream', { status: 'failed', durationMs: duration, payload: { messageCount: messages.length }, error: err })
    metrics.recordApiCall({ duration, success: false })
    throw err
  }
}

export function buildChatSystemPrompt(context) {
  return '你是一个专业的简历生成和求职助手。你拥有一份求职者的个人资料数据。\n\n'
    + '你需要根据用户的需求，基于这些数据提供帮助。你的任务包括：\n\n'
    + '1. 简历生成：根据用户的目标岗位和公司，从资料中筛选最相关的工作经历、项目经验、技能等，生成一份专业的简历。使用简洁、正式的商业语言，突出成就和量化结果。\n\n'
    + '2. 问题回答：回答用户关于个人资料的问题，如"我有哪些项目经验？"等。\n\n'
    + '3. 求职建议：结合用户背景，给出求职策略和建议。当需要联网信息时，请在回答中说明"建议搜索"相关内容。\n\n'
    + '4. 岗位分析：当用户提供JD时，逐项分析匹配度，给出优劣势评估和改进建议。\n\n'
    + '当前的个人资料：\n' + JSON.stringify(context, null, 2) + '\n\n'
    + '请注意：\n'
    + '- 简历生成时，只使用提供的资料中的真实信息，不要编造\n'
    + '- 回答要简洁、专业、有针对性'
}

export function buildHrSystemPrompt(context) {
  const name = (context && context.basicInfo && context.basicInfo.name) || '这位求职者'
  return '你是' + name + '的专属AI求职助手，代表候选人本人与招聘方（HR）交流。现在向你提问的是正在评估是否录用' + name + '的HR。\n\n'
    + '以下是' + name + '的个人资料：\n' + JSON.stringify(context, null, 2) + '\n\n'
    + '你的定位：\n'
    + '- 你以"' + name + '的AI助手"身份回答，用第一人称（"我/我们"）介绍，不要用"这位求职者/候选人"这类第三人称称呼对方\n'
    + '- 你清楚自己面对的是HR：态度专业、诚恳、有亲和力，目标是用具体事例让HR更了解' + name + '的能力与潜力\n\n'
    + '回答要求：\n'
    + '1. 围绕' + name + '的项目细节、工作经历、技能、教育背景等回答问题，结合资料中的具体事例，突出亮点和成果\n'
    + '2. 只基于提供的资料回答，绝不编造；只能引用资料中明确出现的公司、项目、经历和数字，不要补充资料之外的具体细节；资料中没有的，礼貌说明"这部分暂时没有详细记录，我可以帮您联系' + name + '进一步确认"\n'
    + '3. 每次回答控制在300字以内，重点突出、分点清晰\n'
    + '4. 如果HR问与' + name + '无关的问题，礼貌说明你只负责解答与' + name + '相关的问题\n'
    + '5. 涉及薪资等敏感问题，如实说明资料中未公开，建议直接与' + name + '沟通'
}

function formatProfileForPrompt(data) {
  const b = data.basicInfo || {}
  let text = '===== 个人信息 =====\n'
  text += '姓名：' + (b.name || '未填写') + '\n'
  text += '电话：' + (b.phone || '') + '\n'
  text += '邮箱：' + (b.email || '') + '\n'
  text += '目标岗位：' + (b.targetPosition || '未填写') + '\n'
  text += '个人简介：' + (b.summary || '无') + '\n\n'

  if (data.workExperiences && data.workExperiences.length > 0) {
    text += '===== 工作经历 =====\n'
    for (const exp of data.workExperiences) {
      text += '公司：' + (exp.company || '未知') + ' | 职位：' + (exp.position || '') + ' | ' + (exp.startDate || '') + ' ~ ' + (exp.endDate || '至今') + '\n'
      text += '  工作描述：' + (exp.description || '无') + '\n'
      text += '  主要成就：' + (exp.achievements || '未填写') + '\n\n'
    }
  }

  if (data.projects && data.projects.length > 0) {
    text += '===== 项目经验 =====\n'
    for (const proj of data.projects) {
      text += '项目：' + (proj.name || '') + ' | 角色：' + (proj.role || '') + ' | 技术栈：' + (proj.techStack || '') + '\n'
      text += '  描述：' + (proj.description || '无') + '\n\n'
    }
  }

  if (data.education && data.education.length > 0) {
    text += '===== 教育背景 =====\n'
    for (const edu of data.education) {
      text += edu.school + ' | ' + (edu.major || '') + ' | ' + (edu.degree || '') + ' | ' + (edu.startDate || '') + ' ~ ' + (edu.endDate || '') + '\n'
    }
    text += '\n'
  }

  if (data.skills && data.skills.length > 0) {
    const grouped = {}
    for (const s of data.skills) {
      const cat = s.category || '其他'
      if (!grouped[cat]) grouped[cat] = []
      grouped[cat].push(s.name)
    }
    text += '===== 技能清单 =====\n'
    for (const [cat, names] of Object.entries(grouped)) {
      text += cat + '：' + names.join('、') + '\n'
    }
    text += '\n'
  }

  if (data.certificates && data.certificates.length > 0) {
    text += '===== 证书/其他 =====\n'
    for (const c of data.certificates) {
      text += (c.name || '') + '（' + (c.issuer || '') + '）' + (c.date ? ' - ' + c.date : '') + '\n'
    }
  }
  return text
}

function buildResumeSystemPrompt(profileText, jobDescription, templateText) {
  let prompt = '你是一名顶尖的简历优化专家。你的任务是把用户的原始经历数据改写成一份有说服力、量化突出、ATS友好的简历。\n\n'
  prompt += '## 核心写作原则\n'
  prompt += '1. STAR法则：每段经历尽量按「背景/任务 -> 行动 -> 量化结果」组织\n'
  prompt += '2. 量化优先：尽可能用数字说明效果，如「性能提升60%」「覆盖10万用户」「减少30%耗时」\n'
  prompt += '3. 动词开头：每条经历用有力的动词开头（主导/设计/搭建/优化/重构/推动/落地）\n'
  prompt += '4. 相关性过滤：只选用和目标岗位最相关的经历，不相关的简写或省略\n'
  prompt += '5. 诚实原则：只使用提供的资料，不要编造经历或数据\n\n'

  if (jobDescription) {
    prompt += '## JD 对齐要求（三步处理）\n'
    prompt += '第一步：从JD中提取关键词（技术栈、业务领域、软技能）\n'
    prompt += '第二步：在用户经历中找到能匹配这些关键词的经历，重点展开\n'
    prompt += '第三步：对难以匹配的经历可以简写\n\n'
    prompt += '【岗位描述】\n' + jobDescription + '\n\n'
  }

  prompt += '## 写得好 vs 写得差的对比示例\n'
  prompt += '❌ 差：「负责前端开发工作，参与多个项目」\n'
  prompt += '✅ 好：「主导公司核心产品的前端架构升级，从Vue2迁移至Vue3，打包体积缩小40%，首屏加载从3s优化至0.8s」\n\n'
  prompt += '❌ 差：「参与数据库优化工作」\n'
  prompt += '✅ 好：「重构3个核心SQL查询，引入索引优化策略，接口响应时间从2s降至200ms，QPS提升5倍」\n\n'
  prompt += '❌ 差：「负责团队管理」\n'
  prompt += '✅ 好：「带领8人前端团队，建立Code Review机制和自动化CI/CD流水线，发布效率提升60%，线上Bug减少70%」\n\n'
  prompt += '## 用户资料\n'
  prompt += profileText

  if (templateText) {
    prompt += '\n\n## 模板结构（请严格遵守）\n'
    prompt += '下面是你需要参照的简历模板的文本结构。请按以下要求填写：\n'
    prompt += '1. 严格遵守模板的章节顺序和标题命名，不要增减章节\n'
    prompt += '2. 模板中的占位符如 [姓名]、[电话]、[邮箱] 等，请用用户的实际信息替换\n'
    prompt += '3. 模板中的图片区域（如 [照片]）标注，请保留不删\n'
    prompt += '4. 如果你不确定某个占位符该填什么，保留原占位符不要改动\n'
    prompt += '5. 输出时请包含模板中出现的所有文字和占位符，只把能确定的用用户数据替换\n\n'
    prompt += '### 模板原文：\n' + templateText + '\n'
  }

  return prompt
}

function buildAnalyzeSystemPrompt(context) {
  const text = formatProfileForPrompt(context)
  return '你是一名专业的招聘匹配分析师。请根据求职者的个人资料和目标岗位描述，进行逐项匹配分析。\n\n'
    + '分析要求：\n'
    + '1. 逐条对比JD要求与用户能力\n'
    + '2. 给出准确的匹配度百分比\n'
    + '3. 明确指出优势和改进方向\n'
    + '4. 给出具体可执行的行动建议\n\n'
    + '## 求职者资料\n' + text
}

export async function generateResume(profileData, targetCompany, targetPosition, jobDescription, templateText) {
  const profileText = formatProfileForPrompt(profileData)
  const systemPrompt = buildResumeSystemPrompt(profileText, jobDescription, templateText)

  let userPrompt = '请基于上面的资料，为「' + (targetCompany || '') + '」的「' + (targetPosition || '') + '」岗位生成一份针对性简历。\n\n'
  userPrompt += '输出格式要求：\n\n'
  userPrompt += '【个人简介】\n2-3句话突出核心竞争力，包含年限、技术栈、行业背景\n\n'
  userPrompt += '【工作经历】\n每段包含：公司、职位、时间\n每条经历按STAR法则展开，2-4条子弹点，每点用动词开头且尽量量化\n\n'
  userPrompt += '【项目经验】\n每个项目包含：项目名、角色、技术栈\n重点写你在项目中的具体贡献和效果\n\n'
  userPrompt += '【教育背景】\n学校、专业、学位、时间\n\n'
  userPrompt += '【技能】\n按类别分组列出相关技能\n\n'
  userPrompt += '【其他】\n证书、语言等\n\n'
  userPrompt += '要求：\n'
  userPrompt += '- 整份简历控制在1页A4以内\n'
  userPrompt += '- 使用专业、正式的中文\n'
  userPrompt += '- 和岗位无关的经历可以省略\n'
  userPrompt += '- 不要编造任何信息'

  return await chat([
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt }
  ], { maxTokens: 5000, temperature: 0.7 })
}

export async function analyzeJob(profileData, jobDescription) {
  const systemPrompt = buildAnalyzeSystemPrompt(profileData)
  const userPrompt = '请分析以下JD与求职者的匹配度。\n\nJD内容：\n' + jobDescription + '\n\n请输出：\n1. 匹配项（列出满足的JD要求）\n2. 不匹配项（列出不满足的JD要求）\n3. 匹配度评分（百分比）\n4. 优势分析\n5. 改进建议\n6. 行动清单（按优先级排序的学习路径）'

  return await chat([
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt }
  ], { maxTokens: 4000, temperature: 0.3 })
}

export async function hrQuestion(context, question) {
  const prompt = 'HR提问：' + question
  return await chat([
    { role: 'system', content: buildHrSystemPrompt(context) },
    { role: 'user', content: prompt }
  ], { maxTokens: 500, temperature: 0.3 })
}


export async function extractJobInfo(jd) {
  const systemPrompt = 'You are a job posting information extractor. Extract company, position, salary range and city from the Chinese JD. Reply with strict JSON only: {"company":"","position":"","salary":"","city":""}. Use empty strings for missing fields.'
  const response = await chat([
    { role: 'system', content: systemPrompt },
    { role: 'user', content: jd }
  ], { maxTokens: 300, temperature: 0.1 })
  const match = response.match(/\{[\s\S]*?\}/)
  if (!match) throw new Error('AI response format error')
  let data
  try {
    data = JSON.parse(match[0])
  } catch {
    throw new Error('AI response is not valid JSON')
  }
  return {
    company: data.company || '',
    position: data.position || '',
    salary: data.salary || '',
    city: data.city || ''
  }
}
