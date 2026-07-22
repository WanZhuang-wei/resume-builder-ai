<template>
  <div class="share-profile">
    <div class="section-card">
      <div class="section-title">选择联系方式</div>
      <van-checkbox-group v-model="selectedContacts">
        <van-cell-group :border="false">
          <van-cell title="显示电话" clickable @click="toggleContact('phone')">
            <template #right-icon>
              <van-checkbox :name="'phone'" checked-color="#07c160" />
            </template>
          </van-cell>
          <van-cell title="显示微信" clickable @click="toggleContact('wechat')">
            <template #right-icon>
              <van-checkbox :name="'wechat'" checked-color="#07c160" />
            </template>
          </van-cell>
          <van-cell title="显示邮箱" clickable @click="toggleContact('email')">
            <template #right-icon>
              <van-checkbox :name="'email'" checked-color="#07c160" />
            </template>
          </van-cell>
        </van-cell-group>
      </van-checkbox-group>
    </div>

    <div class="section-card">
      <div class="section-title">选择展示内容</div>
      <van-checkbox-group v-model="selectedSections">
        <van-cell-group :border="false">
          <van-cell title="基本信息" clickable @click="toggleSection('basicInfo')">
            <template #right-icon>
              <van-checkbox :name="'basicInfo'" checked-color="#1989fa" />
            </template>
          </van-cell>
          <van-cell title="工作经历" clickable @click="toggleSection('workExperiences')">
            <template #right-icon>
              <van-checkbox :name="'workExperiences'" checked-color="#1989fa" />
            </template>
          </van-cell>
          <van-cell title="教育背景" clickable @click="toggleSection('education')">
            <template #right-icon>
              <van-checkbox :name="'education'" checked-color="#1989fa" />
            </template>
          </van-cell>
          <van-cell title="项目经验" clickable @click="toggleSection('projects')">
            <template #right-icon>
              <van-checkbox :name="'projects'" checked-color="#1989fa" />
            </template>
          </van-cell>
          <van-cell title="技能标签" clickable @click="toggleSection('skills')">
            <template #right-icon>
              <van-checkbox :name="'skills'" checked-color="#1989fa" />
            </template>
          </van-cell>
        </van-cell-group>
      </van-checkbox-group>
    </div>

    <div class="section-card">
      <van-button round block type="primary" native-type="submit" size="small" @click="generateLink">生成分享链接</van-button>
      <div v-if="warning" style="font-size:12px;color:#ff976a;margin-top:8px;text-align:center">{{ warning }}</div>
    </div>

    <div v-if="shareLink" class="section-card">
      <div class="section-title">分享链接</div>
      <van-field v-model="shareLink" readonly :border="false" autosize type="textarea" />
      <div class="action-buttons">
        <van-button round type="primary" size="small" icon="copy-o" @click="copyLink">复制链接</van-button>
      </div>
      <div style="font-size:12px;color:#999;margin-top:8px">发给HR后，对方打开即可看到你的个人展示页和智能问答助手，每人限问3次</div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, reactive } from 'vue'
import { showToast } from 'vant'
import { useProfileStore } from '@/stores/profile'
import { useShareStore } from '@/stores/share'
import { getApiKey } from '@/api/deepseek'

const profileStore = useProfileStore()
const shareStore = useShareStore()

const selectedContacts = ref(['phone', 'wechat', 'email'])
const selectedSections = ref(['basicInfo', 'workExperiences', 'education', 'projects', 'skills'])
const shareLink = ref('')
const warning = ref('')

onMounted(() => {
  if (!profileStore.loaded) profileStore.loadAll()
})

function toggleContact(key) {
  const idx = selectedContacts.value.indexOf(key)
  if (idx >= 0) selectedContacts.value.splice(idx, 1)
  else selectedContacts.value.push(key)
}

function toggleSection(key) {
  const idx = selectedSections.value.indexOf(key)
  if (idx >= 0) selectedSections.value.splice(idx, 1)
  else selectedSections.value.push(key)
}

function generateLink() {
  if (!getApiKey()) {
    showToast('请先在设置中配置 DeepSeek API Key')
    return
  }

  shareStore.selectedContact.showPhone = selectedContacts.value.includes('phone')
  shareStore.selectedContact.showWechat = selectedContacts.value.includes('wechat')
  shareStore.selectedContact.showEmail = selectedContacts.value.includes('email')

  shareStore.selectedSections.basicInfo = selectedSections.value.includes('basicInfo')
  shareStore.selectedSections.workExperiences = selectedSections.value.includes('workExperiences')
  shareStore.selectedSections.education = selectedSections.value.includes('education')
  shareStore.selectedSections.projects = selectedSections.value.includes('projects')
  shareStore.selectedSections.skills = selectedSections.value.includes('skills')

  const link = shareStore.generateShareLink(profileStore.summaryData)
  shareLink.value = link
  warning.value = shareStore.getUrlWarning()
  showToast('链接已生成')
}

async function copyLink() {
  try {
    await navigator.clipboard.writeText(shareLink.value)
    showToast('已复制到剪贴板')
  } catch {
    // Fallback
    const textarea = document.createElement('textarea')
    textarea.value = shareLink.value
    document.body.appendChild(textarea)
    textarea.select()
    document.execCommand('copy')
    document.body.removeChild(textarea)
    showToast('已复制到剪贴板')
  }
}
</script>

<style scoped>
.share-profile {
  padding-bottom: 20px;
}
</style>
