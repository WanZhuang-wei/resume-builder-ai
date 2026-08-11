import Dexie from 'dexie'

// ?????????????????/???????
const jobsDB = new Dexie('ResumeJobsDB_v2')

jobsDB.version(1).stores({
  jobPositions: '++id, title, category, subCategory, industry, education, experienceMin, experienceMax, salaryMin, salaryMax, hot',
  favoriteJobs: '++id, jobId, createdAt'
})

export default jobsDB
