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
        <van-tabbar v-model="active" active-color="#1989fa" border>
          <van-tabbar-item icon="home-o" @click="navigate('/dashboard')">首页</van-tabbar-item>
          <van-tabbar-item icon="search" @click="navigate('/jobs')">岗位</van-tabbar-item>
          <van-tabbar-item icon="contact" @click="navigate('/profile')">资料</van-tabbar-item>
          <van-tabbar-item icon="description" @click="navigate('/resume')">简历</van-tabbar-item>
          <van-tabbar-item icon="chat-o" @click="navigate('/chat')">问答</van-tabbar-item>
          <van-tabbar-item icon="file-o" @click="navigate('/import')">导入</van-tabbar-item>
        </van-tabbar>
      </div>
    </template>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { onMounted } from 'vue'
import { useProfileStore } from '@/stores/profile'
import { metrics } from '@/utils/metrics'

const route = useRoute()
const router = useRouter()
const profileStore = useProfileStore()

const TAB_PATHS = ['/dashboard', '/jobs', '/profile', '/resume', '/chat', '/import']
const active = ref(0)

const isHrView = computed(() => route.path.startsWith('/hr/'))

const currentTitle = computed(() => route.meta?.title || '简历生成助手')

function goSettings() {
  router.push('/settings')
}

function navigate(path) {
  router.push(path)
}

onMounted(async () => {
  // 等待初始路由解析完成（根路径 → dashboard 重定向）
  await router.isReady()
  // 同步底部标签高亮与当前路由
  const idx = TAB_PATHS.indexOf(route.path)
  if (idx >= 0) active.value = idx

  profileStore.loadAll()
  metrics.loadPersisted()
  window.addEventListener('beforeunload', () => { metrics.persist() })
})

// 监听后续路由变化，自动同步高亮
watch(() => route.path, (path) => {
  const idx = TAB_PATHS.indexOf(path)
  active.value = idx >= 0 ? idx : -1
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
