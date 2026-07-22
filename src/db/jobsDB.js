import Dexie from 'dexie'

const jobsDB = new Dexie('ResumeJobsDB')

jobsDB.version(1).stores({
  jobPositions: '++id, title, category, subCategory, industry, education, experienceMin, experienceMax, salaryMin, salaryMax, hot, &title',
  favoriteJobs: '++id, jobId, createdAt'
})

export default jobsDB
