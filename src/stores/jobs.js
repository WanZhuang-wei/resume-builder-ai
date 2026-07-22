import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import jobsDB from '@/db/jobsDB'
import { allPositions } from '@/data/index'
import { getTopMatches, getRandomMatches, computeMatchScore } from '@/utils/jobMatcher'
import { useProfileStore } from '@/stores/profile'

export const useJobsStore = defineStore('jobs', () => {
  const initialized = ref(false)
  const allJobs = ref([])
  const favorites = ref([])
  const favoriteIdSet = computed(() => new Set(favorites.value.map(f => f.jobId)))
  const currentRecommendations = ref([])
  const loading = ref(false)

  async function initJobData() {
    if (initialized.value) return
    loading.value = true
    try {
      const count = await jobsDB.jobPositions.count()
      if (count === 0) {
        await jobsDB.jobPositions.bulkAdd(allPositions)
      }
      allJobs.value = await jobsDB.jobPositions.toArray()
      favorites.value = await jobsDB.favoriteJobs.toArray()
      initialized.value = true
    } catch (e) {
      console.warn('宀椾綅鏁版嵁鍒濆鍖栧け璐?', e)
      allJobs.value = allPositions
      initialized.value = true
    } finally {
      loading.value = false
    }
  }

  function refreshRecommendations(count = 5) {
    const profileStore = useProfileStore()
    if (profileStore.completeness > 0) {
      const top = getTopMatches(profileStore.summaryData, allJobs.value, 20)
      const excludeIds = currentRecommendations.value.map(j => j.id || j.title)
      const remaining = top.filter(j => !excludeIds.includes(j.id || j.title))
      currentRecommendations.value = remaining.slice(0, count)
      if (currentRecommendations.value.length < count) {
        const extras = getRandomMatches(allJobs.value, excludeIds, count - currentRecommendations.value.length)
        currentRecommendations.value = [...currentRecommendations.value, ...extras]
      }
    } else {
      currentRecommendations.value = getRandomMatches(allJobs.value, [], count)
    }
  }

  function getMoreRecommendations(page = 1, pageSize = 20) {
    const profileStore = useProfileStore()
    if (profileStore.completeness > 0) {
      const all = getTopMatches(profileStore.summaryData, allJobs.value, 100)
      const start = (page - 1) * pageSize
      return all.slice(start, start + pageSize)
    }
    const start = (page - 1) * pageSize
    return allJobs.value.slice(start, start + pageSize)
  }

  async function toggleFavorite(job) {
    const existing = favorites.value.find(f => f.jobId === (job.id || job.title))
    if (existing) {
      await jobsDB.favoriteJobs.delete(existing.id)
      favorites.value = favorites.value.filter(f => f.id !== existing.id)
      return false
    }
    const id = await jobsDB.favoriteJobs.add({
      jobId: job.id || job.title,
      title: job.title,
      category: job.category,
      subCategory: job.subCategory,
      salaryMin: job.salaryMin,
      salaryMax: job.salaryMax,
      matchScore: job.matchScore,
      createdAt: new Date().toISOString()
    })
    const newFav = { id, jobId: job.id || job.title, title: job.title, category: job.category, subCategory: job.subCategory, salaryMin: job.salaryMin, salaryMax: job.salaryMax, matchScore: job.matchScore, createdAt: new Date().toISOString() }
    favorites.value = [...favorites.value, newFav]
    return true
  }

  function isFavorite(job) {
    return favoriteIdSet.value.has(job.id || job.title)
  }

  function getFavoriteJobs() {
    return favorites.value.map(fav => {
      const job = allJobs.value.find(j => (j.id || j.title) === fav.jobId)
      if (!job) {
        return { title: fav.title, subCategory: fav.subCategory, salaryMin: fav.salaryMin, salaryMax: fav.salaryMax, matchScore: fav.matchScore, favoritedAt: fav.createdAt }
      }
      return { ...job, matchScore: fav.matchScore, favoritedAt: fav.createdAt }
    })
  }

  function getJobByTitle(title) {
    return allJobs.value.find(j => j.title === title)
  }

  function getJobsByCategory(category) {
    return allJobs.value.filter(j => j.category === category)
  }

  function getJobsContext(maxJobs = 10) {
    const profileStore = useProfileStore()
    const top = getTopMatches(profileStore.summaryData, allJobs.value, maxJobs)
    return top
  }

  return {
    initialized, allJobs, favorites, favoriteIdSet, currentRecommendations, loading,
    initJobData, refreshRecommendations, getMoreRecommendations,
    toggleFavorite, isFavorite, getFavoriteJobs, getJobByTitle,
    getJobsByCategory, getJobsContext
  }
})
