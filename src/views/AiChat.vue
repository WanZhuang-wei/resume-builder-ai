<template>
  <div class="ai-chat">
    <ApiKeyDialog v-model="showApiDialog" @saved="onApiKeySaved" />

    <div class="chat-toolbar">
      <div class="toolbar-left">
        <van-button v-if="hasMoreHistory" plain size="mini" :loading="loadingHistory" @click="loadMoreHistory" icon="more-o">加载更早</van-button>
      </div>
      <div class="toolbar-right">
        <van-button plain size="mini" @click="exportChat" icon="share-o">导出</van-button>
        <van-button plain size="mini" @click="showResumeDialog = true" icon="edit">生成简历</van-button>
        <van-button plain size="mini" type="danger" @click="showClearConfirm = true" icon="delete-o">清空</van-button>
      </div>
    </div>

    <div class="chat-messages" ref="messagesRef">
      <div v-if="messages.length === 0" class="empty-state">
        <van-icon name="chat-o" />
        <p>你好！我是你的简历求职助手</p>
        <p style="font-size:13px;color:#999">你可以问我关于个人资料、求职建议等问题</p>
      </div>
      <div v-for="(msg, i) in messages" :key="i" :class="['message', msg.role]">
        <div class="msg-wrapper">
          <div class="msg-content" v-html="renderMarkdown(msg.content)"></div>
          <div v-if="msg._meta?.type === 'resume'" class="msg-save">
            <van-button size="mini" type="primary" plain @click="saveResumeFromChat(msg._meta)">保存为简历</van-button>
          </div>
          <van-icon v-if="msg.role !== 'system'" name="cross" size="12" class="msg-delete" @click="deleteSingleMessage(i)" />
        </div>
      </div>
      <div v-if="loading" class="message assistant">
        <div class="msg-content thinking">
          <van-loading type="ball" size="14" /> 思考中...
        </div>
      </div>
    </div>

    <van-dialog v-model:show="showResumeDialog" title="AI 生成简历" show-cancel-button confirm-button-text="生成" @confirm="handleResumeGenerate">
      <van-form ref="resumeFormRef" style="padding:16px">
        <van-field v-model="resumeTarget" label="目标岗位" placeholder="如：前端工程师" :rules="[{ required: true, message: '请填写目标岗位' }]" />
        <van-field v-model="resumeCompany" label="目标公司" placeholder="可选" />
        <van-field v-model="resumeJd" label="岗位描述(JD)" type="textarea" rows="3" placeholder="可选，粘贴 JD 让 AI 定制化生成" />
      </van-form>
    </van-dialog>

    <van-dialog v-model:show="showClearConfirm" title="清空对话记录" message="确定要删除所有对话记录吗？此操作不可恢复。" show-cancel-button @confirm="clearAllHistory" />

    <div class="chat-input">
      <van-field v-model="inputText" :disabled="loading" placeholder="输入你的问题..." @keypress.enter="sendMessage" :border="false" />
      <van-button :loading="loading" icon="send-o" round size="small" type="primary" @click="sendMessage" />
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, nextTick } from 'vue'
import { showToast } from 'vant'
import { useProfileStore } from '@/stores/profile'
import { chat, buildChatSystemPrompt, getApiKey, generateResume } from '@/api/deepseek'
import ApiKeyDialog from '@/components/ApiKeyDialog.vue'
import { buildJobsSystemPrompt } from '@/utils/jobMatcher'
import { useJobsStore } from '@/stores/jobs'
import { useResumeStore } from '@/stores/resume'
import db from '@/db/index'

const profileStore = useProfileStore()
const jobsStore = useJobsStore()
const resumeStore = useResumeStore()
const messages = ref([])
const inputText = ref('')
const loading = ref(false)
const messagesRef = ref(null)
const showApiDialog = ref(false)
const pendingMessage = ref('')
const hasMoreHistory = ref(false)
const loadingHistory = ref(false)
const showClearConfirm = ref(false)
const showResumeDialog = ref(false)
const resumeTarget = ref('')
const resumeCompany = ref('')
const resumeJd = ref('')
const pendingResumeGeneration = ref(null)

onMounted(async () => {
  if (!profileStore.loaded) profileStore.loadAll()
  if (!jobsStore.initialized) jobsStore.initJobData()

  try {
    const history = await db.chatHistory
      .orderBy('timestamp')
      .reverse()
      .limit(50)
      .toArray()
    if (history.length > 0) {
      messages.value = history.reverse().map(h => ({
        role: h.role,
        content: h.content
      }))
      hasMoreHistory.value = history.length >= 50
    }
  } catch (e) {
    console.warn('加载聊天历史失败', e)
  }

  if (messages.value.length === 0) {
    messages.value.push({
      role: 'assistant',
      content: '你好！我是你的简历求职助手。我可以帮你：\n\n1. 查询你的个人资料信息\n2. 提供求职策略建议\n3. 分析岗位匹配度\n4. 推荐适合你的岗位\n\n请问有什么可以帮你的？'
    })
  }

  await scrollToBottom()
})

async function saveMessage(role, content) {
  try {
    await db.chatHistory.add({
      role,
      content,
      timestamp: new Date().toISOString()
    })
  } catch (e) {
    console.warn('保存消息失败', e)
  }
}

async function scrollToBottom() {
  await nextTick()
  if (messagesRef.value) {
    messagesRef.value.scrollTop = messagesRef.value.scrollHeight
  }
}

async function sendMessage() {
  const text = inputText.value.trim()
  if (!text || loading.value) return

  if (pendingResumeGeneration.value) {
    const pending = pendingResumeGeneration.value
    if (text.includes('直接生成') || text.includes('不用')) {
      pendingResumeGeneration.value = null
      await executeResumeGeneration(pending.target, pending.company, '')
      return
    } else {
      pendingResumeGeneration.value = null
      await executeResumeGeneration(pending.target, pending.company, text)
      return
    }
  }

  if (!getApiKey()) {
    pendingMessage.value = text
    inputText.value = ''
    showApiDialog.value = true
    return
  }

  inputText.value = ''

  await saveMessage('user', text)
  messages.value.push({ role: 'user', content: text })
  await scrollToBottom()

  loading.value = true
  try {
    const context = profileStore.summaryData
    let systemPrompt = buildChatSystemPrompt(context)
    if (jobsStore.initialized) {
      const jobCtx = jobsStore.getJobsContext(5)
      if (jobCtx.length > 0) systemPrompt += buildJobsSystemPrompt(jobCtx)
    }
    const chatMessages = [
      { role: 'system', content: systemPrompt },
      ...messages.value.slice(-10).map(m => ({ role: m.role, content: m.content }))
    ]
    const response = await chat(chatMessages, { maxTokens: 1500 })

    await saveMessage('assistant', response)
    messages.value.push({ role: 'assistant', content: response })
  } catch (e) {
    const errMsg = '抱歉，处理时遇到问题：' + e.message
    await saveMessage('assistant', errMsg)
    messages.value.push({ role: 'assistant', content: errMsg })
  } finally {
    loading.value = false
    await scrollToBottom()
  }
}

async function loadMoreHistory() {
  if (loadingHistory.value) return
  loadingHistory.value = true
  try {
    const loaded = messages.value.filter(m => m.role !== 'system').length
    const more = await db.chatHistory
      .orderBy('timestamp')
      .reverse()
      .skip(loaded)
      .limit(30)
      .toArray()
    if (more.length > 0) {
      const newMsgs = more.reverse().map(h => ({
        role: h.role,
        content: h.content
      }))
      messages.value = [...newMsgs, ...messages.value]
    }
    const total = await db.chatHistory.count()
    hasMoreHistory.value = (loaded + more.length) < total
  } catch (e) {
    console.warn('加载更多历史失败', e)
  } finally {
    loadingHistory.value = false
  }
}

async function clearAllHistory() {
  try {
    await db.chatHistory.clear()
    messages.value = []
    hasMoreHistory.value = false
    showToast('历史记录已清空')
  } catch (e) {
    showToast('清空失败：' + e.message)
  }
}

function exportChat() {
  const text = messages.value
    .filter(m => m.role !== 'system')
    .map(m => {
      const label = m.role === 'user' ? '我' : 'AI'
      return '[' + label + ']\n' + m.content
    })
    .join('\n\n---\n\n')
  const blob = new Blob([text], { type: 'text/plain;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = '对话记录_' + new Date().toLocaleDateString('zh-CN') + '.txt'
  a.click()
  URL.revokeObjectURL(url)
  showToast('对话已导出')
}

async function deleteSingleMessage(index) {
  const msg = messages.value[index]
  if (!msg || msg.role === 'system') return
  try {
    const records = await db.chatHistory
      .where({ role: msg.role })
      .filter(r => r.content === msg.content)
      .toArray()
    if (records.length > 0) {
      await db.chatHistory.delete(records[records.length - 1].id)
    }
    messages.value.splice(index, 1)
  } catch (e) {
    console.warn('删除消息失败', e)
  }
}

async function handleResumeGenerate() {
  if (!resumeTarget.value.trim()) {
    showToast('请填写目标岗位')
    return
  }
  showResumeDialog.value = false

  if (!resumeJd.value.trim()) {
    messages.value.push({
      role: 'assistant',
      content: '我将为你生成一份针对 **' + resumeTarget.value + '**' + (resumeCompany.value ? '（' + resumeCompany.value + '）' : '') + ' 的简历。是否需要添加岗位描述(JD)来进行定制？请回复"需要"并提供 JD，或回复"直接生成"。'
    })
    pendingResumeGeneration.value = { target: resumeTarget.value, company: resumeCompany.value, jd: '' }
    resumeTarget.value = ''
    resumeCompany.value = ''
    resumeJd.value = ''
    await scrollToBottom()
    return
  }

  await executeResumeGeneration(resumeTarget.value, resumeCompany.value, resumeJd.value)
  resumeTarget.value = ''
  resumeCompany.value = ''
  resumeJd.value = ''
}

async function executeResumeGeneration(target, company, jd) {
  if (!getApiKey()) {
    pendingMessage.value = '生成简历'
    showApiDialog.value = true
    return
  }

  loading.value = true
  await saveMessage('user', '生成简历：' + target + (company ? ' @ ' + company : '') + (jd ? '\nJD: ' + jd.substring(0, 100) + '...' : ''))

  try {
    const context = profileStore.summaryData
    const resumeContent = await generateResume(context, company, target, jd || undefined)

    const markdownContent = '## 简历生成结果\n\n' + resumeContent + '\n\n---\n*你可以点击下方按钮保存此简历*'

    await saveMessage('assistant', markdownContent)
    messages.value.push({
      role: 'assistant',
      content: markdownContent,
      _meta: { type: 'resume', target, company, jd, content: resumeContent }
    })
  } catch (e) {
    const errMsg = '生成简历失败：' + e.message
    await saveMessage('assistant', errMsg)
    messages.value.push({ role: 'assistant', content: errMsg })
  } finally {
    loading.value = false
    pendingResumeGeneration.value = null
    await scrollToBottom()
  }
}

function renderMarkdown(text) {
  if (!text) return ''
  return text
    .replace(/### (.+)/g, '<h3>$1</h3>')
    .replace(/## (.+)/g, '<h2>$1</h2>')
    .replace(/# (.+)/g, '<h1>$1</h1>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/`(.+?)`/g, '<code>$1</code>')
    .replace(/\n/g, '<br>')
}

async function saveResumeFromChat(meta) {
  try {
    await resumeStore.saveCurrent(meta.company || '', meta.target, meta.content, meta.jd || '')
    showToast('简历已保存')
  } catch (e) {
    showToast('保存失败：' + e.message)
  }
}

function onApiKeySaved() {
  if (pendingMessage.value) {
    inputText.value = pendingMessage.value
    pendingMessage.value = ''
    sendMessage()
  }
}
</script>

<style scoped>
.ai-chat { display: flex; flex-direction: column; height: calc(100vh - 96px); }
.chat-toolbar { display: flex; justify-content: space-between; align-items: center; padding: 6px 16px; background: #f7f8fa; border-bottom: 1px solid #f0f0f0; gap: 8px; }
.toolbar-left, .toolbar-right { display: flex; align-items: center; gap: 6px; }
.chat-messages { flex: 1; overflow-y: auto; padding: 12px 16px; }
.message { margin-bottom: 12px; display: flex; }
.message.user { justify-content: flex-end; }
.msg-wrapper { display: flex; flex-direction: column; align-items: flex-end; gap: 4px; max-width: 80%; }
.message.assistant .msg-wrapper { align-items: flex-start; }
.msg-content { padding: 10px 14px; border-radius: 12px; font-size: 14px; line-height: 1.6; white-space: pre-wrap; word-break: break-word; width: 100%; }
.message.assistant .msg-content { background: #fff; border: 1px solid #eee; border-top-left-radius: 4px; }
.message.user .msg-content { background: #1989fa; color: #fff; border-top-right-radius: 4px; }
.msg-save { margin-top: 4px; }
.msg-delete { color: #ccc; cursor: pointer; padding: 4px; font-size: 12px; opacity: 0; transition: opacity 0.2s; flex-shrink: 0; }
.msg-wrapper:hover .msg-delete { opacity: 1; }
.msg-delete:hover { color: #ee0a24; }
.thinking { display: flex; align-items: center; gap: 8px; color: #999; }
.chat-input { display: flex; align-items: center; gap: 8px; padding: 8px 16px; background: #fff; border-top: 1px solid #f0f0f0; }
.chat-input .van-field { flex: 1; }
.msg-content h1, .msg-content h2, .msg-content h3 { margin: 8px 0 4px; }
.msg-content strong { font-weight: 600; }
.msg-content code { background: #f5f5f5; padding: 1px 4px; border-radius: 3px; font-size: 12px; }
</style>
