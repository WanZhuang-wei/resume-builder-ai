import { chat } from '@/api/deepseek'

const MAX_AI_CLUSTERS = 5
const AI_TIMEOUT = 30000

/**
 * 构建 AI 合并提示词 —— 根据文档内容判断是工作经历还是项目，返回对应 JSON
 */
function buildMergePrompt(documents) {
  const docsText = documents.map((doc, i) =>
    `【文档 ${i + 1}】${doc.title || '未命名'}\n${doc.originalText || doc.aiSummary || ''}`
  ).join('\n\n---\n\n')

  const systemPrompt =
    '你是一位简历数据整理助手。以下是用户上传的关于同一段经历的多份文档内容，请判断这段经历是「工作经历」还是「项目经历」，并按要求输出 JSON。\n\n' +
    '规则：\n' +
    '1. 只使用文档中提供的信息，不要编造\n' +
    '2. 合并重复或重叠的描述，保留最详细的内容\n' +
    '3. 如果判断为工作经历：输出类型为 "work"，JSON 字段为 { type, company, position, startDate, endDate, description, achievements, tags }\n' +
    '4. 如果判断为项目经历：输出类型为 "project"，JSON 字段为 { type, name, role, techStack, description, link }\n' +
    '5. description 和 achievements 要完整合并不同文档中的内容\n' +
    '6. 如果某个字段在文档中都没有则设为空字符串\n' +
    '7. 只输出 JSON，不要有其他文字\n' +
    '8. tags 是字符串数组'

  return [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: '请合并以下多份文档内容，判断是工作经历还是项目经历，输出 JSON：\n\n' + docsText }
  ]
}

/**
 * 从 AI 响应中提取 JSON 对象
 */
function parseAIResponse(response) {
  const jsonMatch = response.match(/\{[\s\S]*?\}/)
  if (!jsonMatch) return null
  try {
    return JSON.parse(jsonMatch[0])
  } catch {
    return null
  }
}

/**
 * 对聚类后的知识库文档，逐一调用 AI 合并，返回可写入 profile 的结构化数据
 */
export async function consolidateWithAI(clusters, profileStore, opts) {
  const options = opts || {}
  const onProgress = options.onProgress
  const signal = options.signal
  const summary = []

  const mergedWorkExperiences = []
  const mergedProjects = []
  const toMerge = clusters.slice(0, MAX_AI_CLUSTERS)
  const remaining = clusters.slice(MAX_AI_CLUSTERS)

  for (let idx = 0; idx < toMerge.length; idx++) {
    if (signal && signal.aborted) throw new Error('操作已取消')
    const cluster = toMerge[idx]
    if (cluster.length < 2) continue

    if (onProgress) onProgress({ current: idx + 1, total: toMerge.length, cluster: cluster })

    const messages = buildMergePrompt(cluster)
    try {
      const response = await Promise.race([
        chat(messages, { maxTokens: 1024, temperature: 0.3 }),
        new Promise((_, reject) => {
          setTimeout(() => reject(new Error('AI 响应超时')), AI_TIMEOUT)
        })
      ])

      const parsed = parseAIResponse(response)
      if (!parsed) {
        summary.push(`「${cluster[0].title || '未命名'}」- AI 返回格式异常，已跳过`)
        continue
      }

      if (parsed.type === 'project' && parsed.name) {
        mergedProjects.push({
          name: parsed.name || '',
          role: parsed.role || '',
          techStack: parsed.techStack || '',
          description: parsed.description || '',
          link: parsed.link || ''
        })
        summary.push(`「${cluster[0].title || '未命名'}」- 已合并 ${cluster.length} 份文档为项目「${parsed.name}」`)
      } else if (parsed.company || parsed.position) {
        mergedWorkExperiences.push({
          company: parsed.company || '',
          position: parsed.position || '',
          startDate: parsed.startDate || '',
          endDate: parsed.endDate || '',
          description: parsed.description || '',
          achievements: parsed.achievements || '',
          tags: Array.isArray(parsed.tags) ? parsed.tags : [],
          type: parsed.type || 'fulltime'
        })
        summary.push(`「${cluster[0].title || '未命名'}」- 已合并 ${cluster.length} 份文档为工作经历「${parsed.position || parsed.company}」`)
      }
    } catch (e) {
      summary.push(`「${cluster[0].title || '未命名'}」- AI 合并失败: ${e.message}`)
    }
  }

  if (remaining.length > 0) {
    summary.push(`还有 ${remaining.length} 组因数量限制未处理`)
  }

  return {
    summary,
    hasChanges: mergedWorkExperiences.length > 0 || mergedProjects.length > 0,
    workExperiences: mergedWorkExperiences,
    projects: mergedProjects
  }
}


// ===== ???? v2????? + ????????????? AI ???? =====

const KIND_LABEL = {
  workExperiences: '工作经历',
  projects: '项目',
  skills: '技能',
  certificates: '证书',
  education: '教育背景'
}

function entryKey(entry, kind) {
  let value = ''
  if (kind === 'workExperiences') value = entry.company || ''
  else if (kind === 'projects') value = entry.name || ''
  else if (kind === 'skills') value = entry.name || ''
  else if (kind === 'education') value = (entry.school || '') + '|' + (entry.degree || '')
  else value = entry.name || ''
  return value.toString().trim().toLowerCase().replace(/\s+/g, '')
}

function keysSimilar(a, b) {
  if (!a || !b) return false
  if (a === b) return true
  if (a.includes(b) || b.includes(a)) return true
  return false
}

export function groupProfileEntries(entries, kind) {
  const groups = []
  const used = new Set()
  const keys = entries.map(function (entry) { return entryKey(entry, kind) })

  for (let i = 0; i < entries.length; i++) {
    if (used.has(i)) continue
    const group = [entries[i]]
    used.add(i)
    for (let j = i + 1; j < entries.length; j++) {
      if (used.has(j)) continue
      if (keysSimilar(keys[i], keys[j])) {
        group.push(entries[j])
        used.add(j)
      }
    }
    groups.push(group)
  }
  return groups
}

function displayName(entry, kind) {
  if (kind === 'workExperiences') return entry.company || entry.position || ''
  if (kind === 'education') return entry.school || ''
  return entry.name || ''
}

function fallbackMergeEntries(group, kind) {
  const base = group.reduce(function (a, b) {
    return JSON.stringify(a).length >= JSON.stringify(b).length ? a : b
  }, group[0])
  const merged = { ...base }
  const textFields = kind === 'workExperiences'
    ? ['description', 'achievements']
    : kind === 'projects' ? ['description'] : []
  for (const field of textFields) {
    const parts = []
    for (const item of group) {
      if (item[field] && !parts.includes(item[field])) parts.push(item[field])
    }
    if (parts.length > 0) merged[field] = parts.join('\n')
  }
  return merged
}

function buildEntryMergePrompt(group, kind) {
  const label = KIND_LABEL[kind] || kind
  const systemPrompt = 'You are a resume data consolidation assistant. The user has multiple entries that may describe the same ' + label + '.\n' +
    'Decide whether they are the same item. If yes, merge them into ONE complete entry and reply with JSON only: {"merged":true,"entry":{...}}.\n' +
    'If they are clearly different items, reply: {"merged":false}.\n' +
    'Keep the most complete values, merge descriptions and achievements without inventing facts, and keep all real fields of the entry type.'
  const userPrompt = 'Entries (JSON array):\n' + JSON.stringify(group, null, 2)
  return [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt }
  ]
}

function parseMergeResponse(response) {
  const match = String(response || '').match(/\{[\s\S]*?\}/)
  if (!match) return null
  try {
    return JSON.parse(match[0])
  } catch {
    return null
  }
}

export function sanitizeMergedEntry(value) {
  if (Array.isArray(value)) {
    for (const item of value) {
      if (item && typeof item === 'object' && !Array.isArray(item)) {
        return sanitizeMergedEntry(item)
      }
    }
    return null
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  try {
    const cloned = JSON.parse(JSON.stringify(value))
    if (!cloned || typeof cloned !== 'object' || Array.isArray(cloned)) return null
    delete cloned._source
    return cloned
  } catch {
    return null
  }
}

async function mergeEntriesWithAI(group, kind) {
  const messages = buildEntryMergePrompt(group, kind)
  const response = await chat(messages, { maxTokens: 1024, temperature: 0.2 })
  const parsed = parseMergeResponse(response)
  if (!parsed) throw new Error('AI response format error')
  return parsed
}

export async function mergeEntryGroups(groups, kind, opts = {}) {
  const maxGroups = opts.maxGroups || 8
  const onProgress = opts.onProgress
  const forceMerge = opts.forceMerge !== false
  const mergeable = groups.filter(function (g) { return g.length > 1 }).slice(0, maxGroups)
  const single = groups.filter(function (g) { return g.length <= 1 })
  const summary = []
  let mergedCount = 0

  for (let i = 0; i < mergeable.length; i++) {
    const group = mergeable[i]
    if (onProgress) onProgress({ current: i + 1, total: mergeable.length, group })
    const name = displayName(group[0], kind)
    const label = KIND_LABEL[kind] || kind
    let mergedEntry = null
    try {
      const result = await mergeEntriesWithAI(group, kind)
      if (result && result.entry) mergedEntry = sanitizeMergedEntry(result.entry)
      if (!mergedEntry && result && result.merged === false && !forceMerge) {
        summary.push('\u300c' + name + '\u300d\u7ecf AI \u5ba1\u67e5\u5224\u5b9a\u4e3a\u4e0d\u540c\u6761\u76ee\uff0c\u4fdd\u7559\u539f\u6837')
        continue
      }
    } catch (e) {
      // AI failed: fall back to local merge
    }
    if (!mergedEntry) {
      mergedEntry = sanitizeMergedEntry(fallbackMergeEntries(group, kind))
    }
    if (mergedEntry) {
      mergeable[i] = [mergedEntry]
      mergedCount++
      summary.push('\u5df2\u5408\u5e76 ' + group.length + ' \u6761' + label + '\u300c' + name + '\u300d')
    } else {
      summary.push('\u300c' + name + '\u300d\u6570\u636e\u683c\u5f0f\u5f02\u5e38\uff0c\u5df2\u4fdd\u7559\u539f\u6837')
    }
  }

  const all = [...mergeable, ...single]
  return {
    entries: all.flat(),
    mergedCount: mergedCount,
    summary: summary
  }
}
