import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType } from "docx"

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

function addSection(doc, title, items, renderItem) {
  const children = [new Paragraph({ children: [new TextRun({ text: title, bold: true, size: 28 })], spacing: { before: 400, after: 200 } })]
  for (const item of items) {
    children.push(renderItem(item))
  }
  return children
}

export async function exportWord(profile) {
  const b = profile.basicInfo || {}
  const children = []

  // Header
  children.push(new Paragraph({
    children: [new TextRun({ text: b.name || "求职者", bold: true, size: 36 })],
    alignment: AlignmentType.CENTER,
    spacing: { after: 100 }
  }))
  if (b.title || b.targetPosition) {
    children.push(new Paragraph({
      children: [new TextRun({ text: b.title || b.targetPosition || "", size: 24, color: "666666" })],
      alignment: AlignmentType.CENTER,
      spacing: { after: 200 }
    }))
  }
  if (b.phone || b.email || b.wechat) {
    const contact = [b.phone, b.email, b.wechat].filter(Boolean).join(" | ")
    children.push(new Paragraph({
      children: [new TextRun({ text: contact, size: 20, color: "999999" })],
      alignment: AlignmentType.CENTER,
      spacing: { after: 100 }
    }))
  }

  // Summary
  if (b.summary) {
    children.push(new Paragraph({
      children: [new TextRun({ text: b.summary, size: 22 })],
      spacing: { before: 200, after: 200 }
    }))
  }

  // Work Experiences
  const exps = profile.workExperiences || []
  if (exps.length > 0) {
    children.push(...addSection(null, "工作经历", exps, function(exp) {
      const items = []
      items.push(new Paragraph({
        children: [
          new TextRun({ text: exp.company || "", bold: true, size: 24 }),
          new TextRun({ text: " · " + (exp.position || ""), size: 22, color: "1989fa" })
        ],
        spacing: { before: 200, after: 40 }
      }))
      items.push(new Paragraph({
        children: [new TextRun({ text: (exp.startDate || "") + " ~ " + (exp.endDate || "至今"), size: 20, color: "999999" })],
        spacing: { after: 80 }
      }))
      if (exp.description) {
        items.push(new Paragraph({
          children: [new TextRun({ text: exp.description, size: 22 })],
          spacing: { after: 60 }
        }))
      }
      if (exp.achievements) {
        items.push(new Paragraph({
          children: [new TextRun({ text: "主要成就：", bold: true, size: 22 }), new TextRun({ text: exp.achievements, size: 22 })],
          spacing: { after: 100 }
        }))
      }
      return items
    }))
    children.push(new Paragraph({ children: [], spacing: { after: 100 } }))
  }

  // Projects
  const projs = profile.projects || []
  if (projs.length > 0) {
    children.push(...addSection(null, "项目经验", projs, function(proj) {
      const items = []
      items.push(new Paragraph({
        children: [
          new TextRun({ text: proj.name || "", bold: true, size: 24 }),
          new TextRun({ text: " · " + (proj.role || ""), size: 22, color: "07c160" })
        ],
        spacing: { before: 200, after: 40 }
      }))
      if (proj.techStack) {
        items.push(new Paragraph({
          children: [new TextRun({ text: "技术栈：" + proj.techStack, size: 20, color: "999999" })],
          spacing: { after: 60 }
        }))
      }
      if (proj.description) {
        items.push(new Paragraph({
          children: [new TextRun({ text: proj.description, size: 22 })],
          spacing: { after: 100 }
        }))
      }
      return items
    }))
    children.push(new Paragraph({ children: [], spacing: { after: 100 } }))
  }

  // Education
  const edu = profile.education || []
  if (edu.length > 0) {
    children.push(...addSection(null, "教育背景", edu, function(e) {
      const dateStr = e.startDate ? (e.startDate + " ~ " + (e.endDate || "")) : ""
      return new Paragraph({
        children: [
          new TextRun({ text: e.school || "", size: 24 }),
          new TextRun({ text: (e.major ? " | " + e.major : "") + (e.degree ? " / " + e.degree : ""), size: 22, color: "666666" }),
          new TextRun({ text: dateStr ? "    " + dateStr : "", size: 20, color: "999999" })
        ],
        spacing: { before: 120, after: 80 }
      })
    }))
    children.push(new Paragraph({ children: [], spacing: { after: 100 } }))
  }

  // Skills
  const skills = profile.skills || []
  if (skills.length > 0) {
    const grouped = {}
    for (const s of skills) {
      const cat = s.category || "其他"
      if (!grouped[cat]) grouped[cat] = []
      grouped[cat].push(s.name)
    }
    children.push(...addSection(null, "技能", skills, function() { return [] }))
    // Remove the empty placeholder and add grouped skills
    children.pop()
    for (const [cat, names] of Object.entries(grouped)) {
      children.push(new Paragraph({
        children: [new TextRun({ text: cat + "：", bold: true, size: 22 }), new TextRun({ text: names.join("、"), size: 22 })],
        spacing: { before: 80 }
      }))
    }
    children.push(new Paragraph({ children: [], spacing: { after: 100 } }))
  }

  const doc = new Document({
    creator: "简历生成助手",
    title: b.name || "个人简历",
    sections: [{ children: children }]
  })

  const blob = await Packer.toBlob(doc)
  const filename = (b.name || "resume") + "-" + new Date().toISOString().split("T")[0] + ".docx"
  downloadBlob(blob, filename)
}
