<template>
  <div class="job-explore">
    <div class="tabs-bar">
      <van-tabs v-model:active="activeTab" animated>
        <van-tab title="推荐岗位">
          <div v-if="loading" style="padding:40px;text-align:center"><van-loading type="spinner" size="24" /><p style="color:#999;font-size:13px;margin-top:8px">计算匹配中...</p></div>
          <div v-else-if="recommendations.length === 0" class="empty-state">
            <van-icon name="search" /><p>暂无推荐，完善资料后可获得更精准推荐</p>
          </div>
          <div v-else>
            <div v-for="(job, idx) in recommendations" :key="idx" class="job-card section-card" @click="$router.push('/job/' + encodeURIComponent(job.title))">
              <div class="job-card-header">
                <div class="job-title">{{ job.title }}</div>
                <van-icon :name="isFav(job) ? 'like' : 'like-o'" :color="isFav(job) ? '#ee0a24' : '#ccc'" size="18" @click.stop="toggleFav(job)" />
              </div>
              <div class="job-tags">
                <van-tag :color="getMatchLabel(job.matchScore).color" size="small">{{ getMatchLabel(job.matchScore).text }} {{ job.matchScore }}%</van-tag>
                <van-tag plain type="primary" size="small">{{ job.subCategory }}</van-tag>
              </div>
              <div class="job-meta">
                <span class="salary">{{ job.salaryMin }}k-{{ job.salaryMax }}k</span>
                <span class="meta">{{ job.education }} · {{ job.experienceMin }}-{{ job.experienceMax }}年</span>
              </div>
              <div class="job-skills">
                <van-tag v-for="skill in (job.requiredSkills || []).slice(0,5)" :key="skill" round plain size="mini" style="margin-right:4px;margin-bottom:4px">{{ skill }}</van-tag>
                <span v-if="(job.requiredSkills||[]).length>5" class="more-skills">+{{ (job.requiredSkills||[]).length-5 }}</span>
              </div>
              <div class="job-desc">{{ job.description }}</div>
            </div>
            <div v-if="hasMore" style="padding:12px;text-align:center">
              <van-button plain size="small" :loading="loadingMore" @click="loadMore">加载更多</van-button>
            </div>
          </div>
        </van-tab>
        <van-tab title="收藏岗位">
          <div v-if="favoriteJobs.length === 0" class="empty-state">
            <van-icon name="star-o" /><p>还没有收藏的岗位，去推荐看看吧</p>
          </div>
          <div v-else>
            <div v-for="(job, idx) in favoriteJobs" :key="idx" class="job-card section-card" @click="$router.push('/job/' + encodeURIComponent(job.title))">
              <div class="job-card-header">
                <div class="job-title">{{ job.title }}</div>
                <van-icon name="like" color="#ee0a24" size="18" @click.stop="toggleFav(job)" />
              </div>
              <div class="job-tags">
                <van-tag v-if="job.matchScore" :color="getMatchLabel(job.matchScore).color" size="small">{{ getMatchLabel(job.matchScore).text }}</van-tag>
                <van-tag plain type="primary" size="small">{{ job.subCategory }}</van-tag>
              </div>
              <div class="job-meta">
                <span class="salary">{{ job.salaryMin }}k-{{ job.salaryMax }}k</span>
                <span class="meta">{{ job.education }} · {{ job.experienceMin }}-{{ job.experienceMax }}年</span>
              </div>
              <div class="job-skills">
                <van-tag v-for="skill in (job.requiredSkills || []).slice(0,5)" :key="skill" round plain size="mini" style="margin-right:4px;margin-bottom:4px">{{ skill }}</van-tag>
              </div>
            </div>
          </div>
        </van-tab>
        <van-tab title="分类浏览">
          <div class="category-list">
            <div v-for="cat in categories" :key="cat" class="category-section">
              <div class="category-title">{{ cat }}</div>
              <div class="subcategory-grid">
                <div v-for="sub in getSubcategories(cat)" :key="sub" class="subcategory-item" @click="filterBySubcategory(cat, sub)">
                  <div class="sub-name">{{ sub }}</div>
                  <div class="sub-count">{{ getCountBySubcategory(sub) }}个岗位</div>
                </div>
              </div>
            </div>
          </div>
        </van-tab>
      </van-tabs>
    </div>
  </div>
</template>
<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { showToast } from 'vant'
import { useJobsStore } from '@/stores/jobs'
import { getMatchLabel } from '@/utils/jobMatcher'

const router = useRouter()
const jobsStore = useJobsStore()
const activeTab = ref(0)
const loading = ref(true)
const loadingMore = ref(false)
const page = ref(1)
const recommendations = ref([])
const hasMore = ref(true)

const favoriteJobs = computed(() => jobsStore.getFavoriteJobs())
const categories = computed(() => [...new Set(jobsStore.allJobs.map(j => j.category))])

function getSubcategories(cat) {
  return [...new Set(jobsStore.allJobs.filter(j => j.category === cat).map(j => j.subCategory))]
}
function getCountBySubcategory(sub) {
  return jobsStore.allJobs.filter(j => j.subCategory === sub).length
}
function filterBySubcategory(cat, sub) {
  const jobs = jobsStore.allJobs.filter(j => j.category === cat && j.subCategory === sub)
  recommendations.value = jobs.map(j => ({ ...j, matchScore: 0 }))
  hasMore.value = false
  activeTab.value = 0
}

onMounted(async () => {
  if (!jobsStore.initialized) await jobsStore.initJobData()
  recommendations.value = jobsStore.getMoreRecommendations(1, 20)
  hasMore.value = recommendations.value.length >= 20
  loading.value = false
})

async function loadMore() {
  loadingMore.value = true
  page.value++
  const more = jobsStore.getMoreRecommendations(page.value, 20)
  recommendations.value = [...recommendations.value, ...more]
  hasMore.value = more.length >= 20
  loadingMore.value = false
}

function isFav(job) {
  return jobsStore.isFavorite(job)
}
async function toggleFav(job) {
  const added = await jobsStore.toggleFavorite(job)
  showToast(added ? '已收藏' : '已取消收藏')
}
</script>
<style scoped>
.job-explore { padding-bottom: 20px; }
.tabs-bar { margin: 0; }
.job-card { cursor: pointer; transition: transform 0.1s; }
.job-card:active { transform: scale(0.99); }
.job-card-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
.job-title { font-size: 16px; font-weight: 600; color: #333; }
.job-tags { display: flex; flex-wrap: wrap; gap: 4px; margin-bottom: 8px; }
.job-meta { display: flex; align-items: center; gap: 12px; margin-bottom: 8px; }
.salary { font-size: 16px; font-weight: 700; color: #ff6b35; }
.meta { font-size: 12px; color: #999; }
.job-skills { margin-bottom: 8px; }
.more-skills { font-size: 11px; color: #999; }
.job-desc { font-size: 13px; color: #888; line-height: 1.5; overflow: hidden; text-overflow: ellipsis; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; }
.category-title { font-size: 15px; font-weight: 600; margin: 16px 16px 8px; color: #333; }
.subcategory-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin: 0 16px; }
.subcategory-item { background: #f7f8fa; border-radius: 8px; padding: 12px 8px; text-align: center; cursor: pointer; }
.subcategory-item:active { background: #eee; }
.sub-name { font-size: 13px; font-weight: 500; margin-bottom: 4px; }
.sub-count { font-size: 11px; color: #999; }
</style>
