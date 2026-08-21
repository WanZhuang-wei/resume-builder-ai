<template>
  <div class="my-shares">
    <div class="section-card intro">
      <div class="intro-text">这里保存你在本机生成过的分享链接，可快速复制、管理、延期或撤销。想查看/管理全部链接与使用数据，请访问独立管理后台 <b>admin.weisresume.cn</b>（需登录）。</div>
    </div>

    <div v-if="!loaded" class="section-card empty-state"><van-loading type="spinner" size="24" /><p>加载中...</p></div>
    <div v-else-if="items.length === 0" class="section-card empty-state">
      <van-icon name="records-o" />
      <p>还没有分享记录</p>
      <p style="font-size:12px;color:#bbb">到“分享简历”页面生成第一个链接</p>
    </div>

    <div v-for="item in items" :key="item.id" class="section-card share-item">
      <div class="share-head">
        <span class="share-id">#{{ item.shareId }}</span>
        <van-tag :type="statusType(item.status)" size="medium">{{ statusText(item.status) }}</van-tag>
      </div>
      <div class="share-meta">创建：{{ formatTime(item.createdAt) }}</div>
      <div class="share-meta">到期：{{ item.expiresAt ? formatTime(item.expiresAt) : '未知' }}</div>
      <div class="action-buttons">
        <van-button size="small" round plain type="primary" icon="copy-o" @click="copyLink(item)">复制</van-button>
        <van-button size="small" round plain type="primary" icon="setting-o" @click="openManage(item)">管理</van-button>
        <van-button size="small" round plain type="warning" icon="clock-o" @click="extend(item)">延期</van-button>
        <van-button size="small" round plain type="danger" icon="close" @click="revoke(item)">撤销</van-button>
      </div>
    </div>

    <div class="privacy-note">
      仅统计匿名使用情况，不收集简历内容，数据保留 90 天。
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { showToast, showConfirmDialog, showSuccessToast } from 'vant'
import { useMySharesStore } from '@/stores/myShares'
import { logAction } from '@/utils/actionLog'

const SHARE_API = import.meta.env.VITE_SHARE_API || window.location.origin
const router = useRouter()
const store = useMySharesStore()

const items = ref([])
const loaded = ref(false)

onMounted(async () => {
  await store.load()
  items.value = store.items
  loaded.value = true
})

function formatTime(value) {
  if (!value) return '未知'
  return new Date(value).toLocaleString('zh-CN')
}

function statusType(status) {
  if (status === 'revoked') return 'danger'
  if (status === 'expired') return 'default'
  return 'success'
}

function statusText(status) {
  if (status === 'revoked') return '已撤销'
  if (status === 'expired') return '已过期'
  return '生效中'
}

async function copyLink(item) {
  try {
    await navigator.clipboard.writeText(item.link)
    showToast('已复制到剪贴板')
  } catch {
    showToast('复制失败，请长按链接复制')
  }
}

function openManage(item) {
  if (item.manageToken) {
    router.push('/manage/' + item.shareId + '?token=' + item.manageToken)
  } else {
    showToast('缺少管理口令，请到管理后台操作')
  }
  logAction('myShares.openManage', { status: 'success', payload: { shareId: item.shareId } })
}

async function managePost(item, body) {
  const res = await fetch(`${SHARE_API}/api/share/${item.shareId}/manage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token: item.manageToken, ...body })
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || ('服务器错误 ' + res.status))
  return data
}

async function extend(item) {
  if (!item.manageToken) { showToast('缺少管理口令，请到管理后台操作'); return }
  try {
    const data = await managePost(item, { action: 'extend' })
    await store.updateOne(item.shareId, { status: 'active', expiresAt: new Date(data.expiresAt).getTime() })
    showSuccessToast('已延期 30 天')
    logAction('myShares.extend', { status: 'success', payload: { shareId: item.shareId } })
  } catch (e) {
    showToast(e.message)
    logAction('myShares.extend', { status: 'failed', payload: { shareId: item.shareId }, error: e })
  }
}

function revoke(item) {
  if (!item.manageToken) { showToast('缺少管理口令，请到管理后台操作'); return }
  showConfirmDialog({
    title: '撤销分享',
    message: '确定撤销该链接吗？撤销后对方将无法再访问。',
    confirmButtonText: '撤销',
    cancelButtonText: '取消',
  }).then(async () => {
    try {
      await managePost(item, { action: 'revoke' })
      await store.updateOne(item.shareId, { status: 'revoked' })
      showSuccessToast('已撤销')
      logAction('myShares.revoke', { status: 'success', payload: { shareId: item.shareId } })
    } catch (e) {
      showToast(e.message)
      logAction('myShares.revoke', { status: 'failed', payload: { shareId: item.shareId }, error: e })
    }
  }).catch(() => {})
}
</script>

<style scoped>
.my-shares {
  padding-bottom: 20px;
}
.intro-text {
  font-size: 13px;
  color: #666;
  line-height: 1.6;
}
.share-item {
  padding: 14px 16px;
}
.share-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}
.share-id {
  font-size: 15px;
  font-weight: 600;
  color: #333;
}
.share-meta {
  font-size: 12px;
  color: #999;
  margin-bottom: 4px;
}
.privacy-note {
  text-align: center;
  font-size: 12px;
  color: #bbb;
  padding: 16px;
}
</style>
