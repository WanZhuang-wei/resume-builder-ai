<template>
  <div class="hr-view" v-if="data">
    <!-- Contact Info Header -->
    <HrInfoCard
      :name="data.profile.basicInfo?.name || '求职者'"
      :title="data.profile.basicInfo?.title || data.profile.basicInfo?.targetPosition || ''"
      :summary="data.profile.basicInfo?.summary || ''"
      :targetPosition="data.profile.basicInfo?.targetPosition || ''"
      :contact="data.contact"
    />

    <!-- Profile Summary -->
    <div class="hr-section">
      <div class="hr-section-title">工作经验</div>
      <div v-if="data.profile.workExperiences?.length" class="profile-list">
        <div v-for="exp in data.profile.workExperiences" :key="exp.id" class="profile-item">
          <div class="item-header">
            <strong>{{ exp.company }}</strong>
            <van-tag plain size="small" color="#1989fa">{{ exp.position }}</van-tag>
          </div>
          <div class="item-meta">{{ exp.startDate }} - {{ exp.endDate || '至今' }}</div>
          <div class="item-desc">{{ exp.description }}</div>
          <div v-if="exp.achievements" class="item-achievements">{{ exp.achievements }}</div>
        </div>
      </div>
      <div v-else class="empty-text">暂无公开的工作经验</div>
    </div>

    <div class="hr-section">
      <div class="hr-section-title">项目经验</div>
      <div v-if="data.profile.projects?.length" class="profile-list">
        <div v-for="proj in data.profile.projects" :key="proj.id" class="profile-item">
          <div class="item-header">
            <strong>{{ proj.name }}</strong>
            <van-tag plain size="small" color="#07c160">{{ proj.role }}</van-tag>
          </div>
          <div class="item-meta">技术栈：{{ proj.techStack }}</div>
          <div class="item-desc">{{ proj.description }}</div>
        </div>
      </div>
      <div v-else class="empty-text">暂无公开的项目经验</div>
    </div>

    <div class="hr-section">
      <div class="hr-section-title">教育背景</div>
      <div v-if="data.profile.education?.length" class="profile-list">
        <div v-for="edu in data.profile.education" :key="edu.id" class="profile-item">
          <div class="item-header">
            <strong>{{ edu.school }}</strong> - {{ edu.major }}/{{ edu.degree }}
          </div>
          <div class="item-meta">{{ edu.startDate }} - {{ edu.endDate || '至今' }}</div>
        </div>
      </div>
      <div v-else class="empty-text">暂无公开的教育背景</div>
    </div>

    <div class="hr-section">
      <div class="hr-section-title">技能</div>
      <div v-if="data.profile.skills?.length" class="skills-grid">
        <van-tag v-for="skill in data.profile.skills" :key="skill.id" size="medium" color="#ecf5ff" text-color="#1989fa" style="margin: 2px">{{ skill.name }}</van-tag>
      </div>
      <div v-else class="empty-text">暂无公开的技能</div>
    </div>

    <!-- AI Chat Section -->
    <div class="hr-chat-section">
      <HrChatBox :context="data.profile" :share-id="shareId" />
    </div>

    <div class="hr-footer">
      <p>由 简历生成助手 提供技术支持</p>
    </div>
  </div>

  <div v-else class="loading-page">
    <van-loading v-if="loading" type="spinner" size="24" />
    <p>{{ loading ? '加载中...' : loadError }}</p>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { decompressData } from '@/utils/compress'
import HrInfoCard from '@/components/HrInfoCard.vue'
import HrChatBox from '@/components/HrChatBox.vue'
import { useShareStore } from '@/stores/share'
import { logAction } from '@/utils/actionLog'
import { getDeviceId } from '@/utils/tracker'

// 本地开发时用 .env 的 VITE_SHARE_API，部署后与前端同源
const SHARE_API = import.meta.env.VITE_SHARE_API || window.location.origin
const route = useRoute()
const data = ref(null)
const loading = ref(true)
const shareStore = useShareStore()
const loadError = ref('')
const shareId = ref('')

onMounted(async () => {
  const param = route.params.data
  shareId.value = param
  if (!param) {
    loading.value = false
    loadError.value = '无效的分享链接'
    return
  }

  // Step 1: 尝试从分享服务器获取（新短链接）
  let loaded = false
  try {
    const res = await fetch(SHARE_API + '/api/share/' + param + '?deviceId=' + encodeURIComponent(getDeviceId()))
    if (res.ok) {
      const decoded = await res.json()
      if (decoded && decoded.profile) {
        data.value = decoded
        loaded = true
      }
    }
  } catch (e) {
    console.warn('[hr] server fetch failed:', e.message)
  }

  // Step 2: 降级 — 旧版压缩链接（兼容已分享的旧链接）
  if (!loaded) {
    try {
      const decoded = decompressData(param)
      if (decoded && decoded.profile) {
        data.value = decoded
        loaded = true
      }
    } catch (e2) {
      console.warn('[hr] local decompress also failed', e2)
    }
  }

  if (loaded) {
    shareStore.incrementViewCount(param)
    logAction('hrView.load', { status: 'success', payload: { token: param } })
  } else {
    logAction('hrView.load', { status: 'failed', payload: { token: param } })
  }

  loading.value = false

  if (!loaded) {
    loadError.value = data.value && data.value.profile?.basicInfo?.name === '链接异常'
      ? '链接异常或已过期'
      : '无法加载分享内容'
    data.value = null
  }
})
</script>

<style scoped>
.hr-view {
  min-height: 100vh;
  background: #f5f7fa;
  padding-bottom: 20px;
}

.loading-page {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  gap: 12px;
  color: #999;
}

.hr-section {
  background: #fff;
  margin: 12px 16px;
  border-radius: 10px;
  padding: 16px;
}

.hr-section-title {
  font-size: 15px;
  font-weight: 600;
  color: #333;
  margin-bottom: 12px;
  padding-left: 8px;
  border-left: 3px solid #1989fa;
}

.profile-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.profile-item {
  padding: 8px 0;
  border-bottom: 1px solid #f5f5f5;
}

.profile-item:last-child {
  border-bottom: none;
}

.item-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 4px;
  font-size: 14px;
}

.item-meta {
  font-size: 12px;
  color: #999;
  margin-bottom: 4px;
}

.item-desc {
  font-size: 13px;
  color: #666;
  line-height: 1.5;
}

.item-achievements {
  font-size: 13px;
  color: #07c160;
  margin-top: 4px;
}

.skills-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.empty-text {
  font-size: 13px;
  color: #ccc;
  text-align: center;
  padding: 12px;
}

.hr-chat-section {
  margin: 12px 16px;
}

.hr-footer {
  text-align: center;
  padding: 16px;
  font-size: 12px;
  color: #ccc;
}
</style>
