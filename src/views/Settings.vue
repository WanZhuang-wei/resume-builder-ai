<template>
  <div class="settings">
    <div class="section-card api-section">
      <div class="section-title">
        <van-icon name="key" style="color:#1989fa;margin-right:6px" />
        DeepSeek API 配置
      </div>
      <div class="api-intro">
        <p>AI 简历生成、自动填写、智能问答等功能均需通过 DeepSeek API 调用。</p>
      </div>
      <van-form @submit="saveKey">
        <van-field
          v-model="apiKey"
          :type="showKey ? 'text' : 'password'"
          label="API Key"
          placeholder="sk-..."
          clearable
          :rules="[{ required: true, message: '请填写 API Key' }]"
        >
          <template #right-icon>
            <van-icon :name="showKey ? 'eye-o' : 'closed-eye'" @click="showKey = !showKey" style="cursor:pointer;color:#999" />
          </template>
        </van-field>
        <div style="font-size:12px;color:#999;padding:0 16px 8px">
          Key 仅存储在浏览器本地，不会上传至任何服务器
        </div>
        <div class="api-actions">
          <van-button round block type="primary" native-type="submit" size="small" :loading="saving">
            保存 API Key
          </van-button>
          <van-button v-if="apiKey" round block plain type="primary" size="small" :loading="testing" @click="testConnection" style="margin-top:8px">
            {{ testResult ? testResult : '测试连接' }}
          </van-button>
        </div>
      </van-form>
      <div class="api-links">
        <a href="https://platform.deepseek.com/api_keys" target="_blank" rel="noopener">
          <van-icon name="link-o" /> 获取 DeepSeek API Key →
        </a>
      </div>
    </div>

    <div class="section-card">
      <div class="section-title">数据管理</div>
      <van-cell-group :border="false">
        <van-cell title="导出所有数据" is-link @click="handleExport" />
        <van-cell title="导入数据" is-link @click="handleImport" />
        <van-cell title="清空知识库" is-link @click="handleClearKnowledge" />
      </van-cell-group>
      <input type="file" ref="fileInput" accept=".json" style="display:none" @change="handleFileSelect" />
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { showToast, showConfirmDialog, showSuccessToast, showFailToast } from 'vant'
import { useSettingsStore } from '@/stores/settings'
import { useKnowledgeStore } from '@/stores/knowledge'
import { exportAllData, importData, readFileAsText } from '@/utils/backup'
import { chat } from '@/api/deepseek'

const settingsStore = useSettingsStore()
const knowledgeStore = useKnowledgeStore()
const apiKey = ref(settingsStore.apiKey)
const fileInput = ref(null)
const showKey = ref(false)
const saving = ref(false)
const testing = ref(false)
const testResult = ref('')

function saveKey() {
  saving.value = true
  settingsStore.setApiKey(apiKey.value)
  testResult.value = ''
  showSuccessToast('API Key 已保存')
  saving.value = false
}

async function testConnection() {
  if (!apiKey.value) {
    showToast('请先填写 API Key')
    return
  }
  testing.value = true
  testResult.value = ''
  try {
    // 保存后再测试
    settingsStore.setApiKey(apiKey.value)
    const response = await chat([
      { role: 'user', content: '回复"连接成功"四个字' }
    ], { maxTokens: 10, temperature: 0 })
    if (response.includes('连接成功')) {
      testResult.value = '✅ 连接成功'
      showSuccessToast('API 连接正常')
    } else {
      testResult.value = '⚠️ 响应异常'
      showFailToast('返回内容异常')
    }
  } catch (e) {
    testResult.value = '❌ 连接失败'
    showFailToast('连接失败：' + e.message)
  } finally {
    testing.value = false
  }
}

async function handleExport() {
  try {
    await exportAllData()
    showToast('数据已导出')
  } catch (e) {
    showToast('导出失败：' + e.message)
  }
}

function handleImport() {
  showConfirmDialog({
    title: '导入数据',
    message: '导入将覆盖当前所有数据，确定继续？'
  }).then(() => {
    fileInput.value.click()
  }).catch(() => {})
}

async function handleFileSelect(e) {
  const file = e.target.files[0]
  if (!file) return
  try {
    const text = await readFileAsText(file)
    const data = JSON.parse(text)
    await importData(data)
    showSuccessToast('数据导入成功，请刷新页面')
  } catch (e) {
    showFailToast('导入失败：' + e.message)
  }
}

async function handleClearKnowledge() {
  showConfirmDialog({
    title: '清空知识库',
    message: '确定清空所有知识库文档？此操作不可撤销。'
  }).then(async () => {
    await knowledgeStore.clearAll()
    showSuccessToast('知识库已清空')
  }).catch(() => {})
}

onMounted(() => {
  if (!knowledgeStore.loaded) knowledgeStore.loadAll()
})
</script>

<style scoped>
.settings {
  padding-bottom: 20px;
}

.api-section {
  border: 1px solid #e8f0fe;
  background: linear-gradient(180deg, #f8fbff 0%, #fff 100%);
}

.api-intro {
  font-size: 13px;
  color: #666;
  line-height: 1.6;
  margin: 0 16px 12px;
  padding: 8px 12px;
  background: #f0f7ff;
  border-radius: 6px;
}

.api-actions {
  padding: 0 16px 8px;
}

.api-links {
  padding: 8px 16px 0;
  font-size: 13px;
}

.api-links a {
  color: #1989fa;
  text-decoration: none;
}
</style>
