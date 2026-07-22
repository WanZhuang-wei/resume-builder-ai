<template>
  <div v-if="visible" class="section-card recommend-card">
    <div class="recommend-header">
      <div class="section-title">
        <van-icon name="fire-o" color="#ff6b35" style="margin-right:6px" />
        推荐岗位
      </div>
      <div class="recommend-actions">
        <van-icon name="replay" @click="refreshJobs" style="font-size:18px;color:#999;cursor:pointer;margin-right:8px" />
        <van-button size="mini" plain round type="primary" @click="goExplore">更多</van-button>
      </div>
    </div>
    <div v-if="loading" style="padding:20px;text-align:center">
      <van-loading type="spinner" size="20" />
      <p style="font-size:12px;color:#999;margin-top:6px">正在匹配最合适岗位...</p>
    </div>
    <div v-else>
      <div v-for="(job, idx) in displayedJobs" :key="idx" class="recommend-item" @click="goDetail(job)">
        <div class="rec-title-row">
          <span class="rec-title">{{ job.title }}</span>
          <van-tag :color="getMatchLabel(job.matchScore).color" size="small">{{ job.matchScore }}%</van-tag>
        </div>
        <div class="rec-meta">
          <span class="rec-salary">{{ job.salaryMin }}k-{{ job.salaryMax }}k</span>
          <span class="rec-category">{{ job.subCategory }}</span>
        </div>
        <div class="rec-tags">
          <van-tag v-for="skill in (job.requiredSkills||[]).slice(0,3)" :key="skill" plain size="mini" style="margin-right:4px">{{ skill }}</van-tag>
        </div>
      </div>
    </div>
  </div>
</template>
<script setup>
import { ref, onMounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useJobsStore } from '@/stores/jobs'
import { getMatchLabel } from '@/utils/jobMatcher'
import { useProfileStore } from '@/stores/profile'

const props = defineProps({
  visible: { type: Boolean, default: true }
})
const router = useRouter()
const jobsStore = useJobsStore()
const profileStore = useProfileStore()
const loading = ref(true)
const displayedJobs = ref([])

onMounted(async () => {
  if (!profileStore.loaded) await profileStore.loadAll()
  if (!jobsStore.initialized) await jobsStore.initJobData()
  jobsStore.refreshRecommendations(3)
  displayedJobs.value = jobsStore.currentRecommendations
  loading.value = false
})

function refreshJobs() {
  loading.value = true
  jobsStore.refreshRecommendations(3)
  setTimeout(() => {
    displayedJobs.value = jobsStore.currentRecommendations
    loading.value = false
  }, 300)
}

function goExplore() {
  router.push('/jobs')
}

function goDetail(job) {
  router.push('/job/' + encodeURIComponent(job.title))
}
</script>
<style scoped>
.recommend-card { border: 1px solid #f0e0d0; background: linear-gradient(135deg, #fff8f3, #fff); }
.recommend-header { display: flex; align-items: center; justify-content: space-between; }
.recommend-actions { display: flex; align-items: center; }
.recommend-item { padding: 12px 0; border-bottom: 1px solid #f5f5f5; cursor: pointer; }
.recommend-item:last-child { border-bottom: none; }
.recommend-item:active { opacity: 0.7; }
.rec-title-row { display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px; }
.rec-title { font-size: 15px; font-weight: 600; color: #333; }
.rec-meta { display: flex; gap: 12px; margin-bottom: 6px; }
.rec-salary { font-size: 14px; font-weight: 600; color: #ff6b35; }
.rec-category { font-size: 12px; color: #999; }
.rec-tags { display: flex; flex-wrap: wrap; }
</style>
