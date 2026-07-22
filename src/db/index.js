import Dexie from 'dexie'

const db = new Dexie('ResumeBuilderDB')

db.version(1).stores({
  basicInfo: '++id, name, phone, wechat, email, title, summary, targetPosition',
  workExperiences: '++id, company, position, startDate, endDate, description, achievements, tags',
  education: '++id, school, major, degree, startDate, endDate, gpa, honors',
  projects: '++id, name, role, techStack, description, highlights, link',
  skills: '++id, category, name, proficiency',
  certificates: '++id, name, issuer, date, description',
  resumes: '++id, targetCompany, targetPosition, jobDescription, content, createdAt, updatedAt',
  shareConfigs: '++id, selectedContact, selectedSections, createdAt',
  chatHistory: '++id, role, content, timestamp',
  knowledgeBase: '++id, title, sourceType, fileType, originalText, aiSummary, tags, createdAt',
  collectedJobs: '++id, sourceId, parsedJson, createdAt'
})

export default db

