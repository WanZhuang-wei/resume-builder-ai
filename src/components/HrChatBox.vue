<template>
  <div class="hr-chat-box">
    <div class="chat-header">
      <van-icon name="chat-o" />
      <span>想了解我的更多项目细节？问问智能助手</span>
    </div>

    <div class="messages" ref="messagesRef">
      <div v-if="messages.length === 0" class="welcome-msg">
        <p>你好！我是候选人的智能助手</p>
        <p class="hint">你可以问我关于项目细节、工作经历等方面的问题</p>
        <p class="hint">剩余提问次数：{{ 3 - questionCount }}/3</p>
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

    <div v-if="questionCount >= 3" class="limit-reached">
      <van-icon name="warning-o" />
      <span>提问次数已用完，请联系候选人获取更多信息</span>
    </div>

    <div v-else class="chat-input">
      <van-field v-model="inputText" :disabled="loading" placeholder="输入你的问题..." @keypress.enter="sendMessage" :border="false" />
      <van-button :loading="loading" icon="send-o" round size="small" type="primary" :disabled="questionCount >= 3" @click="sendMessage" />
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, nextTick, computed } from 'vue'
import { showToast } from 'vant'
import { chat, hrQuestion, buildHrSystemPrompt, getApiKey } from '@/api/deepseek'
import { useKnowledgeStore } from '@/stores/knowledge'

const props = defineProps({
  context: { type: Object, required: true },
  apiKey: { type: String, default: '' }
})

const knowledgeStore = useKnowledgeStore()

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

function getStoredCount() {
  return parseInt(localStorage.getItem(STORAGE_KEY) || '0', 10)
}

function incrementCount() {
  questionCount.value++
  localStorage.setItem(STORAGE_KEY, String(questionCount.value))
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

  if (questionCount.value >= 3) {
    showToast('提问次数已用完')
    return
  }

  if (!getApiKey() && !props.apiKey) {
    showToast('API 配置异常，请联系候选人')
    return
  }

  inputText.value = ''
  messages.value.push({ role: 'user', content: text })
  incrementCount()
  await scrollToBottom()

  loading.value = true
  try {
    // 确保知识库已加载
    if (!knowledgeStore.loaded) await knowledgeStore.loadAll()

    const chatMessages = [
      { role: 'system', content: buildPromptWithKnowledge(props.context) },
      ...messages.value.map(m => ({ role: m.role, content: m.content }))
    ]
    const response = await chat(chatMessages, { maxTokens: 500 })
    messages.value.push({ role: 'assistant', content: response })
  } catch (e) {
    messages.value.push({ role: 'assistant', content: '抱歉，回答时遇到问题：' + e.message })
  } finally {
    loading.value = false
    await scrollToBottom()
  }
}

onMounted(() => {
  if (!knowledgeStore.loaded) knowledgeStore.loadAll()
})
</script>

<style scoped>
.hr-chat-box {
  background: #fff;
  border-radius: 12px 12px 0 0;
  display: flex;
  flex-direction: column;
  max-height: 450px;
}

.chat-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 14px 16px;
  font-size: 14px;
  font-weight: 600;
  color: #1989fa;
  border-bottom: 1px solid #f0f0f0;
}

.messages {
  flex: 1;
  overflow-y: auto;
  padding: 12px 16px;
  min-height: 120px;
  max-height: 280px;
}

.welcome-msg {
  text-align: center;
  color: #999;
  font-size: 13px;
  padding: 20px;
}

.welcome-msg .hint {
  font-size: 12px;
  margin-top: 4px;
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
  font-size: 13px;
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
  gap: 8px;
  padding: 8px 12px;
  border-top: 1px solid #f0f0f0;
}

.chat-input .van-field {
  flex: 1;
}
</style>
