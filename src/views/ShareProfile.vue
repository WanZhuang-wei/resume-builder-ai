<template>
  <div class="share-profile">
    <div class="section-card">
      <div class="section-title">??????</div>
      <van-checkbox-group v-model="selectedContacts">
        <van-cell-group :border="false">
          <van-cell title="????" clickable @click="toggleContact('phone')">
            <template #right-icon>
              <van-checkbox :name="'phone'" checked-color="#07c160" @click.stop />
            </template>
          </van-cell>
          <van-cell title="????" clickable @click="toggleContact('wechat')">
            <template #right-icon>
              <van-checkbox :name="'wechat'" checked-color="#07c160" @click.stop />
            </template>
          </van-cell>
          <van-cell title="????" clickable @click="toggleContact('email')">
            <template #right-icon>
              <van-checkbox :name="'email'" checked-color="#07c160" @click.stop />
            </template>
          </van-cell>
        </van-cell-group>
      </van-checkbox-group>
    </div>

    <div class="section-card">
      <div class="section-title">??????</div>
      <van-checkbox-group v-model="selectedSections">
        <van-cell-group :border="false">
          <van-cell title="????" clickable @click="toggleSection('basicInfo')">
            <template #right-icon>
              <van-checkbox :name="'basicInfo'" checked-color="#1989fa" @click.stop />
            </template>
          </van-cell>
          <van-cell title="????" clickable @click="toggleSection('workExperiences')">
            <template #right-icon>
              <van-checkbox :name="'workExperiences'" checked-color="#1989fa" @click.stop />
            </template>
          </van-cell>
          <van-cell title="????" clickable @click="toggleSection('education')">
            <template #right-icon>
              <van-checkbox :name="'education'" checked-color="#1989fa" @click.stop />
            </template>
          </van-cell>
          <van-cell title="????" clickable @click="toggleSection('projects')">
            <template #right-icon>
              <van-checkbox :name="'projects'" checked-color="#1989fa" @click.stop />
            </template>
          </van-cell>
          <van-cell title="????" clickable @click="toggleSection('skills')">
            <template #right-icon>
              <van-checkbox :name="'skills'" checked-color="#1989fa" @click.stop />
            </template>
          </van-cell>
        </van-cell-group>
      </van-checkbox-group>
    </div>

    <div class="section-card">
      <van-button round block type="primary" native-type="submit" size="small" :loading="generating" @click="generateLink(false)">
        {{ generating ? '???...' : '??????' }}
      </van-button>
    </div>

    <div v-if="shareLink" class="section-card">
      <div class="section-title">????</div>
      <div v-if="reused" class="reused-tip">????????????????????????????</div>
      <van-field v-model="shareLink" readonly :border="false" autosize type="textarea" />
      <div class="action-buttons">
        <van-button round type="primary" size="small" icon="copy-o" @click="copyLink">????</van-button>
        <van-button v-if="shareStore.manageToken" round plain type="primary" size="small" icon="setting-o" @click="openManage">??????</van-button>
        <van-button round plain type="warning" size="small" icon="replay" :loading="generating" @click="generateLink(true)">????</van-button>
      </div>
      <div v-if="viewCount" style="font-size:12px;color:#1989fa;margin-top:8px">???? {{ viewCount }} ?</div>
      <div style="font-size:12px;color:#999;margin-top:8px">??HR??????????????????????????????? 3 ?????? 40 ?????????????????????/???</div>
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
    showToast(forceNew ? '???????' : (result.reused ? '???????' : '?????'))
    logAction('share.generateLink', { status: 'success', payload: { linkLength: result.link.length, id: result.id, reused: result.reused, forceNew: !!forceNew } })
  } catch (e) {
    showToast(e.message || '??????')
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
    showToast('???????')
  } catch {
    const textarea = document.createElement('textarea')
    textarea.value = shareLink.value
    document.body.appendChild(textarea)
    textarea.select()
    document.execCommand('copy')
    document.body.removeChild(textarea)
    showToast('???????')
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
