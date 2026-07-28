export function exportJSON(profile) {
  const data = {
    exportDate: new Date().toISOString().split("T")[0],
    basicInfo: profile.basicInfo || {},
    workExperiences: profile.workExperiences || [],
    education: profile.education || [],
    projects: profile.projects || [],
    skills: profile.skills || [],
    certificates: profile.certificates || []
  }
  const json = JSON.stringify(data, null, 2)
  const blob = new Blob([json], { type: "application/json" })
  const url = URL.createObjectURL(blob)
  const name = (profile.basicInfo?.name || "resume") + "-data-" + data.exportDate + ".json"
  downloadFile(url, name)
  URL.revokeObjectURL(url)
}

export function exportMarkdown(profile) {
  const b = profile.basicInfo || {}
  let md = "# " + (b.name || "求职者") + "\n\n"

  if (b.title || b.targetPosition) {
    md += "**" + (b.title || b.targetPosition) + "**\n\n"
  }
  if (b.summary) {
    md += b.summary + "\n\n"
  }
  if (b.phone || b.email) {
    md += "---\n联系方式："
    if (b.phone) md += b.phone
    if (b.email) md += " | " + b.email
    md += "\n\n"
  }

  const exps = profile.workExperiences || []
  if (exps.length > 0) {
    md += "## 工作经历\n\n"
    for (const exp of exps) {
      md += "### " + (exp.company || "") + " · " + (exp.position || "") + "\n"
      md += (exp.startDate || "") + " ~ " + (exp.endDate || "至今") + "\n\n"
      if (exp.description) md += exp.description + "\n\n"
      if (exp.achievements) md += "**主要成就：**" + exp.achievements + "\n\n"
    }
  }

  const projs = profile.projects || []
  if (projs.length > 0) {
    md += "## 项目经验\n\n"
    for (const proj of projs) {
      md += "### " + (proj.name || "") + " · " + (proj.role || "") + "\n"
      if (proj.techStack) md += "技术栈：" + proj.techStack + "\n\n"
      if (proj.description) md += proj.description + "\n\n"
    }
  }

  const edu = profile.education || []
  if (edu.length > 0) {
    md += "## 教育背景\n\n"
    for (const e of edu) {
      md += "- " + e.school + " | " + (e.major || "") + " | " + (e.degree || "")
      if (e.startDate || e.endDate) md += " | " + (e.startDate || "") + " ~ " + (e.endDate || "")
      md += "\n"
    }
    md += "\n"
  }

  const skills = profile.skills || []
  if (skills.length > 0) {
    md += "## 技能\n\n"
    const grouped = {}
    for (const s of skills) {
      const cat = s.category || "其他"
      if (!grouped[cat]) grouped[cat] = []
      grouped[cat].push(s.name)
    }
    for (const [cat, names] of Object.entries(grouped)) {
      md += "- **" + cat + "**：" + names.join("、") + "\n"
    }
    md += "\n"
  }

  const certs = profile.certificates || []
  if (certs.length > 0) {
    md += "## 证书\n\n"
    for (const c of certs) {
      md += "- " + c.name + (c.issuer ? "（" + c.issuer + "）" : "") + "\n"
    }
    md += "\n"
  }

  md += "---\n*由简历生成助手导出于 " + new Date().toISOString().split("T")[0] + "*\n"

  const blob = new Blob([md], { type: "text/markdown" })
  const url = URL.createObjectURL(blob)
  const name = (profile.basicInfo?.name || "resume") + "-" + new Date().toISOString().split("T")[0] + ".md"
  downloadFile(url, name)
  URL.revokeObjectURL(url)
}

function downloadFile(url, filename) {
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
}
