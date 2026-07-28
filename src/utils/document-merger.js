import { extractKeywords } from './jobMatcher'

const SIMILARITY_THRESHOLD = 0.25
const MIN_TEXT_LENGTH = 50
const MAX_DOCS_PER_CLUSTER = 5

function jaccardSimilarity(setA, setB) {
  const intersection = new Set([...setA].filter(x => setB.has(x)))
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

  const docKeywords = valid.map(doc => ({
    doc,
    keywords: new Set(extractKeywords(getDocumentText(doc)))
  }))

  const used = new Set()
  const clusters = []

  for (let i = 0; i < docKeywords.length; i++) {
    if (used.has(i)) continue
    const cluster = [valid[i]]
    used.add(i)

    for (let j = i + 1; j < docKeywords.length; j++) {
      if (used.has(j)) continue
      const sim = jaccardSimilarity(docKeywords[i].keywords, docKeywords[j].keywords)
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
  return { clusters, skipped, total: knowledgeBaseItems.length }
}
