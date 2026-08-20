<template>
  <div class="dashboard">
    <ApiKeyDialog v-model="showApiDialog" @saved="onApiKeySaved" />

    <div v-if="!hasApiKey" class="api-key-banner" @click="showApiDialog = true">
      <van-icon name="info-o" />
      <div class="banner-text">
        <strong>未配置 DeepSeek API Key</strong>
        <p>点击此处设置，开启 AI 简历生成和自动填写功能</p>
      </div>
      <van-icon name="arrow" />
    </div>

    <div class="welcome-card section-card">
      <div class="welcome-text">
        <h2>{{ profileStore.basicInfo?.name || '求职者' }}，你好</h2>
        <p>{{ profileStore.basicInfo?.title || '完善你的个人资料开始使用' }}</p>
      </div>
      <div class="completeness-ring">
        <div class="ring">{{ profileStore.completeness }}%</div>
        <div class="ring-label">资料完整度</div>
      </div>
    </div>

    <div class="stats-grid">
      <div class="stat-item" @click="$router.push('/profile')">
        <div class="stat-num">{{ fulltimeCount }}</div>
        <div class="stat-label">工作经历</div>
      </div>
      <div class="stat-item" @click="$router.push('/profile')">
        <div class="stat-num" style="color:#ff976a">{{ internshipCount }}</div>
        <div class="stat-label">实习经历</div>
      </div>
      <div class="stat-item" @click="$router.push('/profile')">
        <div class="stat-num">{{ profileStore.education.length }}</div>
        <div class="stat-label">教育背景</div>
      </div>
      <div class="stat-item" @click="$router.push('/profile')">
        <div class="stat-num">{{ profileStore.projects.length }}</div>
        <div class="stat-label">项目经验</div>
      </div>
      <div class="stat-item" @click="$router.push('/profile')">
        <div class="stat-num">{{ profileStore.skills.length }}</div>
        <div class="stat-label">技能</div>
      </div>
    </div>

    <div class="section-card">
      <div class="section-title">快捷操作</div>
      <van-grid :column-num="2" :border="false">
        <van-grid-item icon="description" text="生成简历" @click="checkApiThen('/resume')" />
        <van-grid-item icon="chat-o" text="AI 问答" @click="checkApiThen('/chat')" />
        <van-grid-item icon="search" text="岗位分析" @click="checkApiThen('/analyze')" />
        <van-grid-item icon="photograph" text="采集岗位" @click="$router.push('/collect')" />
        <van-grid-item icon="file-o" text="自动填写" @click="checkApiThen('/import')" />
        <van-grid-item icon="share-o" text="分享简历" @click="$router.push('/share')" />
        <van-grid-item icon="setting-o" text="设置" @click="$router.push('/settings')" />
        <van-grid-item icon="records" text="一键整理" @click="showConsolidateResult" />
      </van-grid>
    </div>

    <JobRecommendWidget />

    <MetricsDashboard />

    <div v-if="profileStore.completeness < 100" class="section-card">
      <div class="section-title">完善建议</div>
      <van-cell-group :border="false">
        <van-cell v-if="!profileStore.basicInfo?.name" icon="warning-o" title="填写基本信息" is-link @click="$router.push('/profile')" />
        <van-cell v-if="fulltimeCount === 0" icon="warning-o" title="添加工作经历" is-link @click="$router.push('/profile')" />
        <van-cell v-if="profileStore.education.length === 0" icon="warning-o" title="添加教育背景" is-link @click="$router.push('/profile')" />
        <van-cell v-if="profileStore.projects.length === 0" icon="warning-o" title="添加项目经验" is-link @click="$router.push('/profile')" />
        <van-cell v-if="profileStore.skills.length === 0" icon="warning-o" title="添加技能标签" is-link @click="$router.push('/profile')" />
      </van-cell-group>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { showToast, showDialog, closeToast } from 'vant'
import { useProfileStore } from '@/stores/profile'
import { hasAiAccess } from '@/api/deepseek'
import { useRouter } from 'vue-router'
import ApiKeyDialog from '@/components/ApiKeyDialog.vue'
import JobRecommendWidget from '@/components/JobRecommendWidget.vue'
import { useJobsStore } from '@/stores/jobs'
import { logAction } from '@/utils/actionLog'
import MetricsDashboard from '@/components/MetricsDashboard.vue'

const profileStore = useProfileStore()
const router = useRouter()
const jobsStore = useJobsStore()

const hasApiKey = ref(hasAiAccess())
const showApiDialog = ref(false)
const pendingPath = ref('')

const fulltimeCount = computed(() =>
  profileStore.workExperiences.filter(e => e.type !== 'internship').length
)

const internshipCount = computed(() =>
  profileStore.workExperiences.filter(e => e.type === 'internship').length
)

function checkApiThen(path) {
  if (!hasAiAccess()) {
    pendingPath.value = path
    showApiDialog.value = true
  } else {
    router.push(path)
  }
}

function onApiKeySaved() {
  hasApiKey.value = hasAiAccess()
  if (pendingPath.value) {
    const path = pendingPath.value
    pendingPath.value = ''
    router.push(path)
  }
}


async function showConsolidateResult() {
  showToast({ message: '正在分析整理...', duration: 0 })
  logAction('dashboard.consolidate', { status: 'started' })
  try {
    const result = await profileStore.consolidateWithKnowledge()
    closeToast()
    logAction('dashboard.consolidate', { status: 'success', payload: { hasChanges: result.hasChanges } })
    if (!result.hasChanges) {
      const msg = result.summary.length > 0 ? result.summary.join('\n') : '未发现重复资料'
      showToast(msg)
      return
    }
    let action
    try {
      action = await showDialog({
        title: '整理完成',
        message: result.summary.join('\n'),
        confirmButtonText: '导出 Word 简历',
        showCancelButton: true,
        cancelButtonText: '返回'
      })
    } catch (e) {
      action = e
    }
    if (action === 'confirm') {
      profileStore.exportData('word')
      showToast('已导出 Word 文档')
    } else {
      showToast('资料已整理完成')
    }
  } catch (e) {
    closeToast()
    showToast('整理失败: ' + e.message)
    logAction('dashboard.consolidate', { status: 'failed', error: e })
  }
}


onMounted(() => {
  if (!profileStore.loaded) profileStore.loadAll()
  jobsStore.initJobData()
})
</script>

<style scoped>
.dashboard { padding-bottom: 20px; }
.api-key-banner { display: flex; align-items: center; gap: 10px; margin: 0 16px 8px; padding: 12px 14px; background: linear-gradient(135deg, #fff7e6, #fff1d6); border-radius: 10px; cursor: pointer; border: 1px solid #ffe0b2; }
.api-key-banner:active { opacity: 0.8; }
.api-key-banner .van-icon-info-o { font-size: 22px; color: #ff976a; }
.api-key-banner .van-icon-arrow { font-size: 16px; color: #ccc; margin-left: auto; }
.banner-text { flex: 1; font-size: 13px; color: #944; }
.banner-text strong { font-size: 14px; display: block; margin-bottom: 2px; }
.banner-text p { font-size: 12px; color: #b66; margin: 0; }
.welcome-card { display: flex; justify-content: space-between; align-items: center; }
.welcome-text h2 { font-size: 20px; margin-bottom: 4px; }
.welcome-text p { font-size: 13px; color: #999; }
.completeness-ring { text-align: center; }
.ring { width: 56px; height: 56px; border-radius: 50%; background: linear-gradient(135deg, #1989fa, #07c160); color: #fff; display: flex; align-items: center; justify-content: center; font-size: 14px; font-weight: 700; margin: 0 auto 4px; }
.ring-label { font-size: 11px; color: #999; }
.stats-grid { display: grid; grid-template-columns: repeat(5, 1fr); gap: 8px; margin: 0 16px 12px; }
.stat-item { background: #fff; border-radius: 8px; padding: 12px 8px; text-align: center; box-shadow: 0 1px 4px rgba(0,0,0,0.04); cursor: pointer; }
.stat-num { font-size: 22px; font-weight: 700; color: #1989fa; }
.stat-label { font-size: 12px; color: #999; margin-top: 2px; }
</style>

