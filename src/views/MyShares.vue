<template>
  <div class="my-shares">
    <div class="section-card intro">
      <div class="intro-text">???????????????????????????????????/????????????????????? <b>admin.weisresume.cn</b>??????</div>
    </div>

    <div v-if="!loaded" class="section-card empty-state"><van-loading type="spinner" size="24" /><p>???...</p></div>
    <div v-else-if="items.length === 0" class="section-card empty-state">
      <van-icon name="records-o" />
      <p>???????</p>
      <p style="font-size:12px;color:#bbb">????????????????</p>
    </div>

    <div v-for="item in items" :key="item.id" class="section-card share-item">
      <div class="share-head">
        <span class="share-id">#{{ item.shareId }}</span>
        <van-tag :type="statusType(item.status)" size="medium">{{ statusText(item.status) }}</van-tag>
      </div>
      <div class="share-meta">???{{ formatTime(item.createdAt) }}</div>
      <div class="share-meta">???{{ item.expiresAt ? formatTime(item.expiresAt) : '??' }}</div>
      <div class="action-buttons">
        <van-button size="small" round plain type="primary" icon="copy-o" @click="copyLink(item)">??</van-button>
        <van-button size="small" round plain type="primary" icon="setting-o" @click="openManage(item)">??</van-button>
        <van-button size="small" round plain type="warning" icon="clock-o" @click="extend(item)">??</van-button>
        <van-button size="small" round plain type="danger" icon="close" @click="revoke(item)">??</van-button>
      </div>
    </div>

    <div class="privacy-note">
      ?????????????????????? 90 ??
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
  if (!value) return '??'
  return new Date(value).toLocaleString('zh-CN')
}

function statusType(status) {
  if (status === 'revoked') return 'danger'
  if (status === 'expired') return 'default'
  return 'success'
}

function statusText(status) {
  if (status === 'revoked') return '???'
  if (status === 'expired') return '???'
  return '???'
}

async function copyLink(item) {
  try {
    await navigator.clipboard.writeText(item.link)
    showToast('???????')
  } catch {
    showToast('????????????')
  }
}

function openManage(item) {
  if (item.manageToken) {
    router.push('/manage/' + item.shareId + '?token=' + item.manageToken)
  } else {
    showToast('???????????????')
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
  if (!res.ok) throw new Error(data.error || ('????? ' + res.status))
  return data
}

async function extend(item) {
  if (!item.manageToken) { showToast('???????????????'); return }
  try {
    const data = await managePost(item, { action: 'extend' })
    await store.updateOne(item.shareId, { status: 'active', expiresAt: new Date(data.expiresAt).getTime() })
    showSuccessToast('??? 30 ?')
    logAction('myShares.extend', { status: 'success', payload: { shareId: item.shareId } })
  } catch (e) {
    showToast(e.message)
    logAction('myShares.extend', { status: 'failed', payload: { shareId: item.shareId }, error: e })
  }
}

function revoke(item) {
  if (!item.manageToken) { showToast('???????????????'); return }
  showConfirmDialog({
    title: '????',
    message: '?????????????????????',
    confirmButtonText: '??',
    cancelButtonText: '??',
  }).then(async () => {
    try {
      await managePost(item, { action: 'revoke' })
      await store.updateOne(item.shareId, { status: 'revoked' })
      showSuccessToast('???')
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
