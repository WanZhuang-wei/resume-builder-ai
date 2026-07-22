/**
 * 文档解析工具 — 从 PDF/DOCX/TXT 中提取纯文本
 */
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'

function readAsArrayBuffer(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = () => reject(new Error('文件读取失败'))
    reader.readAsArrayBuffer(file)
  })
}

function readAsText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = () => reject(new Error('文件读取失败'))
    reader.readAsText(file)
  })
}

async function parseTxt(file) {
  return await readAsText(file)
}

async function parsePdf(file) {
  const pdfjsLib = await import('pdfjs-dist')
  // 使用本地 worker 文件，避免依赖 cdnjs 海外 CDN（国内不稳定的原因）
  pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl
  const arrayBuffer = await readAsArrayBuffer(file)
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise
  let text = ''
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i)
    const content = await page.getTextContent()
    text += content.items.map(item => item.str).join(' ') + '\n'
  }
  return text
}

async function parseDocx(file) {
  const mammoth = await import('mammoth')
  const arrayBuffer = await readAsArrayBuffer(file)
  const result = await mammoth.extractRawText({ arrayBuffer })
  return result.value
}

export async function parseDocument(file) {
  const name = file.name.toLowerCase()
  let text = ''
  let fileType = 'unknown'

  if (name.endsWith('.txt')) {
    text = await parseTxt(file)
    fileType = 'txt'
  } else if (name.endsWith('.pdf')) {
    text = await parsePdf(file)
    fileType = 'pdf'
  } else if (name.endsWith('.docx')) {
    text = await parseDocx(file)
    fileType = 'docx'
  } else if (name.endsWith('.doc')) {
    throw new Error('不支持 .doc 格式（旧版 Word），请先转换为 .docx 或 .pdf')
  } else {
    throw new Error('不支持的文件格式，仅支持 .txt, .pdf, .docx')
  }

  if (!text || text.trim().length < 10) {
    throw new Error('文件内容过少或无法提取文字，请检查文件是否可读')
  }

  return { text: text.trim(), fileType }
}

export function checkFileSize(file) {
  const maxSize = 10 * 1024 * 1024
  if (file.size > maxSize) {
    throw new Error('文件过大，请上传小于 10MB 的文件')
  }
  return true
}
