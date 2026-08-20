/**
 * AI 文档资料提取 — 调用 DeepSeek 从文档文本中提取结构化简历数据
 */
import { chat, hasAiAccess } from './deepseek'

const EXTRACTION_PROMPT = `你是一个专业的简历信息提取助手。请从用户提供的文档文本中，提取所有与简历相关的结构化信息。

请严格按照以下 JSON 格式输出，不要添加任何额外文字：

{
  "basicInfo": {
    "name": "姓名",
    "phone": "电话",
    "email": "邮箱",
    "title": "求职意向/当前职位",
    "summary": "个人简介/自我评价",
    "targetPosition": "目标岗位"
  },
  "workExperiences": [
    {
      "company": "公司名称",
      "position": "职位",
      "startDate": "开始时间",
      "endDate": "结束时间",
      "description": "工作描述",
      "achievements": "主要成就",
      "type": "工作类型，fulltime(全职) / internship(实习) / parttime(兼职)，注意区分实习和全职"
    }
  ],
  "education": [
    {
      "school": "学校名称",
      "major": "专业",
      "degree": "学位",
      "startDate": "开始时间",
      "endDate": "结束时间",
      "gpa": "GPA/成绩"
    }
  ],
  "projects": [
    {
      "name": "项目名称",
      "role": "角色",
      "techStack": "技术栈",
      "description": "项目描述"
    }
  ],
  "skills": [
    {
      "category": "分类（如前端框架、编程语言）",
      "name": "技能名"
    }
  ],
  "certificates": [
    {
      "name": "证书名称",
      "issuer": "颁发机构",
      "date": "获得时间"
    }
  ],
  "knowledgeExtra": "文档中有价值但未归类到上述字段的补充信息，用于知识库存储"
}

注意：
1. 找不到的字段填 null 或空数组，不要编造
2. 姓名、学校、公司等专有名词保留原文
3. 时间格式尽量统一为 YYYY-MM 或 YYYY
4. 技能尽量拆分成独立的条目
5. knowledgeExtra 字段用简洁的中文描述文档中额外的有价值信息
6. 工作经历中的 type 字段很重要，请根据职位名称和描述准确判断是实习还是全职`

export async function extractResumeData(documentText, onProgress) {
  if (!hasAiAccess()) {
    throw new Error('请先在设置中配置 DeepSeek API Key')
  }

  if (!documentText || documentText.trim().length < 20) {
    throw new Error('文档内容过少，无法提取有效信息')
  }

  onProgress?.('正在分析文档内容...')

  const response = await chat([
    { role: 'system', content: EXTRACTION_PROMPT },
    { role: 'user', content: `以下是我的文档内容，请帮我提取简历信息：\n\n${documentText.slice(0, 8000)}` }
  ], {
    maxTokens: 4000,
    temperature: 0.1
  })

  onProgress?.('正在整理提取结果...')

  let jsonStr = response.trim()
  jsonStr = jsonStr.replace(/^```json\s*/gm, '').replace(/^```\s*$/gm, '').trim()
  const jsonMatch = jsonStr.match(/\{[\s\S]*\}/)
  if (jsonMatch) {
    jsonStr = jsonMatch[0]
  }

  try {
    const data = JSON.parse(jsonStr)
    return sanitizeExtractedData(data)
  } catch (e) {
    try {
      jsonStr = jsonStr.replace(/,\s*}/g, '}')
        .replace(/,\s*\]/g, ']')
        .replace(/(\w+):/g, '"$1":')
      return sanitizeExtractedData(JSON.parse(jsonStr))
    } catch {
      throw new Error('AI 返回格式异常，请重试。原始返回：' + response.slice(0, 200))
    }
  }
}

export function hasExtractedData(data) {
  if (!data) return false
  const checks = [
    data.basicInfo?.name,
    data.workExperiences?.length > 0,
    data.education?.length > 0,
    data.projects?.length > 0,
    data.skills?.length > 0
  ]
  return checks.some(Boolean)
}

/** 智能识别工作类型 */
export function guessWorkType(exp) {
  if (['internship', 'fulltime', 'parttime'].includes(exp.type)) return exp.type
  const text = (exp.position + ' ' + (exp.description || '') + ' ' + (exp.company || '')).toLowerCase()
  if (/实习|intern|trainee/i.test(text)) return 'internship'
  if (/兼职|part.?time/i.test(text)) return 'parttime'
  return 'fulltime'
}

/** 清理提取数据，过滤空值并自动识别实习类型 */
export function sanitizeExtractedData(data) {
  if (!data) return data
  const clean = { ...data }

  if (clean.basicInfo) {
    clean.basicInfo = Object.fromEntries(
      Object.entries(clean.basicInfo).filter(([_, v]) => v != null && v !== '')
    )
  }

  if (clean.workExperiences?.length) {
    clean.workExperiences = clean.workExperiences
      .filter(e => e.company || e.position)
      .map(e => ({ ...e, type: guessWorkType(e) }))
  }

  if (clean.education?.length) {
    clean.education = clean.education.filter(e => e.school || e.major)
  }

  if (clean.projects?.length) {
    clean.projects = clean.projects.filter(p => p.name)
  }

  if (clean.skills?.length) {
    clean.skills = clean.skills.filter(s => s.name)
  }

  if (clean.certificates?.length) {
    clean.certificates = clean.certificates.filter(c => c.name)
  }

  return clean
}
