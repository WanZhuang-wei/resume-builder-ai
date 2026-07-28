/**
 * 资料整理工具 - 检测并合并重复/重叠的经历、项目、技能等
 */

/** 标准化字符串用于比较 */
function normalize(str) {
  return (str || "").toString().trim().toLowerCase()
}

/** 合并两个字符串中不重复的行 */
function mergeLines(a, b) {
  const lines = new Set()
  ;(a || "").split(/[\n;；。]+/).forEach(function(l) {
    const t = l.trim()
    if (t) lines.add(t)
  })
  ;(b || "").split(/[\n;；。]+/).forEach(function(l) {
    const t = l.trim()
    if (t) lines.add(t)
  })
  return Array.from(lines).join("\n")
}

/**
 * 整理工作经历：同一公司名称的条目合并
 */
function consolidateWorkExperiences(experiences) {
  const groups = new Map()
  const details = []

  experiences.forEach(function(exp) {
    const key = normalize(exp.company)
    if (!key) return
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key).push(exp)
  })

  const consolidated = []
  let merged = 0

  groups.forEach(function(group) {
    if (group.length === 1) {
      consolidated.push(group[0])
      return
    }

    // 合并同一公司的多个条目
    const mergedExp = {
      id: group[0].id,
      company: group[0].company,
      position: group.reduce(function(a, b) {
        return (a || "").length >= (b.position || "").length ? a : b.position
      }, ""),
      startDate: group.reduce(function(a, b) {
        return (!a || (b.startDate && b.startDate < a)) ? b.startDate : a
      }, ""),
      endDate: group.reduce(function(a, b) {
        return (b.endDate === "\u81f3\u4eca" || (b.endDate && b.endDate > a)) ? b.endDate : a
      }, ""),
      description: group.reduce(function(a, b) {
        return mergeLines(a, b.description)
      }, ""),
      achievements: group.reduce(function(a, b) {
        return mergeLines(a, b.achievements)
      }, ""),
      tags: Array.from(new Set(group.flatMap(function(e) { return e.tags || [] }))),
      type: group.some(function(e) { return e.type === "internship" })
        ? "internship"
        : group.some(function(e) { return e.type === "parttime" })
          ? "parttime" : "fulltime"
    }

    consolidated.push(mergedExp)
    merged++
    details.push({ company: group[0].company, count: group.length })
  })

  return { consolidated: consolidated, merged: merged, details: details }
}

/**
 * 整理项目：同名或子串匹配的项目合并
 */
function consolidateProjects(projects) {
  const used = new Set()
  const consolidated = []
  const details = []
  let merged = 0

  for (let i = 0; i < projects.length; i++) {
    if (used.has(i)) continue
    const a = projects[i]
    const aName = normalize(a.name)
    if (!aName) { consolidated.push(a); continue }

    const group = [a]
    used.add(i)

    for (let j = i + 1; j < projects.length; j++) {
      if (used.has(j)) continue
      const b = projects[j]
      const bName = normalize(b.name)
      if (!bName) continue

      if (aName === bName || aName.includes(bName) || bName.includes(aName)) {
        group.push(b)
        used.add(j)
      }
    }

    if (group.length === 1) {
      consolidated.push(a)
    } else {
      const mergedProj = {
        id: group[0].id,
        name: group.reduce(function(a, b) {
          return (a || "").length >= (b.name || "").length ? a : b.name
        }, ""),
        role: group.reduce(function(a, b) {
          return (a || "").length >= (b.role || "").length ? a : b.role
        }, ""),
        techStack: Array.from(new Set(group.flatMap(function(p) {
          return (p.techStack || "").split(/[,，、\s]+/).filter(Boolean)
        }))).join("\u3001"),
        description: group.reduce(function(a, b) {
          return mergeLines(a, b.description)
        }, ""),
        link: group.find(function(p) { return p.link })?.link || ""
      }
      consolidated.push(mergedProj)
      merged++
      details.push({ name: group[0].name, count: group.length })
    }
  }

  return { consolidated: consolidated, merged: merged, details: details }
}

/**
 * 技能去重：同名技能保留熟练度最高的
 */
function deduplicateSkills(skills) {
  const map = new Map()
  let removed = 0

  skills.forEach(function(skill) {
    const key = normalize(skill.name)
    if (!key) return
    if (map.has(key)) {
      const existing = map.get(key)
      if ((skill.proficiency || 0) > (existing.proficiency || 0)) {
        map.set(key, skill)
      }
      removed++
    } else {
      map.set(key, skill)
    }
  })

  return {
    consolidated: Array.from(map.values()),
    removed: removed,
    details: removed > 0 ? [{ count: removed }] : []
  }
}

/**
 * 证书去重：同名证书保留一条
 */
function deduplicateCertificates(certs) {
  const map = new Map()
  let removed = 0

  certs.forEach(function(cert) {
    const key = normalize(cert.name)
    if (!key) return
    if (!map.has(key)) {
      map.set(key, cert)
    } else {
      removed++
    }
  })

  return {
    consolidated: Array.from(map.values()),
    removed: removed,
    details: removed > 0 ? [{ count: removed }] : []
  }
}

/**
 * 教育去重：同学校+同学位合并
 */
function deduplicateEducation(eduList) {
  const map = new Map()
  let removed = 0

  eduList.forEach(function(edu) {
    const key = normalize(edu.school) + "|" + normalize(edu.degree)
    if (!key) return
    if (map.has(key)) {
      const existing = map.get(key)
      const existingLen = JSON.stringify(existing).length
      const currentLen = JSON.stringify(edu).length
      if (currentLen > existingLen) {
        map.set(key, edu)
      }
      removed++
    } else {
      map.set(key, edu)
    }
  })

  return {
    consolidated: Array.from(map.values()),
    removed: removed,
    details: removed > 0 ? [{ count: removed }] : []
  }
}

/**
 * 一键整理入口
 * @param {Object} profileData - { workExperiences, projects, skills, certificates, education }
 * @returns {Object} { workExperiences, projects, skills, certificates, education, hasChanges, summary }
 */
export function consolidateProfile(profileData) {
  const workResult = consolidateWorkExperiences(profileData.workExperiences || [])
  const projectResult = consolidateProjects(profileData.projects || [])
  const skillResult = deduplicateSkills(profileData.skills || [])
  const certResult = deduplicateCertificates(profileData.certificates || [])
  const eduResult = deduplicateEducation(profileData.education || [])

  const summary = []
  if (workResult.merged > 0) {
    summary.push(workResult.merged + " 组重复工作经历已合并")
  }
  if (projectResult.merged > 0) {
    summary.push(projectResult.merged + " 组重复项目已合并")
  }
  if (skillResult.removed > 0) {
    summary.push(skillResult.removed + " 个重复技能已去重")
  }
  if (certResult.removed > 0) {
    summary.push(certResult.removed + " 个重复证书已去重")
  }
  if (eduResult.removed > 0) {
    summary.push(eduResult.removed + " 个重复教育背景已去重")
  }

  return {
    workExperiences: workResult.consolidated,
    projects: projectResult.consolidated,
    skills: skillResult.consolidated,
    certificates: certResult.consolidated,
    education: eduResult.consolidated,
    hasChanges: summary.length > 0,
    summary: summary
  }
}
