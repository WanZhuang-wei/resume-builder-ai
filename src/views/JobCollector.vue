<template>
  <div class="job-collector">

    <div class="section-card">
      <div class="section-title">
        <van-icon name="edit" style="margin-right:4px" />
        手动录入岗位信息
      </div>
      <div style="font-size:13px;color:#666;line-height:1.6;padding:4px 0">
        粘贴JD文本或手动填写岗位信息，保存后可到分析页做匹配度分析。
      </div>
      <van-form @submit="saveJob" style="margin-top:8px">
        <van-field v-model="form.company" label="公司名称" placeholder="可选" />
        <van-field v-model="form.position" label="岗位名称" placeholder="如：前端工程师" />
        <van-field v-model="form.salary" label="薪资范围" placeholder="可选" />
        <van-field v-model="form.city" label="工作城市" placeholder="可选" />
        <van-field v-model="form.jd" label="岗位描述" type="textarea" rows="8" placeholder="粘贴岗位描述..." />
        <div style="display:flex;gap:8px;margin-top:8px">
          <van-button round block type="primary" native-type="submit" :loading="saving" size="small">保存岗位</van-button>
          <van-button round block plain type="primary" size="small" @click="parseWithAI" :loading="parsing">AI解析</van-button>
        </div>
      </van-form>
    </div>

    <div class="section-card">
      <div class="section-title">已录入岗位 ({{ jobs.length }})</div>
      <div v-if="jobs.length === 0" class="empty-state">
        <van-icon name="search" /><p>暂无录入的岗位</p>
      </div>
      <div v-for="(job, i) in jobs" :key="job.id" class="list-item">
        <div class="item-header">
          <strong>{{ job.position || "未命名" }}</strong>
          <van-tag v-if="job.company" plain size="small">{{ job.company }}</van-tag>
        </div>
        <div v-if="job.salary" class="item-salary">{{ job.salary }}</div>
        <div class="item-meta">{{ formatDate(job.createdAt) }}</div>
        <div class="item-actions">
          <van-button size="mini" type="primary" plain @click="goAnalyze(job)">分析</van-button>
          <van-button size="mini" plain type="danger" @click="deleteJob(i)">删除</van-button>
        </div>
      </div>
    </div>

  </div>
</template>

<script setup>
import { ref, onMounted } from "vue"
import { showToast } from "vant"
import { useRouter } from "vue-router"
import db from "@/db"
import { extractJobInfo, hasAiAccess } from "@/api/deepseek"
import { logAction } from "@/utils/actionLog"

const router = useRouter()
const form = ref({ company: "", position: "", salary: "", city: "", jd: "" })
const jobs = ref([])
const saving = ref(false)
const parsing = ref(false)

onMounted(async () => {
  await loadJobs()
})

async function loadJobs() {
  try {
    const arr = await db.collectedJobs.toArray()
    arr.reverse()
    jobs.value = arr.map(function (item) {
      let data = (typeof item.parsedJson === "string") ? JSON.parse(item.parsedJson) : (item.parsedJson || {})
      return { id: item.id, company: data.company || "", position: data.position || "", salary: data.salary || "", city: data.city || "", jd: data.jd || "", createdAt: item.createdAt }
    })
  } catch (e) {
    console.warn("load error", e)
  }
}

async function saveJob() {
  if (!form.value.position.trim()) { showToast("请填写岗位名称"); return }
  saving.value = true
  try {
    const jobData = { source: "manual", company: form.value.company, position: form.value.position, salary: form.value.salary, city: form.value.city, jd: form.value.jd }
    await db.collectedJobs.add({ sourceId: "m_" + Date.now(), parsedJson: JSON.stringify(jobData), createdAt: new Date().toISOString() })
    showToast("已保存")
    logAction("jobCollector.save", { status: "success", payload: { position: form.value.position, hasJd: !!form.value.jd } })
    form.value = { company: "", position: "", salary: "", city: "", jd: "" }
    await loadJobs()
  } catch (e) { showToast("保存失败：" + e.message)
    logAction("jobCollector.save", { status: "failed", error: e })
  } finally { saving.value = false }
}

async function parseWithAI() {
  if (!form.value.jd.trim()) { showToast("请先粘贴JD文本"); return }
  parsing.value = true
  try {
    if (!hasAiAccess()) {
      showToast("请先配置 API Key")
      logAction("jobCollector.aiParse", { status: "failed", payload: { reason: "missing_api_key" } })
      return
    }
    logAction("jobCollector.aiParse", { status: "started", payload: { jdLength: form.value.jd.length } })
    const info = await extractJobInfo(form.value.jd)
    Object.assign(form.value, {
      company: info.company || form.value.company,
      position: info.position || form.value.position,
      salary: info.salary || form.value.salary,
      city: info.city || form.value.city
    })
    showToast("AI 提取完成")
    logAction("jobCollector.aiParse", { status: "success", payload: info })
  } catch (e) {
    showToast("解析失败：" + e.message)
    logAction("jobCollector.aiParse", { status: "failed", error: e })
  } finally { parsing.value = false }
}

function goAnalyze(job) {
  router.push({ path: "/analyze", query: { jd: job.jd || "" } })
}

async function deleteJob(index) {
  const item = jobs.value[index]
  if (!item) return
  await db.collectedJobs.delete(item.id)
  jobs.value.splice(index, 1)
  showToast("已删除")
  logAction("jobCollector.delete", { status: "success", payload: { index } })
}

function formatDate(d) {
  return d ? new Date(d).toLocaleString("zh-CN") : ""
}
</script>

<style scoped>
.job-collector { padding-bottom: 20px; }
.list-item { padding: 10px 0; border-bottom: 1px solid #f5f5f5; }
.item-salary { font-size: 15px; font-weight: 600; color: #e53935; }
.item-meta { font-size: 12px; color: #999; margin-bottom: 6px; }
</style>