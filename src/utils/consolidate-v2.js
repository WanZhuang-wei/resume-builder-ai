import { chat } from '@/api/deepseek'

const MAX_AI_CLUSTERS = 5
const AI_TIMEOUT = 30000

function buildMergePrompt(documents) {
  const docsText = documents.map(function(doc, i) {
    return "【文档 " + (i + 1) + "】\n" + (doc.title || "未命名") + "\n" + (doc.originalText || doc.aiSummary || "")
  }).join("\n\n---\n\n")

  return [
    {
      role: "system",
      content: "你是一位简历数据整理助手。以下是用户上传的关于同一段经历的" +
        "多份文档内容，请将其合并为一条完整的工作经历或项目经历。\n\n规则：\n" +
        "1. 只使用文档中提供的信息，不要编造\n" +
        "2. 合并重复或重叠的描述，保留最详细的内容\n" +
        '3. 输出格式为 JSON，包含以下字段：\n' +
        "   { company, position, startDate, endDate, description, achievements, tags, type }\n" +
        "4. description 和 achievements 要完整，合并不同文档中的内容\n" +
        "5. 如果某个字段在文档中都没有，则设为空字符串\n" +
        "6. 只输出 JSON，不要有其他文字"
    },
    { role: "user", content: "请合并以下多份文档内容：\n\n" + docsText }
  ]
}

export async function consolidateWithAI(clusters, profileStore, opts) {
  const options = opts || {}
  const onProgress = options.onProgress
  const signal = options.signal
  const summary = []

  const toMerge = clusters.slice(0, MAX_AI_CLUSTERS)
  const remaining = clusters.slice(MAX_AI_CLUSTERS)

  for (let idx = 0; idx < toMerge.length; idx++) {
    if (signal && signal.aborted) throw new Error("操作已取消")
    const cluster = toMerge[idx]
    if (cluster.length < 2) continue

    if (onProgress) onProgress({ current: idx + 1, total: toMerge.length, cluster: cluster })

    const messages = buildMergePrompt(cluster)
    try {
      const response = await Promise.race([
        chat(messages, { maxTokens: 1024, temperature: 0.3 }),
        new Promise(function(_, reject) {
          setTimeout(function() { reject(new Error("AI 响应超时")) }, AI_TIMEOUT)
        })
      ])

      const jsonMatch = response.match(/\{[\s\S]*?\}/)
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0])
        if (parsed.company || parsed.position || parsed.name) {
          if (parsed.company || parsed.position) {
            summary.push(cluster[0].title + " - 已合并 " + cluster.length + " 份文档")
          }
        }
      }
    } catch (e) {
      summary.push(cluster[0].title + " - AI 合并失败: " + e.message)
    }
  }

  if (remaining.length > 0) {
    summary.push("还有 " + remaining.length + " 组因数量限制未处理")
  }

  return { summary: summary, hasChanges: summary.length > 0 }
}
