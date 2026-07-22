import { jobPositions } from './jobPositions.js'
import { jobPositions2 } from './jobPositions2.js'
import { jobPositions3 } from './jobPositions3.js'

export const allPositions = [...jobPositions, ...jobPositions2, ...jobPositions3]
export const JOB_CATEGORIES = [
  ...new Set(allPositions.map(j => j.category))
]
export const JOB_SUBCATEGORIES = [
  ...new Set(allPositions.map(j => j.subCategory))
]
