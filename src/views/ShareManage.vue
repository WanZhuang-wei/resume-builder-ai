<template>
  <div class="share-manage">
    <div class="section-card">
      <div class="section-title">分享链接管理</div>
      <div v-if="loading" class="empty-state"><van-loading type="spinner" size="24" /><p>加载中...</p></div>
      <div v-else-if="error" class="empty-state"><van-icon name="warning-o" /><p>{{ error }}</p></div>
      <template v-else>
        <van-cell-group :border="false">
          <van-cell title="链接编号" :value="stats.id" />
          <van-cell title="创建时间" :value="formatTime(stats.createdAt)" />
          <van-cell title="提问上限" :value="stats.maxQuestions + ' 次'" />
          <van-cell title="使用情况" :value="stats.totalQuestions + ' 次提问 / ' + stats.sessionCount + ' 位访问者'" />
        </van-cell-group>

        <div class="manage-actions">
          <van-field v-model="maxInput" type="number" label="新上限" placeholder="如 5" />
          <van-button size="small" plain round type="primary" @click="updateMax">更新上限</van-button>
          <van-button size="small" plain round type="danger" @click="resetAll">重置全部</van-button>
        </div>

        <div class="section-title">访问者提问记录</div>
        <div v-if="stats.sessions.length === 0" class="empty-state"><p>还没有人提问</p></div>
        <van-cell-group v-else :border="false">
          <van-cell
            v-for="(s, i) in stats.sessions"
            :key="i"
            :title="'访问者 ' + (i + 1) + '（' + shortKey(s.hrKey) + '）'"
            :label="'已问 ' + s.count + ' 次，最后 ' + formatTime(s.lastAskedAt)"
          >
            <template #right-icon>
              <van-button size="mini" plain type="danger" @click="resetSession(s.hrKey)">重置</van-button>
            </template>
          </van-cell>
        </van-cell-group>
      </template>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { showToast, showConfirmDialog, showSuccessToast, showFailToast } from 'vant'
import { logAction } from '@/utils/actionLog'

const SHARE_API = import.meta.env.VITE_SHARE_API || 'http://localhost:3001'
const route = useRoute()

const shareId = ref(route.params.id || '')
const manageToken = ref(route.query.token || '')
const loading = ref(true)
const error = ref('')
const stats = ref(null)
const maxInput = ref('')

function shortKey(key) {
  return String(key || '').slice(0, 6) || '未知'
}

function formatTime(value) {
  if (!value) return '暂无'
  return new Date(value).toLocaleString('zh-CN')
}

async function loadStats() {
  loading.value = true
  error.value = ''
  try {
    const res = await fetch(`${SHARE_API}/api/share/${shareId.value}/manage?token=${encodeURIComponent(manageToken.value)}`)
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      throw new Error(data.error || ('服务器错误 ' + res.status))
    }
    stats.value = await res.json()
    maxInput.value = String(stats.value.maxQuestions || 3)
    logAction('shareManage.load', { status: 'success', payload: { shareId: shareId.value, totalQuestions: stats.value.totalQuestions } })
  } catch (e) {
    error.value = e.message
    logAction('shareManage.load', { status: 'failed', payload: { shareId: shareId.value }, error: e })
  } finally {
    loading.value = false
  }
}

async function manageAction(body) {
  try {
    const res = await fetch(`${SHARE_API}/api/share/${shareId.value}/manage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: manageToken.value, ...body })
    })
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      throw new Error(data.error || ('服务器错误 ' + res.status))
    }
    stats.value = await res.json()
    maxInput.value = String(stats.value.maxQuestions || 3)
    showSuccessToast('操作成功')
    logAction('shareManage.action', { status: 'success', payload: { shareId: shareId.value, body } })
  } catch (e) {
    showFailToast(e.message)
    logAction('shareManage.action', { status: 'failed', payload: { shareId: shareId.value, body }, error: e })
  }
}

function updateMax() {
  const value = parseInt(maxInput.value, 10)
  if (!Number.isFinite(value) || value < 1 || value > 100) {
    showToast('请输入 1-100 之间的数字')
    return
  }
  manageAction({ maxQuestions: value })
}

function resetAll() {
  showConfirmDialog({
    title: '重置全部次数',
    message: '确定重置所有访问者的提问次数？'
  }).then(() => manageAction({ resetAll: true })).catch(() => {})
}

function resetSession(hrKey) {
  showConfirmDialog({
    title: '重置该访问者',
    message: '确定重置这位访问者的提问次数？'
  }).then(() => manageAction({ resetHrKey: hrKey })).catch(() => {})
}

onMounted(loadStats)
</script>

<style scoped>
.share-manage {
  padding-bottom: 20px;
}

.manage-actions {
  display: flex;
  gap: 8px;
  align-items: center;
  margin: 12px 0;
}

.manage-actions .van-field {
  flex: 1;
}
</style>
