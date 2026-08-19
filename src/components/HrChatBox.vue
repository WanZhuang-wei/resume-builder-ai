<template>
  <div class="hr-chat-box">
    <div class="chat-header">
      <van-icon name="chat-o" />
      <span>想了解我更多？来问 AI 助手</span>
    </div>

    <div class="messages" ref="messagesRef">
      <div v-if="messages.length === 0" class="welcome-msg">
        <p class="welcome-title">你好！我是{{ props.context?.basicInfo?.name || 'TA' }}的 AI 助手 👋</p>
        <p class="hint">项目经历、工作内容、技能特长……都可以问我</p>
        <p class="example">💬 例如：「可以介绍一下你的项目经历吗？」</p>
        <p class="count">剩余提问次数：{{ maxQuestions - questionCount }}/{{ maxQuestions }}</p>
      </div>
      <div v-for="(msg, i) in messages" :key="i" :class="['msg-item', msg.role]">
        <div class="msg-content">{{ msg.content }}</div>
      </div>
      <div v-if="loading" class="msg-item assistant">
        <div class="msg-content thinking">
          <van-loading type="ball" size="14" /> 思考中...
        </div>
      </div>
    </div>

    <div v-if="questionCount >= maxQuestions" class="limit-reached">
      <van-icon name="warning-o" />
      <span>提问次数已用完，请联系候选人刷新次数</span>
    </div>

    <div v-else class="chat-input">
      <van-field
        v-model="inputText"
        :disabled="loading"
        placeholder="输入你想了解的问题，例如：介绍一下你的项目经历"
        @keypress.enter="sendMessage"
        :border="false"
        clearable
      />
      <van-button
        class="send-btn"
        :loading="loading"
        icon="send-o"
        type="primary"
        :disabled="questionCount >= maxQuestions"
        @click="sendMessage"
      />
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, nextTick, computed } from 'vue'
import { showToast } from 'vant'
import { buildHrSystemPrompt } from '@/api/deepseek'
import { useKnowledgeStore } from '@/stores/knowledge'
import { logAction } from '@/utils/actionLog'

const props = defineProps({
  context: { type: Object, required: true },
  apiKey: { type: String, default: '' },
  shareId: { type: String, default: '' }
})

const knowledgeStore = useKnowledgeStore()
const SHARE_API = import.meta.env.VITE_SHARE_API || window.location.origin

const messages = ref([])
const inputText = ref('')
const loading = ref(false)
const messagesRef = ref(null)

const STORAGE_KEY = 'hr_question_count_' + getFingerprint()

function getFingerprint() {
  let fp = localStorage.getItem('hr_fp')
  if (!fp) {
    fp = Math.random().toString(36).slice(2, 10)
    localStorage.setItem('hr_fp', fp)
  }
  return fp
}

const questionCount = ref(getStoredCount())
const maxQuestions = ref(3)

function getStoredCount() {
  return parseInt(localStorage.getItem(STORAGE_KEY) || '0', 10)
}


async function loadServerStatus() {
  if (!props.shareId) return
  try {
    const res = await fetch(`${SHARE_API}/api/share/${props.shareId}/status?hrKey=${getFingerprint()}`)
    if (res.ok) {
      const data = await res.json()
      questionCount.value = data.count || 0
      maxQuestions.value = data.max || 3
      localStorage.setItem(STORAGE_KEY, String(questionCount.value))
    }
  } catch (e) {
    logAction('hrChat.loadStatus', { status: 'failed', error: e })
  }
}


async function scrollToBottom() {
  await nextTick()
  if (messagesRef.value) {
    messagesRef.value.scrollTop = messagesRef.value.scrollHeight
  }
}

/** 构建包含知识库上下文的 HR 系统提示 */
function buildPromptWithKnowledge(context) {
  let basePrompt = buildHrSystemPrompt(context)

  const knowledgeSummary = knowledgeStore.getSummaryContext()
  if (knowledgeSummary) {
    basePrompt += `\n\n【候选人的其他资料信息】
以下是从候选人上传的文档中提取的补充信息，供你参考回答：
${knowledgeSummary}

注意：这些信息可能不完整，回答时请结合主资料综合判断。`
  }

  return basePrompt
}

async function sendMessage() {
  const text = inputText.value.trim()
  if (!text || loading.value) return

  if (questionCount.value >= maxQuestions.value) {
    showToast('提问次数已用完，请联系候选人刷新次数')
    return
  }

  if (!props.shareId) {
    showToast('分享链接异常，无法提问')
    return
  }

  inputText.value = ''
  logAction('hrChat.send', { status: 'started', payload: { textLength: text.length } })
  messages.value.push({ role: 'user', content: text })
  await scrollToBottom()

  loading.value = true
  try {
    // 确保知识库已加载
    if (!knowledgeStore.loaded) await knowledgeStore.loadAll()

    const chatMessages = [
      { role: 'system', content: buildPromptWithKnowledge(props.context) },
      ...messages.value.map(m => ({ role: m.role, content: m.content }))
    ]
    // HR 提问统一走服务器代理（DeepSeek Key 只存服务器，HR 无需配置）
    const res = await fetch(`${SHARE_API}/api/share/${props.shareId}/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ hrKey: getFingerprint(), messages: chatMessages })
    })
    const data = await res.json().catch(() => ({}))
    if (res.status === 429) {
      messages.value.pop()
      showToast(data.error || '提问次数已用完，请联系候选人刷新次数')
      if (data.max) maxQuestions.value = data.max
      questionCount.value = maxQuestions.value
      return
    }
    if (!res.ok) throw new Error(data.error || ('服务器错误 ' + res.status))
    messages.value.push({ role: 'assistant', content: data.reply })
    if (typeof data.remaining === 'number') {
      maxQuestions.value = data.max || maxQuestions.value
      questionCount.value = maxQuestions.value - data.remaining
      localStorage.setItem(STORAGE_KEY, String(questionCount.value))
    }
    logAction('hrChat.send', { status: 'success', payload: { responseLength: (data.reply || '').length } })
  } catch (e) {
    messages.value.push({ role: 'assistant', content: '抱歉，回答时遇到问题：' + e.message })
    logAction('hrChat.send', { status: 'failed', error: e })
  } finally {
    loading.value = false
    await scrollToBottom()
  }
}

onMounted(() => {
  if (!knowledgeStore.loaded) knowledgeStore.loadAll()
  loadServerStatus()
})
</script>

<style scoped>
.hr-chat-box {
  background: #fff;
  border-radius: 14px;
  display: flex;
  flex-direction: column;
  max-height: 460px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.08);
  overflow: hidden;
}

.chat-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 14px 16px;
  font-size: 15px;
  font-weight: 600;
  color: #fff;
  background: linear-gradient(135deg, #1989fa, #4bb3ff);
}

.chat-header .van-icon {
  font-size: 18px;
}

.messages {
  flex: 1;
  overflow-y: auto;
  padding: 12px 16px;
  min-height: 140px;
  max-height: 300px;
}

.welcome-msg {
  text-align: center;
  color: #666;
  font-size: 14px;
  padding: 22px 12px;
}

.welcome-msg .welcome-title {
  font-size: 16px;
  font-weight: 600;
  color: #333;
  margin-bottom: 8px;
}

.welcome-msg .hint {
  font-size: 14px;
  margin-top: 6px;
  color: #888;
}

.welcome-msg .example {
  display: inline-block;
  margin-top: 12px;
  padding: 7px 14px;
  background: #ecf5ff;
  color: #1989fa;
  font-size: 13px;
  border-radius: 18px;
}

.welcome-msg .count {
  margin-top: 10px;
  font-size: 12px;
  color: #bbb;
}

.msg-item {
  margin-bottom: 10px;
  display: flex;
}

.msg-item.user {
  justify-content: flex-end;
}

.msg-item .msg-content {
  max-width: 85%;
  padding: 8px 12px;
  border-radius: 10px;
  font-size: 14px;
  line-height: 1.5;
  white-space: pre-wrap;
  word-break: break-word;
}

.msg-item.assistant .msg-content {
  background: #f0f5ff;
  border: 1px solid #e0ecff;
  border-top-left-radius: 2px;
}

.msg-item.user .msg-content {
  background: #1989fa;
  color: #fff;
  border-top-right-radius: 2px;
}

.thinking {
  display: flex;
  align-items: center;
  gap: 6px;
  color: #666;
}

.limit-reached {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 12px 16px;
  color: #999;
  font-size: 13px;
  background: #fafafa;
}

.chat-input {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  border-top: 1px solid #f0f0f0;
  background: #fff;
}

.chat-input .van-field {
  flex: 1;
  background: #f7f8fa;
  border-radius: 22px;
  padding: 4px 8px;
}

.chat-input :deep(.van-field__control) {
  font-size: 15px;
  min-height: 26px;
}

.chat-input :deep(.van-field__control::placeholder) {
  font-size: 14px;
  color: #999;
}

.send-btn {
  width: 42px;
  height: 42px;
  flex-shrink: 0;
  border-radius: 50%;
  padding: 0;
}

.send-btn :deep(.van-icon) {
  font-size: 20px;
}
</style>
