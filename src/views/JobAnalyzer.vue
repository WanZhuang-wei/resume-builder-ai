<template>
  <div class="job-analyzer">
    <ApiKeyDialog v-model="showApiDialog" @saved="onApiKeySaved" />

    <div class="section-card">
      <div class="section-title">岗位分析</div>
      <van-form @submit="startAnalyze">
        <van-field v-model="jobDescription" label="岗位描述" type="textarea" rows="8" placeholder="粘贴目标岗位的JD（职位描述）到此处..." :rules="[{ required: true, message: '请粘贴岗位描述' }]" />
        <van-button round block type="primary" native-type="submit" :loading="loading" loading-text="分析中..." size="small">
          {{ loading ? '分析中...' : 'AI 分析匹配度' }}
        </van-button>
      </van-form>
    </div>

    <div v-if="result" class="section-card">
      <div class="section-title">分析结果</div>
      <div class="result-content">{{ result }}</div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { showToast } from 'vant'
import { useProfileStore } from '@/stores/profile'
import { analyzeJob, getApiKey } from '@/api/deepseek'
import ApiKeyDialog from '@/components/ApiKeyDialog.vue'

const profileStore = useProfileStore()
const jobDescription = ref('')
const result = ref('')
const loading = ref(false)
const showApiDialog = ref(false)
const pendingAction = ref(false)

onMounted(() => {
  if (!profileStore.loaded) profileStore.loadAll()
})

async function startAnalyze() {
  if (!getApiKey()) {
    pendingAction.value = true
    showApiDialog.value = true
    return
  }
  loading.value = true
  try {
    if (!profileStore.loaded) await profileStore.loadAll()
    const res = await analyzeJob(profileStore.summaryData, jobDescription.value)
    result.value = res
  } catch (e) {
    showToast('分析失败：' + e.message)
  } finally {
    loading.value = false
  }
}

function onApiKeySaved() {
  if (pendingAction.value) {
    pendingAction.value = false
    startAnalyze()
  }
}
</script>

<style scoped>
.job-analyzer { padding-bottom: 20px; }
.result-content { white-space: pre-wrap; font-size: 14px; line-height: 1.8; color: #333; }
</style>
