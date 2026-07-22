export function computeMatchScore(userProfile, job) {
  let score = 0
  let totalWeight = 0
  const userSkills = (userProfile.skills || []).map(s => s.name?.toLowerCase().trim()).filter(Boolean)
  const jobSkills = (job.requiredSkills || []).map(s => s.toLowerCase().trim())
  if (userSkills.length > 0 && jobSkills.length > 0) {
    const matched = jobSkills.filter(js => userSkills.some(us => us.includes(js) || js.includes(us))).length
    score += (matched / jobSkills.length) * 50
    totalWeight += 50
  }
  const userExps = userProfile.workExperiences || []
  const totalYears = userExps.reduce((sum, exp) => {
    if (!exp.startDate) return sum
    const start = new Date(exp.startDate)
    const end = exp.endDate && exp.endDate !== '至今' ? new Date(exp.endDate) : new Date()
    return sum + (end - start) / (365.25 * 24 * 60 * 60 * 1000)
  }, 0)
  if (totalYears > 0) {
    const jobMin = job.experienceMin || 0
    const jobMax = job.experienceMax || 99
    let expScore = totalYears >= jobMin && totalYears <= jobMax ? 1.0 : totalYears < jobMin ? Math.max(0, totalYears / jobMin) : Math.max(0, 1 - (totalYears - jobMax) * 0.1)
    score += expScore * 20
    totalWeight += 20
  }
  const userEducation = userProfile.education?.[0]
  const eduLevels = { '高中': 1, '大专': 2, '本科': 3, '硕士': 4, '博士': 5 }
  if (userEducation?.degree && job.education) {
    const userLevel = eduLevels[userEducation.degree] || 0
    const jobLevel = eduLevels[job.education] || 0
    score += userLevel >= jobLevel ? 15 : (userLevel / jobLevel) * 10
    totalWeight += 15
  }
  const target = userProfile.basicInfo?.targetPosition?.toLowerCase() || ''
  if (target) {
    const jobTitle = job.title.toLowerCase()
    score += (jobTitle.includes(target) || target.includes(jobTitle) ? 1.0 : 0) * 10
    totalWeight += 10
  }
  return totalWeight > 0 ? Math.round((score / totalWeight) * 100) : 0
}
export function getTopMatches(userProfile, allJobs, limit = 10) {
  return allJobs.map(job => ({ ...job, matchScore: computeMatchScore(userProfile, job) }))
    .sort((a, b) => b.matchScore - a.matchScore).slice(0, limit)
}
export function getRandomMatches(allJobs, excludeIds = [], count = 5) {
  return allJobs.filter(j => !excludeIds.includes(j.id || j.title))
    .sort(() => Math.random() - 0.5).slice(0, count)
}
export function getMatchLabel(score) {
  if (score >= 80) return { text: '完美匹配', color: '#07c160' }
  if (score >= 60) return { text: '高度匹配', color: '#1989fa' }
  if (score >= 40) return { text: '部分匹配', color: '#ff976a' }
  if (score >= 20) return { text: '较低匹配', color: '#ff6b6b' }
  return { text: '暂不匹配', color: '#ccc' }
}
export function buildJobsSystemPrompt(jobContext) {
  if (!jobContext || jobContext.length === 0) return ''
  const jobList = jobContext.map((j, i) =>
    `${i+1}. ${j.title}（${j.subCategory}）匹配度 ${j.matchScore}%\n技能要求：${(j.requiredSkills || []).join('、')}\n岗位描述：${j.description || ''}`
  ).join('\n\n')
  return `\n\n【岗位数据库信息】\n以下是为用户推荐的岗位列表：\n${jobList}\n\n你可以基于这些信息回答关于求职方向、技能要求、行业发展等问题。`
}
