<template>
  <div class="share-profile">
    <div class="section-card">
      <div class="section-title">选择联系方式</div>
      <van-checkbox-group v-model="selectedContacts">
        <van-cell-group :border="false">
          <van-cell title="显示电话" clickable @click="toggleContact('phone')">
            <template #right-icon>
              <van-checkbox :name="'phone'" checked-color="#07c160" @click.stop />
            </template>
          </van-cell>
          <van-cell title="显示微信" clickable @click="toggleContact('wechat')">
            <template #right-icon>
              <van-checkbox :name="'wechat'" checked-color="#07c160" @click.stop />
            </template>
          </van-cell>
          <van-cell title="显示邮箱" clickable @click="toggleContact('email')">
            <template #right-icon>
              <van-checkbox :name="'email'" checked-color="#07c160" @click.stop />
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
              <van-checkbox :name="'basicInfo'" checked-color="#1989fa" @click.stop />
            </template>
          </van-cell>
          <van-cell title="工作经历" clickable @click="toggleSection('workExperiences')">
            <template #right-icon>
              <van-checkbox :name="'workExperiences'" checked-color="#1989fa" @click.stop />
            </template>
          </van-cell>
          <van-cell title="教育背景" clickable @click="toggleSection('education')">
            <template #right-icon>
              <van-checkbox :name="'education'" checked-color="#1989fa" @click.stop />
            </template>
          </van-cell>
          <van-cell title="项目经验" clickable @click="toggleSection('projects')">
            <template #right-icon>
              <van-checkbox :name="'projects'" checked-color="#1989fa" @click.stop />
            </template>
          </van-cell>
          <van-cell title="技能标签" clickable @click="toggleSection('skills')">
            <template #right-icon>
              <van-checkbox :name="'skills'" checked-color="#1989fa" @click.stop />
            </template>
          </van-cell>
        </van-cell-group>
      </van-checkbox-group>
    </div>

    <div class="section-card">
      <van-button round block type="primary" native-type="submit" size="small" :loading="generating" @click="generateLink(false)">
        {{ generating ? '生成中...' : '生成分享链接' }}
      </van-button>
    </div>

    <div v-if="shareLink" class="section-card">
      <div class="section-title">分享链接</div>
      <div v-if="reused" class="reused-tip">已复用你之前生成的稳定链接（链接不会变），有效期已顺延。</div>
      <van-field v-model="shareLink" readonly :border="false" autosize type="textarea" />
      <div class="action-buttons">
        <van-button round type="primary" size="small" icon="copy-o" @click="copyLink">复制链接</van-button>
        <van-button v-if="shareStore.manageToken" round plain type="primary" size="small" icon="setting-o" @click="openManage">管理提问次数</van-button>
        <van-button round plain type="warning" size="small" icon="replay" :loading="generating" @click="generateLink(true)">换新链接</van-button>
      </div>
      <div v-if="viewCount" style="font-size:12px;color:#1989fa;margin-top:8px">已被查看 {{ viewCount }} 次</div>
      <div style="font-size:12px;color:#999;margin-top:8px">发给HR后，对方打开即可看到你的个人展示页和智能问答助手，默认每人限问 3 次。分享链接 40 天有效，可随时在“我的分享”或管理后台延期/撤销。</div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { showToast } from 'vant'
import { useProfileStore } from '@/stores/profile'
import { useShareStore } from '@/stores/share'
import { useRouter } from 'vue-router'
import { logAction } from '@/utils/actionLog'

const profileStore = useProfileStore()
const shareStore = useShareStore()
const router = useRouter()

const selectedContacts = ref(['phone', 'wechat', 'email'])
const selectedSections = ref(['basicInfo', 'workExperiences', 'education', 'projects', 'skills'])
const shareLink = ref('')
const viewCount = ref(0)
const generating = ref(false)
const reused = ref(false)

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

async function generateLink(forceNew) {
  logAction('share.generateLink', { status: 'started', payload: { forceNew: !!forceNew } })
  generating.value = true

  shareStore.selectedContact.showPhone = selectedContacts.value.includes('phone')
  shareStore.selectedContact.showWechat = selectedContacts.value.includes('wechat')
  shareStore.selectedContact.showEmail = selectedContacts.value.includes('email')

  shareStore.selectedSections.basicInfo = selectedSections.value.includes('basicInfo')
  shareStore.selectedSections.workExperiences = selectedSections.value.includes('workExperiences')
  shareStore.selectedSections.education = selectedSections.value.includes('education')
  shareStore.selectedSections.projects = selectedSections.value.includes('projects')
  shareStore.selectedSections.skills = selectedSections.value.includes('skills')

  try {
    const result = await shareStore.generateShareLink(profileStore.summaryData, { forceNew: !!forceNew })
    shareLink.value = result.link
    reused.value = !!result.reused
    viewCount.value = shareStore.getViewCount(result.id)
    showToast(forceNew ? '已生成全新链接' : (result.reused ? '已复用稳定链接' : '链接已生成'))
    logAction('share.generateLink', { status: 'success', payload: { linkLength: result.link.length, id: result.id, reused: result.reused, forceNew: !!forceNew } })
  } catch (e) {
    showToast(e.message || '生成链接失败')
    logAction('share.generateLink', { status: 'failed', error: e })
  } finally {
    generating.value = false
  }
}

function openManage() {
  if (!shareStore.lastShareId || !shareStore.manageToken) return
  router.push('/manage/' + shareStore.lastShareId + '?token=' + shareStore.manageToken)
  logAction('share.openManage', { status: 'success', payload: { shareId: shareStore.lastShareId } })
}

async function copyLink() {
  try {
    await navigator.clipboard.writeText(shareLink.value)
    showToast('已复制到剪贴板')
  } catch {
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
.reused-tip {
  font-size: 12px;
  color: #07c160;
  margin-bottom: 8px;
}
</style>
