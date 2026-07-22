import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType } from 'docx'

// ===== 解析 AI 生成的简历文本 → 生成 Word 文档 =====

export async function exportDocx(content, filename = '简历.docx') {
  const children = parseContentToDocx(content)
  const doc = new Document({
    creator: '简历助手',
    title: '简历',
    description: 'AI 生成的简历',
    styles: {
      default: {
        document: {
          run: { size: 22, font: 'Microsoft YaHei' },
          paragraph: { spacing: { after: 120, line: 360 } }
        }
      }
    },
    sections: [{
      properties: {
        page: {
          margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 }
        }
      },
      children
    }]
  })
  const blob = await Packer.toBlob(doc)
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
  return blob
}

function parseContentToDocx(text) {
  if (!text) return []
  const lines = text.split('\n').filter(l => l.trim())
  const elements = []
  let i = 0

  while (i < lines.length) {
    const line = lines[i].trim()

    // Section header: 【xxx】
    if (/^[【\[](.+?)[】\]]/.test(line)) {
      const title = line.match(/^[【\[](.+?)[】\]]/)[1]
      const rest = line.replace(/^[【\[](.+?)[】\]]/, '').trim()
      elements.push(createHeading(title))
      if (rest) {
        elements.push(createParagraph(rest))
      }
    }
    // Bullet point
    else if (line.startsWith('- ') || line.startsWith('• ') || line.startsWith('* ')) {
      const text = line.replace(/^[-•*]\s*/, '')
      elements.push(createBullet(text))
    }
    // Separator: | 分隔
    else if (line.includes(' | ')) {
      elements.push(createParagraphWithPipe(line))
    }
    // Bold text wrapping **xxx**
    else if (line.includes('**')) {
      elements.push(createBoldParagraph(line))
    }
    // Normal paragraph
    else {
      elements.push(createParagraph(line))
    }

    i++
  }

  return elements
}

function createHeading(title) {
  return new Paragraph({
    children: [
      new TextRun({ text: title, bold: true, size: 28, color: '1a73e8' })
    ],
    spacing: { before: 360, after: 200 },
    border: {
      bottom: { color: '1a73e8', size: 6, style: 'single' }
    }
  })
}

function createParagraph(text) {
  return new Paragraph({
    children: [new TextRun({ text, size: 22 })],
    spacing: { after: 100 }
  })
}

function createBullet(text) {
  return new Paragraph({
    children: [new TextRun({ text: '•  ' + text, size: 22 })],
    spacing: { after: 80 },
    indent: { left: 400 }
  })
}

function createParagraphWithPipe(line) {
  // Render pipe separators as tab-separated bold/key parts
  const parts = line.split(' | ').filter(Boolean)
  const children = parts.map((part, idx) => {
    const isFirst = idx === 0
    const isLast = idx === parts.length - 1
    return new TextRun({
      text: part + (idx < parts.length - 1 ? '    ' : ''),
      bold: isFirst,
      size: 22,
    })
  })
  return new Paragraph({
    children,
    spacing: { after: 80 }
  })
}

function createBoldParagraph(line) {
  const parts = line.split(/(\*\*[^*]+\*\*)/g).filter(Boolean)
  const children = parts.map(part => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return new TextRun({ text: part.slice(2, -2), bold: true, size: 22 })
    }
    return new TextRun({ text: part, size: 22 })
  })
  return new Paragraph({
    children,
    spacing: { after: 100 }
  })
}