<template>
  <div class="job-detail">
    <div v-if="job" class="detail-content">
      <div class="detail-header section-card">
        <div class="job-title-row">
          <h2>{{ job.title }}</h2>
          <van-icon :name="isFav ? 'like' : 'like-o'" :color="isFav ? '#ee0a24' : '#999'" size="22" @click="handleToggleFav" style="cursor:pointer" />
        </div>
        <div class="job-tags">
          <van-tag :color="matchLabel.color" size="medium">{{ matchLabel.text }} {{ job.matchScore }}%</van-tag>
          <van-tag plain type="primary" size="medium">{{ job.subCategory }}</van-tag>
          <van-tag plain type="warning" size="medium">{{ job.industry }}</van-tag>
        </div>
        <div class="salary-row">
          <span class="salary">{{ job.salaryMin }}k-{{ job.salaryMax }}k</span>
          <span class="meta">{{ job.education }} · {{ job.experienceMin }}-{{ job.experienceMax }}年</span>
        </div>
      </div>
      <div class="section-card">
        <div class="section-title">岗位描述</div>
        <p class="desc-text">{{ job.description }}</p>
      </div>
      <div class="section-card">
        <div class="section-title">技能要求</div>
        <div class="skills-list">
          <van-tag v-for="skill in job.requiredSkills" :key="skill" round color="#ecf5ff" text-color="#1989fa" style="margin:4px">{{ skill }}</van-tag>
        </div>
      </div>
      <div class="section-card">
        <div class="section-title">基本信息</div>
        <van-cell-group :border="false">
          <van-cell title="行业" :value="job.industry" />
          <van-cell title="分类" :value="job.category" />
          <van-cell title="子类" :value="job.subCategory" />
          <van-cell title="学历要求" :value="job.education" />
          <van-cell title="经验要求" :value="`${job.experienceMin}-${job.experienceMax}年`" />
          <van-cell title="薪资范围" :value="`${job.salaryMin}k-${job.salaryMax}k`" />
        </van-cell-group>
      </div>
      <div style="padding:16px">
        <van-button :icon="isFav ? 'like' : 'like-o'" :type="isFav ? 'danger' : 'primary'" block round @click="handleToggleFav">{{ isFav ? '取消收藏' : '收藏该岗位' }}</van-button>
      </div>
    </div>
    <div v-else class="empty-state">
      <van-icon name="search" />
      <p>未找到该岗位</p>
    </div>
  </div>
</template>
<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { showToast } from 'vant'
import { useJobsStore } from '@/stores/jobs'
import { computeMatchScore, getMatchLabel } from '@/utils/jobMatcher'
import { useProfileStore } from '@/stores/profile'

const route = useRoute()
const jobsStore = useJobsStore()
const profileStore = useProfileStore()
const job = ref(null)
const matchLabel = computed(() => getMatchLabel(job.value?.matchScore || 0))
const isFav = computed(() => job.value ? jobsStore.isFavorite(job.value) : false)

onMounted(async () => {
  if (!jobsStore.initialized) await jobsStore.initJobData()
  if (!profileStore.loaded) await profileStore.loadAll()
  const title = route.params.title
  const found = jobsStore.getJobByTitle(title)
  if (found) {
    const score = profileStore.completeness > 0 ? computeMatchScore(profileStore.summaryData, found) : 0
    job.value = { ...found, matchScore: score }
  }
})

async function handleToggleFav() {
  if (!job.value) return
  const added = await jobsStore.toggleFavorite(job.value)
  showToast(added ? '已收藏' : '已取消收藏')
}
</script>
<style scoped>
.job-detail { padding-bottom: 20px; }
.detail-header h2 { font-size: 20px; margin-bottom: 8px; }
.job-title-row { display: flex; align-items: center; justify-content: space-between; }
.job-tags { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 12px; }
.salary-row { display: flex; align-items: center; gap: 12px; }
.salary { font-size: 22px; font-weight: 700; color: #ff6b35; }
.meta { font-size: 13px; color: #999; }
.desc-text { font-size: 14px; line-height: 1.8; color: #555; }
.skills-list { display: flex; flex-wrap: wrap; gap: 4px; }
</style>
