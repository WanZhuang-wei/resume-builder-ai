<template>
  <div class="doc-upload">
    <ApiKeyDialog v-model="showApiDialog" @saved="onApiKeySaved" />
    <div class="section-card">
      <div class="section-title">1. 上传文档</div>
      <div
        class="upload-zone"
        :class="{ 'drag-over': dragOver }"
        @dragover.prevent="dragOver = true"
        @dragleave="dragOver = false"
        @drop.prevent="handleDrop"
        @click="triggerFileInput"
      >
        <van-icon name="plus" class="upload-icon" />
        <p class="upload-text">{{ uploading ? '处理中...' : '点击或拖拽文件到此处' }}</p>
        <p class="upload-hint">支持 .pdf .docx .txt 格式，单个文件不超过 10MB</p>
        <input ref="fileInput" type="file" accept=".pdf,.docx,.txt" style="display:none" @change="handleFileChange" />
      </div>
    </div>

    <div v-if="extracting" class="section-card">
      <div class="section-title">2. AI 智能解析</div>
      <div class="progress-status">
        <van-loading type="spinner" size="20" />
        <span>{{ extractStatus }}</span>
      </div>
    </div>

    <div v-if="extractedData && !extracting" class="section-card">
      <div class="section-title">3. 提取结果预览</div>
      <div class="result-summary">
        <van-tag plain :color="extractedData.basicInfo?.name ? '#07c160' : '#999'">
          {{ extractedData.basicInfo?.name ? '姓名: ' + extractedData.basicInfo.name : '未识别姓名' }}
        </van-tag>
        <van-tag v-if="extractedData.workExperiences?.length" plain color="#1989fa">
          工作经历 {{ extractedData.workExperiences.length }} 条
        </van-tag>
        <van-tag v-if="extractedData.education?.length" plain color="#1989fa">
          教育背景 {{ extractedData.education.length }} 条
        </van-tag>
        <van-tag v-if="extractedData.projects?.length" plain color="#1989fa">
          项目经验 {{ extractedData.projects.length }} 条
        </van-tag>
        <van-tag v-if="extractedData.skills?.length" plain color="#1989fa">
          技能 {{ extractedData.skills.length }} 项
        </van-tag>
        <van-tag v-if="extractedData.certificates?.length" plain color="#1989fa">
          证书 {{ extractedData.certificates.length }} 项
        </van-tag>
      </div>

      <div v-if="extractedData.basicInfo?.name" class="preview-section">
        <div class="preview-title">基本信息</div>
        <div class="preview-grid">
          <span>姓名：{{ extractedData.basicInfo.name || '-' }}</span>
          <span>电话：{{ extractedData.basicInfo.phone || '-' }}</span>
          <span>邮箱：{{ extractedData.basicInfo.email || '-' }}</span>
          <span>意向：{{ extractedData.basicInfo.title || '-' }}</span>
        </div>
      </div>

      <div v-if="extractedData.workExperiences?.length" class="preview-section">
        <div class="preview-title">
          工作经历
          <van-tag v-if="internshipCount" plain size="small" color="#ff976a" style="margin-left:6px">{{ internshipCount }} 条实习</van-tag>
        </div>
        <div v-for="(exp, i) in extractedData.workExperiences.slice(0, 3)" :key="i" class="preview-item">
          <strong>{{ exp.company || '未知公司' }}</strong> &mdash; {{ exp.position || '' }}
          <van-tag v-if="exp.type === 'internship'" plain size="small" color="#ff976a" style="margin-left:4px">实习</van-tag>
          <div class="preview-desc">{{ exp.description?.slice(0, 100) }}{{ exp.description?.length > 100 ? '...' : '' }}</div>
        </div>
        <div v-if="extractedData.workExperiences.length > 3" class="preview-more">...还有 {{ extractedData.workExperiences.length - 3 }} 条</div>
      </div>

      <div v-if="extractedData.knowledgeExtra" class="preview-section">
        <div class="preview-title">文档补充信息（将存入知识库）</div>
        <div class="preview-desc">{{ extractedData.knowledgeExtra.slice(0, 200) }}{{ extractedData.knowledgeExtra.length > 200 ? '...' : '' }}</div>
      </div>

      <div class="action-buttons">
        <van-button round type="primary" size="small" @click="applyToProfile" :loading="applying">
          自动填入个人资料
        </van-button>
        <van-button round plain type="default" size="small" @click="resetAll">
          重新上传
        </van-button>
      </div>
    </div>
    <div v-if="knowledgeStore.items.length > 0" class="section-card">
      <div class="section-title">
        <van-icon name="bars" style="margin-right:6px;color:#1989fa" />
        知识库缓存（{{ knowledgeStore.items.length }} 份文档）
        <span style="font-size:12px;color:#999;font-weight:400;margin-left:6px">提取结果已保存，无需重复上传</span>
      </div>
      <div v-for="item in knowledgeStore.items" :key="item.id" class="kb-item">
        <div class="kb-header" @click="toggleExpand(item.id)">
          <van-icon :name="expandedId === item.id ? 'chevron-down' : 'chevron-right'" style="color:#999" />
          <div class="kb-info">
            <strong>{{ item.title }}</strong>
            <div class="kb-meta">
              <van-tag plain size="mini" color="#999">{{ item.fileType?.toUpperCase() || '文档' }}</van-tag>
              <span style="margin-left:8px;color:#999;font-size:11px">{{ new Date(item.createdAt).toLocaleDateString('zh-CN') }}</span>
            </div>
          </div>
          <van-tag v-if="item.extractedData?.basicInfo?.name" plain size="small" color="#07c160" style="margin-right:4px">已缓存</van-tag>
        </div>
        <div v-if="expandedId === item.id" class="kb-detail">
          <div v-if="item.extractedData" class="kb-extract-badges">
            <van-tag v-if="item.extractedData.basicInfo?.name" plain size="mini" color="#07c160">{{ item.extractedData.basicInfo.name }}</van-tag>
            <van-tag v-if="item.extractedData.workExperiences?.length" plain size="mini" color="#1989fa">{{ item.extractedData.workExperiences.length }} 段工作</van-tag>
            <van-tag v-if="item.extractedData.education?.length" plain size="mini" color="#1989fa">{{ item.extractedData.education.length }} 段教育</van-tag>
            <van-tag v-if="item.extractedData.projects?.length" plain size="mini" color="#1989fa">{{ item.extractedData.projects.length }} 个项目</van-tag>
            <van-tag v-if="item.extractedData.skills?.length" plain size="mini" color="#1989fa">{{ item.extractedData.skills.length }} 项技能</van-tag>
            <van-tag v-if="!item.extractedData.basicInfo?.name" plain size="mini" color="#999">无缓存提取数据</van-tag>
          </div>
          <div v-if="item.aiSummary" class="kb-summary">{{ item.aiSummary.slice(0, 200) }}</div>
          <div class="kb-actions">
            <van-button v-if="item.extractedData" size="mini" plain type="primary" :loading="reapplyingId === item.id" @click="reapplyFromCache(item.id)">重新填入资料</van-button>
            <van-button size="mini" plain type="danger" @click="deleteKnowledge(item.id)">删除</van-button>
          </div>
        </div>
      </div>
    </div>
    <div v-if="!extractedData && !extracting && knowledgeStore.items.length === 0 && !uploading" class="empty-state">
      <van-icon name="file-o" />
      <p>上传简历、毕业设计或项目文档</p>
      <p style="font-size:13px;color:#999">AI 将自动提取信息并填入个人资料，已提取的数据会缓存到知识库</p>
    </div>
  </div>
</template>

<script setup>

import { ref, computed, onMounted } from 'vue'
import { showToast, showConfirmDialog, showSuccessToast } from 'vant'
import { getApiKey } from '@/api/deepseek'
import { extractResumeData, hasExtractedData, sanitizeExtractedData } from '@/api/extract'
import { parseDocument, checkFileSize } from '@/utils/parser'
import { useKnowledgeStore } from '@/stores/knowledge'
import { useProfileStore } from '@/stores/profile'
import ApiKeyDialog from '@/components/ApiKeyDialog.vue'
import { logAction } from '@/utils/actionLog'

const knowledgeStore = useKnowledgeStore()
const profileStore = useProfileStore()
const dragOver = ref(false)
const uploading = ref(false)
const extracting = ref(false)
const applying = ref(false)
const reapplyingId = ref(null)
const showApiDialog = ref(false)
const pendingFile = ref(null)
const extractStatus = ref('')
const extractedData = ref(null)
const currentFileName = ref('')
const fileInput = ref(null)
const expandedId = ref(null)

const internshipCount = computed(() => {
  return extractedData.value?.workExperiences?.filter(e => e.type === 'internship').length || 0
})

onMounted(() => {
  if (!knowledgeStore.loaded) knowledgeStore.loadAll()
  if (!profileStore.loaded) profileStore.loadAll()
})

function toggleExpand(id) {
  expandedId.value = expandedId.value === id ? null : id
}
function triggerFileInput() {
  if (!extracting.value) fileInput.value?.click()
}
function handleDrop(e) {
  dragOver.value = false
  const file = e.dataTransfer.files[0]
  if (file) processFile(file)
}
function handleFileChange(e) {
  const file = e.target.files[0]
  if (file) processFile(file)
  e.target.value = ''
}

async function processFile(file) {
  if (!getApiKey()) { pendingFile.value = file; showApiDialog.value = true; return }
  try {
    checkFileSize(file)
    currentFileName.value = file.name
    uploading.value = true; extracting.value = true
    extractStatus.value = '正在解析文件...'
    const { text, fileType } = await parseDocument(file)
    extractStatus.value = '已提取 ' + text.length + ' 字符，正在 AI 分析...'
    const rawData = await extractResumeData(text, (s) => { extractStatus.value = s })
    extractedData.value = sanitizeExtractedData(rawData)
    if (hasExtractedData(extractedData.value)) {
      // 深拷贝去掉 Vue Proxy 响应式包装，否则 IndexedDB 无法存储
      const plainData = JSON.parse(JSON.stringify(extractedData.value))
      await knowledgeStore.addItem({
        title: file.name.replace(/\.[^.]+$/, ''),
        sourceType: 'upload', fileType,
        originalText: text.slice(0, 5000),
        aiSummary: plainData?.knowledgeExtra || text.slice(0, 500),
        extractedData: plainData,
        tags: extractTags(plainData)
      })
    }
    showSuccessToast('信息提取完成')
    logAction('documentUpload.processFile', { status: 'success', payload: { fileName: currentFileName.value, hasData: hasExtractedData(extractedData.value) } })
  } catch (e) {
    console.error('[DocumentUpload] Error:', e)
    logAction('documentUpload.processFile', { status: 'failed', payload: { fileName: currentFileName.value }, error: e })
    const msg = e.message || ''
    // 分区定位错误来源
    if (msg.includes('API Key') || msg.includes('api_key')) {
      showToast({ message: '请先配置 API Key', type: 'fail' })
    } else if (msg.includes('文件过大') || msg.includes('10MB')) {
      showToast({ message: '文件过大，请上传小于 10MB 的文件', type: 'fail' })
    } else if (msg.includes('不支持')) {
      showToast({ message: msg, type: 'fail' })
    } else if (msg.includes('提取文字') || msg.includes('内容过少')) {
      showToast({ message: '文件内容过少或无法提取文字', type: 'fail' })
    } else if (msg.includes('Authentication') || msg.includes('invalid') || msg.includes('api key')) {
      showToast({ message: 'API Key 无效或已过期，请到设置页重新配置', type: 'fail' })
      logAction('documentUpload.invalidApiKey', { status: 'failed', error: e })
    } else if (msg.includes('AI') || msg.includes('DeepSeek') || msg.includes('API') || msg.includes('HTTP') || msg.includes('fetch')) {
      showToast({ message: 'AI 分析失败: ' + msg.slice(0, 80), type: 'fail' })
    } else if (msg.includes('mammoth') || msg.includes('import') || msg.includes('动态导入')) {
      showToast({ message: '文档解析模块加载失败: ' + msg.slice(0, 80), type: 'fail' })
    } else if (msg.includes('parse') || msg.includes('reader') || msg.includes('FileReader')) {
      showToast({ message: '文件读取失败: ' + msg.slice(0, 80), type: 'fail' })
    } else if (msg.includes('json') || msg.includes('JSON') || msg.includes('parse')) {
      showToast({ message: '数据解析异常，请重试', type: 'fail' })
    } else {
      showToast({ message: '处理失败: ' + msg.slice(0, 100), type: 'fail' })
    }
    extractedData.value = null
  } finally { uploading.value = false; extracting.value = false }
}

function extractTags(data) {
  const tags = []
  if (data?.basicInfo?.name) tags.push(data.basicInfo.name)
  if (data?.basicInfo?.title) tags.push(data.basicInfo.title)
  if (data?.skills) tags.push(...data.skills.map(s => s.name).slice(0, 10))
  if (data?.education?.length) tags.push(data.education[0].school)
  return [...new Set(tags.filter(Boolean))]
}

async function applyToProfile() {
  if (!extractedData.value) return
  if (!profileStore.loaded) await profileStore.loadAll()
  applying.value = true
  let successCount = 0, failCount = 0
  const data = extractedData.value
  try {
    try {
      if (data.basicInfo?.name) {
        const existing = profileStore.basicInfo || {}
        const cleanInfo = {}
        for (const key of ['name','phone','wechat','email','title','summary','targetPosition']) {
          if (data.basicInfo[key] != null && data.basicInfo[key] !== '') cleanInfo[key] = data.basicInfo[key]
        }
        if (cleanInfo.name) { await profileStore.saveBasicInfo({ ...existing, ...cleanInfo }); successCount++ }
      }
    } catch (e) { console.warn(e); failCount++ }
    try {
      if (data.workExperiences?.length) {
        for (const exp of data.workExperiences) {
          if (exp.company) await profileStore.addWorkExperience({
            company: exp.company, position: exp.position || '', startDate: exp.startDate || '',
            endDate: exp.endDate || '', description: exp.description || '',
            achievements: exp.achievements || '', tags: exp.tags || [], type: exp.type || 'fulltime'
          })
        }
        successCount++
      }
    } catch (e) { console.warn(e); failCount++ }
    try {
      if (data.education?.length) {
        for (const edu of data.education) {
          if (edu.school) await profileStore.addEducation({
            school: edu.school, major: edu.major || '', degree: edu.degree || '',
            startDate: edu.startDate || '', endDate: edu.endDate || '', gpa: edu.gpa || ''
          })
        }
        successCount++
      }
    } catch (e) { console.warn(e); failCount++ }
    try {
      if (data.projects?.length) {
        for (const proj of data.projects) {
          if (proj.name) await profileStore.addProject({
            name: proj.name, role: proj.role || '', techStack: proj.techStack || '',
            description: proj.description || '', highlights: proj.highlights || '', link: proj.link || ''
          })
        }
        successCount++
      }
    } catch (e) { console.warn(e); failCount++ }
    try {
      if (data.skills?.length) {
        for (const skill of data.skills) {
          if (skill.name) await profileStore.addSkill({ name: skill.name, category: skill.category || '其他', proficiency: 3 })
        }
        successCount++
      }
    } catch (e) { console.warn(e); failCount++ }
    try {
      if (data.certificates?.length) {
        for (const cert of data.certificates) {
          if (cert.name) await profileStore.addCertificate({ name: cert.name, issuer: cert.issuer || '', date: cert.date || '' })
        }
        successCount++
      }
    } catch (e) { console.warn(e); failCount++ }
    await profileStore.loadAll()
    if (failCount === 0) { showSuccessToast('已成功填入个人资料') }
    else { showToast({ message: '填入完成，' + successCount + ' 项成功，' + failCount + ' 项失败', type: 'warning' }) }
    logAction('documentUpload.applyToProfile', { status: failCount === 0 ? 'success' : 'partial', payload: { successCount, failCount } })
  } catch (e) {
    showToast({ message: '写入失败: ' + e.message, type: 'fail' })
    logAction('documentUpload.applyToProfile', { status: 'failed', error: e })
  } finally { applying.value = false }
}

async function reapplyFromCache(id) {
  reapplyingId.value = id
  try {
    if (!profileStore.loaded) await profileStore.loadAll()
    const result = await knowledgeStore.reapplyToProfile(id, profileStore)
    if (result.failCount === 0) { showSuccessToast('已从缓存重新填入') }
    else { showToast({ message: '重新填入完成，' + result.successCount + ' 项成功，' + result.failCount + ' 项失败', type: 'warning' }) }
    logAction('documentUpload.reapply', { status: result.failCount === 0 ? 'success' : 'partial', payload: { successCount: result.successCount, failCount: result.failCount } })
  } catch (e) {
    showToast({ message: '重新填入失败: ' + e.message, type: 'fail' })
    logAction('documentUpload.reapply', { status: 'failed', error: e })
  } finally { reapplyingId.value = null }
}

async function deleteKnowledge(id) {
  await knowledgeStore.deleteItem(id)
  if (expandedId.value === id) expandedId.value = null
  showToast('已删除')
  logAction('documentUpload.deleteKnowledge', { status: 'success', payload: { id } })
}

function resetAll() { extractedData.value = null; currentFileName.value = '' }
function onApiKeySaved() { const file = pendingFile.value; if (file) { pendingFile.value = null; processFile(file) } }

</script>

<style scoped>
.doc-upload { padding-bottom: 20px; }
.upload-zone {
  border: 3px dashed #c8d9e8; border-radius: 16px; padding: 60px 20px;
  text-align: center; cursor: pointer; transition: all 0.2s; background: #f7faff;
  margin: 8px 0;
}
.upload-zone:hover, .upload-zone.drag-over {
  border-color: #1989fa; background: #e8f4ff;
}
.upload-icon { font-size: 56px; color: #b0c4de; margin-bottom: 16px; }
.upload-zone.drag-over .upload-icon { color: #1989fa; }
.upload-text { font-size: 16px; color: #333; margin-bottom: 10px; }
.upload-hint { font-size: 13px; color: #999; }
.progress-status { display: flex; align-items: center; gap: 12px; padding: 12px 0; color: #666; font-size: 14px; }
.result-summary { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 16px; }
.preview-section { margin-top: 14px; padding-top: 14px; border-top: 1px solid #f0f0f0; }
.preview-title { font-size: 13px; font-weight: 600; color: #333; margin-bottom: 8px; }
.preview-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; font-size: 13px; color: #666; }
.preview-item { font-size: 13px; color: #666; padding: 6px 0; border-bottom: 1px solid #f5f5f5; }
.preview-desc { font-size: 12px; color: #999; margin-top: 2px; line-height: 1.4; }
.preview-more { font-size: 12px; color: #999; text-align: center; padding: 6px; }
.kb-item { border-bottom: 1px solid #f5f5f5; }
.kb-item:last-child { border-bottom: none; }
.kb-header { display: flex; align-items: center; gap: 8px; padding: 10px 0; cursor: pointer; }
.kb-info { flex: 1; }
.kb-info strong { font-size: 14px; }
.kb-meta { margin-top: 2px; }
.kb-detail { padding: 0 0 10px 24px; }
.kb-extract-badges { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 8px; }
.kb-summary { font-size: 12px; color: #888; line-height: 1.5; margin-bottom: 8px; padding: 6px 8px; background: #f9f9f9; border-radius: 4px; }
.kb-actions { display: flex; gap: 8px; }
</style>
