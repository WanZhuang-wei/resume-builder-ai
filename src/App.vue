<template>
  <div class="app-container">
    <router-view v-if="isHrView" />
    <template v-else>
      <div class="page-header">
        <span class="header-title">{{ currentTitle }}</span>
        <div class="header-actions">
          <van-icon name="setting-o" class="header-settings" @click="goSettings" />
        </div>
      </div>
      <div class="page-body">
        <router-view />
      </div>
      <div class="page-footer">
        <van-tabbar :route="true" active-color="#1989fa" border>
          <van-tabbar-item icon="home-o" to="/dashboard">首页</van-tabbar-item>
          <van-tabbar-item icon="search" to="/jobs">岗位</van-tabbar-item>
          <van-tabbar-item icon="contact" to="/profile">资料</van-tabbar-item>
          <van-tabbar-item icon="description" to="/resume">简历</van-tabbar-item>
          <van-tabbar-item icon="chat-o" to="/chat">问答</van-tabbar-item>
          <van-tabbar-item icon="file-o" to="/import">导入</van-tabbar-item>
        </van-tabbar>
      </div>
    </template>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { onMounted } from 'vue'
import { useProfileStore } from '@/stores/profile'
import { metrics } from '@/utils/metrics'
import { showToast, showDialog } from 'vant'
import { logAction } from '@/utils/actionLog'
import { backupNow, hasBackup, restoreFromBackup } from '@/utils/dataGuard'

const route = useRoute()
const router = useRouter()
const profileStore = useProfileStore()

const isHrView = computed(() => route.path.startsWith('/hr/'))

const currentTitle = computed(() => route.meta?.title || '简历生成助手')

function goSettings() {
  router.push('/settings')
}

onMounted(async () => {
  await router.isReady()
  metrics.loadPersisted()
  try {
    await profileStore.loadAll()
    logAction('app.startup', { status: 'success', payload: { origin: window.location.origin, profileLoaded: profileStore.loaded } })
  } catch (e) {
    logAction('app.startup.loadProfile', { status: 'failed', error: e, payload: { origin: window.location.origin } })
    showToast({ message: '\u672c\u5730\u6570\u636e\u52a0\u8f7d\u5931\u8d25\uff0c\u8bf7\u5230\u8bbe\u7f6e\u9875\u6062\u590d\u5907\u4efd', type: 'fail' })
  }

  const empty = !profileStore.basicInfo &&
    profileStore.workExperiences.length === 0 &&
    profileStore.education.length === 0 &&
    profileStore.projects.length === 0 &&
    profileStore.skills.length === 0 &&
    profileStore.certificates.length === 0

  if (empty && hasBackup()) {
    showDialog({
      title: '\u68c0\u6d4b\u5230\u672c\u5730\u6570\u636e\u4e3a\u7a7a',
      message: '\u68c0\u6d4b\u5230\u6d4f\u89c8\u5668\u4e2d\u6709\u5386\u53f2\u5907\u4efd\uff0c\u662f\u5426\u6062\u590d\uff1f',
      confirmButtonText: '\u6062\u590d',
      cancelButtonText: '\u4e0d\u6062\u590d'
    }).then(async () => {
      await restoreFromBackup()
      await profileStore.loadAll()
      // \u6062\u590d\u6210\u529f\u540e\u628a\u5df2\u6062\u590d\u7684\u6570\u636e\u91cd\u65b0\u5199\u56de\u5907\u4efd\uff0c\u907f\u514d\u4e0b\u6b21\u88ab\u7a7a\u6570\u636e\u8986\u76d6
      try { await backupNow(); logAction('app.startup.backup', { status: 'success', payload: { afterRestore: true } }) } catch (e) { logAction('app.startup.backup', { status: 'failed', error: e }) }
      showToast('\u5df2\u4ece\u5907\u4efd\u6062\u590d')
      logAction('app.startup.restoreBackup', { status: 'success' })
    }).catch(() => {})
  } else if (!empty) {
    // \u4ec5\u5728\u6709\u6570\u636e\u65f6\u624d\u5728\u542f\u52a8\u65f6\u5237\u65b0\u5907\u4efd\uff1b\u6570\u636e\u4e3a\u7a7a\u65f6\u7edd\u4e0d\u8986\u76d6\u5df2\u6709\u5907\u4efd
    try {
      await backupNow()
      logAction('app.startup.backup', { status: 'success', payload: { hasBackup: hasBackup() } })
    } catch (e) {
      logAction('app.startup.backup', { status: 'failed', error: e })
    }
  }

  window.addEventListener('beforeunload', () => {
    metrics.persist()
    backupNow().catch(() => {})
  })
})
</script>

<style>
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Hiragino Sans GB',
    'Microsoft YaHei', 'Helvetica Neue', Helvetica, Arial, sans-serif;
  background: #f7f8fa;
  color: #333;
  -webkit-font-smoothing: antialiased;
}

.app-container {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}

.page-header {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  height: 46px;
  background: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 17px;
  font-weight: 600;
  z-index: 100;
  border-bottom: 1px solid #f0f0f0;
}

.header-actions {
  position: absolute;
  right: 12px;
  top: 0;
  height: 100%;
  display: flex;
  align-items: center;
}

.header-settings {
  font-size: 20px;
  color: #999;
  cursor: pointer;
  padding: 4px;
}

.header-settings:active {
  color: #1989fa;
}

.page-body {
  flex: 1;
  padding-top: 46px;
  padding-bottom: 50px;
  overflow-y: auto;
}

.page-footer {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  z-index: 100;
}

.section-card {
  background: #fff;
  border-radius: 8px;
  margin: 12px 16px;
  padding: 16px;
  box-shadow: 0 1px 4px rgba(0,0,0,0.04);
}

.section-title {
  font-size: 15px;
  font-weight: 600;
  margin-bottom: 12px;
  color: #333;
}

.empty-state {
  text-align: center;
  padding: 40px 20px;
  color: #999;
}

.empty-state .van-icon {
  font-size: 48px;
  margin-bottom: 12px;
  color: #ddd;
}

.action-buttons {
  display: flex;
  gap: 8px;
  margin-top: 12px;
}

.tag {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 12px;
  margin: 2px;
}

.tag-blue {
  background: #ecf5ff;
  color: #1989fa;
}

.tag-green {
  background: #f0f9eb;
  color: #07c160;
}

.tag-orange {
  background: #fff4e6;
  color: #ff976a;
}
</style>


