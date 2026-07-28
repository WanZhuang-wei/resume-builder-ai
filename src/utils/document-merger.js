const MIN_TEXT_LENGTH = 50
const MAX_DOCS_PER_CLUSTER = 5
const SIMILARITY_THRESHOLD = 0.12

/** 生成字符 N-gram（对中文/英文通用）*/
function getCharNGrams(text, n) {
  const cleaned = (text || "").replace(/[\s\n\r\t]+/g, "").toLowerCase()
  const ngrams = new Set()
  for (let i = 0; i <= cleaned.length - n; i++) {
    ngrams.add(cleaned.substring(i, i + n))
  }
  return ngrams
}

function jaccardSimilarity(setA, setB) {
  const intersection = new Set([...setA].filter(function(x) { return setB.has(x) }))
  const union = new Set([...setA, ...setB])
  return union.size === 0 ? 0 : intersection.size / union.size
}

function getDocumentText(doc) {
  return doc.aiSummary || doc.originalText || ""
}

function isValidDocument(doc) {
  return getDocumentText(doc).length >= MIN_TEXT_LENGTH
}

export function clusterDocuments(knowledgeBaseItems) {
  const valid = knowledgeBaseItems.filter(isValidDocument)
  if (valid.length === 0) return { clusters: [], skipped: 0, total: knowledgeBaseItems.length }

  // 用字符 trigram 替代关键词提取，对中文简历有效
  const docNGrams = valid.map(function(doc) {
    return { doc: doc, ngrams: getCharNGrams(getDocumentText(doc), 3) }
  })

  const used = new Set()
  const clusters = []

  for (let i = 0; i < docNGrams.length; i++) {
    if (used.has(i)) continue
    const cluster = [valid[i]]
    used.add(i)

    for (let j = i + 1; j < docNGrams.length; j++) {
      if (used.has(j)) continue
      const sim = jaccardSimilarity(docNGrams[i].ngrams, docNGrams[j].ngrams)
      if (sim >= SIMILARITY_THRESHOLD) {
        if (cluster.length < MAX_DOCS_PER_CLUSTER) {
          cluster.push(valid[j])
          used.add(j)
        }
      }
    }
    clusters.push(cluster)
  }

  const skipped = knowledgeBaseItems.length - valid.length
  return { clusters: clusters, skipped: skipped, total: knowledgeBaseItems.length }
}
