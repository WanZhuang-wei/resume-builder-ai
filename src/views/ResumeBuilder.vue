<template>
  <div class="resume-builder">
    <ApiKeyDialog v-model="showApiDialog" @saved="onApiKeySaved" />

    <div class="section-card">
      <div class="section-title">目标设定</div>
      <van-form @submit="startGenerate">
        <van-field v-model="targetPosition" label="目标岗位" placeholder="如：前端工程师" :rules="[{ required: true, message: '请填写目标岗位' }]" />
        <van-field v-model="targetCompany" label="目标公司" placeholder="可选，填写后简历将包含公司名称" />
        <van-field v-model="jobDescription" label="岗位描述(JD)" type="textarea" rows="4" placeholder="可选，粘贴 JD 文本让 AI 定制化生成简历" />
        <van-button round block type="primary" native-type="submit" :loading="resumeStore.generating" loading-text="AI 生成中..." size="small">
          {{ resumeStore.generating ? '生成中...' : 'AI 生成简历' }}
        </van-button>
      </van-form>
    </div>

    <!-- 简历模板上传 -->
    <div class="section-card" style="border-left:3px solid #4a90d9">
      <div class="section-title">
        简历模板
        <van-tag v-if="templateFileName" type="success" size="small" style="margin-left:6px">已上传</van-tag>
        <van-tag v-else plain size="small" style="margin-left:6px">可选</van-tag>
      </div>
      <div style="font-size:13px;color:#666;line-height:1.6;padding:4px 0">
        上传你的 .docx 格式简历模板，AI 将按照模板的结构和格式填写内容。
        {{ templateFileName ? '当前模板：' + templateFileName : '' }}
      </div>
      <div style="display:flex;gap:8px;margin-top:8px">
        <van-uploader :after-read="handleTemplateUpload" accept=".docx">
          <van-button icon="upgrade" size="small" round>{{ templateFileName ? '更换模板' : '上传模板' }}</van-button>
        </van-uploader>
        <van-button v-if="templateText" plain type="danger" icon="delete" size="small" round @click="clearTemplate">清除</van-button>
      </div>
    </div>

    <div v-if="!hasAiAccess()" class="section-card">
      <div class="api-missing-hint" @click="showApiDialog = true">
        <van-icon name="info-o" style="color:#ff976a;font-size:16px" />
        <span style="font-size:13px;color:#944">未配置 API Key，点击此处设置</span>
      </div>
    </div>

    <van-dialog v-model:show="showJdDialog" title="自定义岗位描述" message="未填写岗位描述(JD)，是否直接根据岗位名称生成通用简历？" show-cancel-button cancel-button-text="填写 JD" confirm-button-text="直接生成" @confirm="confirmGenerateWithoutJd" @cancel="showJdDialog = false" />

    <div v-if="resumeStore.currentContent" class="section-card">
      <div class="section-title">简历预览</div>
      <div class="resume-preview" ref="previewRef">
        <ResumeTemplate :content="resumeStore.currentContent" />
      </div>
      <div class="action-buttons">
        <van-button round type="primary" size="small" icon="down" @click="exportPdf">导出 PDF</van-button>
        <van-button round plain type="primary" size="small" icon="edit" @click="exportWord">导出 Word</van-button>
        <van-button round plain type="primary" size="small" @click="saveResume">保存</van-button>
      </div>
    </div>

    <div class="section-card">
      <div class="section-title">已保存的简历</div>
      <div v-if="resumeStore.savedResumes.length === 0" class="empty-state"><p>暂无保存的简历</p></div>
      <div v-for="res in resumeStore.savedResumes" :key="res.id" class="list-item">
        <div class="item-header">
          <strong>{{ res.targetCompany || '通用' }}</strong>
          <van-tag plain type="primary">{{ res.targetPosition }}</van-tag>
        </div>
        <div class="item-time">{{ formatDate(res.createdAt) }}</div>
        <div class="action-buttons">
          <van-button size="mini" plain type="primary" @click="loadSavedResume(res)">查看</van-button>
          <van-button size="mini" plain type="danger" @click="deleteResume(res.id)">删除</van-button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, nextTick } from 'vue'
import { showToast } from 'vant'
import { useResumeStore } from '@/stores/resume'
import { useProfileStore } from '@/stores/profile'
import { hasAiAccess } from '@/api/deepseek'
import { exportPDF } from '@/utils/export'
import ResumeTemplate from '@/components/ResumeTemplate.vue'
import ApiKeyDialog from '@/components/ApiKeyDialog.vue'
import { exportDocx } from '@/utils/exportDocx'
import { logAction } from '@/utils/actionLog'
import * as mammoth from 'mammoth'

const resumeStore = useResumeStore()
const profileStore = useProfileStore()
const targetCompany = ref('')
const targetPosition = ref('')
const jobDescription = ref('')
const previewRef = ref(null)
const showApiDialog = ref(false)
const pendingAction = ref(false)
const showJdDialog = ref(false)
const templateFile = ref(null)
const templateText = ref('')
const templateFileName = ref('')

onMounted(() => {
  if (!profileStore.loaded) profileStore.loadAll()
  resumeStore.loadSaved()
})

async function startGenerate() {
  if (!hasAiAccess()) {
    pendingAction.value = true
    showApiDialog.value = true
    return
  }

  if (!targetPosition.value.trim()) {
    showToast('请填写目标岗位')
    return
  }

  // If JD is empty, ask user first
  if (!jobDescription.value.trim()) {
    showJdDialog.value = true
    return
  }

  await doGenerate()
}

async function doGenerate() {
  if (!profileStore.loaded) await profileStore.loadAll()
  try {
    await resumeStore.generate(
      profileStore.summaryData,
      targetCompany.value || '',
      targetPosition.value,
      jobDescription.value.trim() || undefined,
      templateText.value || undefined
    )
    showToast('简历已生成')
  } catch (e) {
    showToast('生成失败：' + e.message)
    logAction('resume.view.generate', { status: 'failed', payload: { targetPosition: targetPosition.value }, error: e })
  }
}

async function confirmGenerateWithoutJd() {
  showJdDialog.value = false
  await doGenerate()
}

function onApiKeySaved() {
  if (pendingAction.value) {
    pendingAction.value = false
    startGenerate()
  }
}

async function exportPdf() {
  if (!previewRef.value) return
  try {
    const name = (targetCompany.value || targetPosition.value || '通用') + '_简历.pdf'
    await exportPDF(previewRef.value, name)
    showToast('导出成功')
  } catch (e) {
    showToast('导出失败：' + e.message)
    logAction('resume.view.exportPdf', { status: 'failed', error: e })
  }
}

async function saveResume() {
  if (!targetPosition.value) return showToast('请先填写目标岗位')
  await resumeStore.saveCurrent(targetCompany.value || '', targetPosition.value, jobDescription.value.trim() || '')
  showToast('已保存')
}

function loadSavedResume(res) {
  resumeStore.setContent(res.content)
  targetCompany.value = res.targetCompany || ''
  targetPosition.value = res.targetPosition
  jobDescription.value = res.jobDescription || ''
}

async function handleTemplateUpload(file) {
  templateFile.value = file
  templateFileName.value = file.file.name
  try {
    const arrayBuffer = await file.file.arrayBuffer()
    const result = await mammoth.extractRawText({ arrayBuffer })
    templateText.value = result.value
  } catch (e) {
    showToast('模板解析失败：' + e.message)
    logAction('resume.view.parseTemplate', { status: 'failed', payload: { fileName: templateFileName.value }, error: e })
    templateText.value = ''
  }
}

function clearTemplate() {
  templateFile.value = null
  templateText.value = ''
  templateFileName.value = ''
}

async function exportWord() {
  if (!resumeStore.currentContent) {
    showToast('请先生成简历')
    return
  }
  try {
    const name = (targetCompany.value || targetPosition.value || '通用') + '_简历.docx'
    await exportDocx(resumeStore.currentContent, name)
    showToast('Word 导出成功')
  } catch (e) {
    showToast('导出失败：' + e.message)
    logAction('resume.view.exportWord', { status: 'failed', error: e })
  }
}

async function deleteResume(id) {
  await resumeStore.deleteResume(id)
  showToast('已删除')
}

function formatDate(dateStr) {
  if (!dateStr) return ''
  return new Date(dateStr).toLocaleDateString('zh-CN')
}
</script>

<style scoped>
.resume-builder { padding-bottom: 20px; }
.resume-preview { background: #fff; padding: 16px; border-radius: 8px; border: 1px solid #eee; margin-bottom: 12px; min-height: 200px; }
.list-item { padding: 10px 0; border-bottom: 1px solid #f5f5f5; }
.list-item:last-child { border-bottom: none; }
.item-header { display: flex; align-items: center; gap: 8px; margin-bottom: 4px; }
.item-time { font-size: 12px; color: #999; }
.api-missing-hint { display: flex; align-items: center; gap: 8px; cursor: pointer; padding: 4px 0; }
.api-missing-hint:active { opacity: 0.7; }
</style>
