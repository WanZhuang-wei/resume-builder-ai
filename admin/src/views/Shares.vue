<template>
  <div>
    <div class="card">
      <div class="toolbar">
        <div class="filters">
          <button v-for="s in statusTabs" :key="s.key" :class="{ active: status === s.key }" @click="setStatus(s.key)">{{ s.label }}</button>
        </div>
        <div class="actions">
          <input v-model="q" class="search" placeholder="搜索链接 ID" @keyup.enter="load(1)" />
          <button class="btn" @click="load(1)">搜索</button>
          <a class="btn" :href="CSV_URL" target="_blank">导出 CSV</a>
        </div>
      </div>
      <div v-if="error" class="error-box">{{ error }}</div>
      <table class="table" v-if="items.length">
        <thead>
          <tr><th>ID</th><th>状态</th><th>创建时间</th><th>到期时间</th><th>查看</th><th>提问</th><th>操作</th></tr>
        </thead>
        <tbody>
          <tr v-for="it in items" :key="it.id">
            <td class="mono">{{ it.id }}</td>
            <td><span class="tag" :class="'tag-' + it.status">{{ statusLabel(it.status) }}</span></td>
            <td>{{ fmt(it.created_at) }}</td>
            <td :class="{ expired: isExpired(it) }">{{ fmt(it.expires_at) }}</td>
            <td>{{ it.view_count }}</td>
            <td>{{ it.ask_count }}</td>
            <td class="ops">
              <button class="mini" @click="extend(it)">延期30天</button>
              <button class="mini danger" @click="revoke(it)">撤销</button>
              <button class="mini danger" @click="remove(it)">删除</button>
            </td>
          </tr>
        </tbody>
      </table>
      <div v-else class="empty">暂无分享记录</div>
      <div class="pager" v-if="total > pageSize">
        <button :disabled="page <= 1" @click="load(page - 1)">上一页</button>
        <span>{{ page }} / {{ totalPages }}</span>
        <button :disabled="page >= totalPages" @click="load(page + 1)">下一页</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { showConfirmDialog, showSuccessToast, showFailToast } from 'vant'
import { api, CSV_URL } from '../api'

const statusTabs = [
  { key: 'all', label: '全部' },
  { key: 'active', label: '生效中' },
  { key: 'revoked', label: '已撤销' },
  { key: 'expired', label: '已过期' },
]
const status = ref('all')
const q = ref('')
const items = ref([])
const total = ref(0)
const page = ref(1)
const pageSize = ref(20)
const error = ref('')

const totalPages = computed(() => Math.max(1, Math.ceil(total.value / pageSize.value)))

function setStatus(key) { status.value = key; load(1) }
function statusLabel(s) {
  if (s === 'revoked') return '已撤销'
  if (s === 'expired') return '已过期'
  return '生效中'
}
function isExpired(it) {
  return it.status === 'expired' || (it.expires_at && Number(it.expires_at) < Date.now())
}
function fmt(ms) {
  if (!ms) return '-'
  return new Date(Number(ms)).toLocaleString('zh-CN')
}

async function load(p) {
  page.value = p || 1
  error.value = ''
  try {
    const res = await api.shares({ page: page.value, pageSize: pageSize.value, status: status.value, q: q.value.trim() })
    items.value = res.items || []
    total.value = Number(res.total || 0)
  } catch (e) {
    error.value = '加载失败：' + e.message
  }
}

async function extend(it) {
  try {
    await api.shareAction(it.id, 'extend')
    showSuccessToast('已延期 30 天')
    load(page.value)
  } catch (e) { showFailToast(e.message) }
}
function revoke(it) {
  showConfirmDialog({
    title: '撤销分享',
    message: '确定撤销 ' + it.id + ' 吗？撤销后对方无法访问。',
    confirmButtonText: '撤销',
  }).then(async () => {
    try {
      await api.shareAction(it.id, 'revoke')
      showSuccessToast('已撤销')
      load(page.value)
    } catch (e) { showFailToast(e.message) }
  }).catch(() => {})
}
function remove(it) {
  showConfirmDialog({
    title: '删除分享',
    message: '确定永久删除 ' + it.id + ' 吗？此操作不可恢复。',
    confirmButtonText: '删除',
  }).then(async () => {
    try {
      await api.shareAction(it.id, 'delete')
      showSuccessToast('已删除')
      load(page.value)
    } catch (e) { showFailToast(e.message) }
  }).catch(() => {})
}

onMounted(() => load(1))
</script>

<style scoped>
.toolbar { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px; margin-bottom: 14px; }
.filters { display: flex; gap: 8px; }
.filters button {
  border: 1px solid #e0e0e0; background: #fff; color: #666; padding: 6px 14px;
  border-radius: 16px; cursor: pointer; font-size: 13px;
}
.filters button.active { background: #1989fa; color: #fff; border-color: #1989fa; }
.actions { display: flex; gap: 8px; align-items: center; }
.search { border: 1px solid #e0e0e0; border-radius: 8px; padding: 6px 10px; font-size: 13px; width: 160px; }
.btn { display: inline-block; border: 1px solid #1989fa; color: #1989fa; background: #fff; border-radius: 8px; padding: 6px 12px; font-size: 13px; cursor: pointer; text-decoration: none; }
.table { width: 100%; border-collapse: collapse; font-size: 13px; }
.table th, .table td { border-bottom: 1px solid #f0f0f0; padding: 9px 6px; text-align: left; }
.table th { color: #888; font-weight: 500; }
.mono { font-family: Consolas, monospace; }
.expired { color: #c0c4cc; }
.tag { display: inline-block; padding: 2px 8px; border-radius: 10px; font-size: 12px; }
.tag-active { background: #f0f9eb; color: #07c160; }
.tag-revoked { background: #fef0f0; color: #ee0a24; }
.tag-expired { background: #f4f4f5; color: #909399; }
.ops { display: flex; gap: 6px; }
.mini { border: 1px solid #1989fa; color: #1989fa; background: #fff; border-radius: 6px; padding: 3px 8px; font-size: 12px; cursor: pointer; }
.mini.danger { border-color: #ee0a24; color: #ee0a24; }
.pager { display: flex; justify-content: center; align-items: center; gap: 12px; margin-top: 14px; font-size: 13px; color: #666; }
.pager button { border: 1px solid #e0e0e0; background: #fff; border-radius: 6px; padding: 4px 12px; cursor: pointer; }
.pager button:disabled { opacity: 0.4; cursor: default; }
.empty { color: #bbb; font-size: 13px; padding: 20px; text-align: center; }
.error-box { color: #ee0a24; padding: 12px; text-align: center; }
</style>
