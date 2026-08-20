<template>
  <div>
    <div v-if="error" class="card error-box">{{ error }}</div>

    <div class="card">
      <div class="card-title">今日概览</div>
      <div class="grid" v-if="summary">
        <div class="stat"><div class="num">{{ summary.aiToday.requests }}</div><div class="label">今日 AI 请求</div></div>
        <div class="stat"><div class="num">{{ fmtTokens(summary.aiToday.tokens) }}</div><div class="label">今日 Tokens</div></div>
        <div class="stat"><div class="num">{{ summary.aiToday.failures }}</div><div class="label">今日 AI 失败</div></div>
        <div class="stat"><div class="num">¥{{ summary.estimatedCostCny.toFixed(2) }}</div><div class="label">近{{ summary.days }}天估算费用</div></div>
        <div class="stat"><div class="num">{{ summary.eventTotal }}</div><div class="label">近{{ summary.days }}天事件数</div></div>
        <div class="stat"><div class="num">{{ summary.shareStats.active || 0 }}</div><div class="label">生效分享</div></div>
      </div>
    </div>

    <div class="card">
      <div class="card-title">日活 / 新增（近 {{ days }} 天）</div>
      <div ref="chartRef" class="chart"></div>
    </div>

    <div class="card">
      <div class="card-title">激活漏斗（近 {{ days }} 天，去重设备）</div>
      <div v-if="summary" class="funnel">
        <div v-for="(step, i) in funnelSteps" :key="step.key" class="funnel-row">
          <div class="funnel-label">{{ step.label }}</div>
          <div class="funnel-bar-wrap">
            <div class="funnel-bar" :style="{ width: barWidth(summary.funnel[step.key]) }"></div>
          </div>
          <div class="funnel-num">{{ summary.funnel[step.key] }}</div>
          <div class="funnel-rate">{{ funnelRate(i) }}</div>
        </div>
      </div>
    </div>

    <div class="card">
      <div class="card-title">功能使用 TOP</div>
      <div v-if="summary && summary.topFeatures.length" class="top-list">
        <div v-for="f in summary.topFeatures" :key="f.feature" class="top-row">
          <span class="top-name">{{ featureName(f.feature) }}</span>
          <div class="top-bar-wrap"><div class="top-bar" :style="{ width: topWidth(f.n, summary.topFeatures[0].n) }"></div></div>
          <span class="top-num">{{ f.n }}</span>
        </div>
      </div>
      <div v-else class="empty">暂无数据</div>
    </div>

    <div class="card">
      <div class="card-title">AI 用量（近 {{ aiDays }} 天）</div>
      <table v-if="aiRows.length" class="table">
        <thead><tr><th>日期</th><th>请求</th><th>Tokens</th><th>失败</th><th>估算费用(¥)</th></tr></thead>
        <tbody>
          <tr v-for="r in aiRows" :key="r.d">
            <td>{{ r.d }}</td><td>{{ r.requests }}</td><td>{{ fmtTokens(r.tokens) }}</td><td>{{ r.failures }}</td>
            <td>{{ ((Number(r.prompt_tokens) * 2 + Number(r.completion_tokens) * 8) / 1000000).toFixed(2) }}</td>
          </tr>
        </tbody>
      </table>
      <div v-else class="empty">暂无数据</div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount, nextTick } from 'vue'
import * as echarts from 'echarts'
import { api } from '../api'

const days = ref(30)
const aiDays = ref(14)
const summary = ref(null)
const error = ref('')
const chartRef = ref(null)
const aiRows = ref([])
let chart = null

const funnelSteps = [
  { key: 'app_open', label: '启动应用' },
  { key: 'auto_fill', label: '自动填写资料' },
  { key: 'resume_generate', label: '生成简历' },
  { key: 'share_create', label: '创建分享' },
  { key: 'share_view', label: '分享被查看' },
  { key: 'share_ask', label: 'HR 提问' },
]
const FEATURE_NAMES = {
  auto_fill: '自动填写', resume_generate: '生成简历', job_analyze: '岗位分析',
  job_collect: '岗位采集', qa: '问答助手',
}

function featureName(key) { return FEATURE_NAMES[key] || key }
function fmtTokens(n) {
  const v = Number(n || 0)
  return v >= 10000 ? (v / 10000).toFixed(1) + 'w' : String(v)
}
function barWidth(n) {
  const max = summary.value ? summary.value.funnel.app_open : 1
  const v = Number(n || 0)
  return Math.max(v > 0 ? 4 : 0, Math.round((v / (max || 1)) * 100)) + '%'
}
function topWidth(n, max) { return Math.max(2, Math.round((Number(n) / (Number(max) || 1)) * 100)) + '%' }
function funnelRate(i) {
  const f = summary.value ? summary.value.funnel : {}
  const keys = funnelSteps.map(s => s.key)
  const cur = Number(f[keys[i]] || 0)
  const prev = i === 0 ? Number(f[keys[0]] || 0) : Number(f[keys[i - 1]] || 0)
  return (prev > 0 ? ((cur / prev) * 100).toFixed(0) + '%' : '-')
}

async function load() {
  error.value = ''
  try {
    summary.value = await api.summary(days.value)
    aiRows.value = (await api.aiUsage(aiDays.value)).rows || []
    await nextTick()
    renderChart()
  } catch (e) {
    error.value = '加载失败：' + e.message
  }
}

function renderChart() {
  if (!chartRef.value) return
  if (!chart) chart = echarts.init(chartRef.value)
  const active = summary.value.dailyActive || []
  const fresh = summary.value.dailyNew || []
  const dates = [...new Set([...active.map(r => r.d), ...fresh.map(r => r.d)])].sort()
  chart.setOption({
    tooltip: { trigger: 'axis' },
    legend: { data: ['日活', '新增'] },
    grid: { left: 40, right: 20, top: 40, bottom: 30 },
    xAxis: { type: 'category', data: dates },
    yAxis: { type: 'value', minInterval: 1 },
    series: [
      { name: '日活', type: 'line', smooth: true, data: dates.map(d => { const r = active.find(x => x.d === d); return r ? Number(r.n) : 0 }) },
      { name: '新增', type: 'line', smooth: true, data: dates.map(d => { const r = fresh.find(x => x.d === d); return r ? Number(r.n) : 0 }) },
    ],
  })
}

function onResize() { if (chart) chart.resize() }

onMounted(() => {
  load()
  window.addEventListener('resize', onResize)
})
onBeforeUnmount(() => {
  window.removeEventListener('resize', onResize)
  if (chart) { chart.dispose(); chart = null }
})
</script>

<style scoped>
.funnel-row { display: flex; align-items: center; gap: 10px; margin-bottom: 10px; }
.funnel-label { width: 110px; font-size: 13px; color: #666; flex-shrink: 0; }
.funnel-bar-wrap { flex: 1; background: #f0f2f5; border-radius: 6px; height: 16px; overflow: hidden; }
.funnel-bar { height: 100%; background: linear-gradient(90deg, #1989fa, #69b7ff); border-radius: 6px; min-width: 2px; }
.funnel-num { width: 44px; text-align: right; font-weight: 600; font-size: 13px; }
.funnel-rate { width: 52px; text-align: right; font-size: 12px; color: #999; }
.top-list { display: flex; flex-direction: column; gap: 10px; }
.top-row { display: flex; align-items: center; gap: 10px; }
.top-name { width: 90px; font-size: 13px; color: #666; flex-shrink: 0; }
.top-bar-wrap { flex: 1; background: #f0f2f5; border-radius: 6px; height: 14px; overflow: hidden; }
.top-bar { height: 100%; background: #07c160; border-radius: 6px; }
.top-num { width: 44px; text-align: right; font-weight: 600; font-size: 13px; }
.table { width: 100%; border-collapse: collapse; font-size: 13px; }
.table th, .table td { border-bottom: 1px solid #f0f0f0; padding: 8px 6px; text-align: left; }
.table th { color: #888; font-weight: 500; }
.empty { color: #bbb; font-size: 13px; padding: 20px; text-align: center; }
</style>
