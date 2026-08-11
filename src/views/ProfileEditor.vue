<template>
  <div class="profile-editor">
    <!-- Basic Info -->
    <div class="section-card">
      <div class="section-title">基本信息</div>
      <van-form @submit="saveBasic">
        <van-field v-model="basic.name" name="name" label="姓名" placeholder="请输入姓名" :rules="[{ required: true, message: '请填写姓名' }]" />
        <van-field v-model="basic.phone" name="phone" label="电话" placeholder="请输入电话" type="tel" />
        <van-field v-model="basic.wechat" name="wechat" label="微信" placeholder="请输入微信号" />
        <van-field v-model="basic.email" name="email" label="邮箱" placeholder="请输入邮箱" />
        <van-field v-model="basic.title" name="title" label="求职意向" placeholder="如：高级前端工程师" />
        <van-field v-model="basic.targetPosition" name="targetPosition" label="目标岗位" placeholder="如：React前端开发" />
        <van-field v-model="basic.summary" name="summary" label="个人简介" type="textarea" rows="3" placeholder="一句话介绍自己，突出核心优势" show-word-limit maxlength="300" />
        <div style="margin: 16px">
          <van-button round block type="primary" native-type="submit" size="small">保存基本信息</van-button>
        </div>
      </van-form>
    </div>

    <!-- Work Experiences -->
    <div class="section-card">
      <div class="section-title">工作经历</div>
      <div v-if="profileStore.workExperiences.length === 0" class="empty-state">
        <p>暂无工作经历</p>
      </div>
      <div v-for="exp in profileStore.workExperiences" :key="exp.id" class="list-item">
        <div class="item-header">
          <strong>{{ exp.company }}</strong>
          <van-tag plain type="primary">{{ exp.position }}</van-tag>
          <van-tag v-if="exp.type === 'internship'" plain color="#ff976a" size="small">实习</van-tag>
          <van-tag v-else-if="exp.type === 'parttime'" plain color="#07c160" size="small">兼职</van-tag>
          <van-tag v-else plain color="#1989fa" size="small">全职</van-tag>
        </div>
        <div class="item-time">{{ exp.startDate }} - {{ exp.endDate || '至今' }}</div>
        <div class="item-desc">{{ exp.description }}</div>
        <div v-if="exp.achievements" class="item-desc">成就：{{ exp.achievements }}</div>
        <div class="action-buttons">
          <van-button size="mini" plain type="primary" @click="editWork(exp)">编辑</van-button>
          <van-button size="mini" plain type="danger" @click="deleteWork(exp.id)">删除</van-button>
        </div>
      </div>
      <van-button round block plain type="primary" size="small" @click="showWorkForm = true; editingWork = null; workForm = {}">+ 添加工作经历</van-button>
    </div>

    <!-- Education -->
    <div class="section-card">
      <div class="section-title">教育背景</div>
      <div v-if="profileStore.education.length === 0" class="empty-state"><p>暂无教育背景</p></div>
      <div v-for="edu in profileStore.education" :key="edu.id" class="list-item">
        <div class="item-header">
          <strong>{{ edu.school }}</strong>
          <van-tag plain type="primary">{{ edu.major }}/{{ edu.degree }}</van-tag>
        </div>
        <div class="item-time">{{ edu.startDate }} - {{ edu.endDate || '至今' }}</div>
        <div class="action-buttons">
          <van-button size="mini" plain type="primary" @click="editEdu(edu)">编辑</van-button>
          <van-button size="mini" plain type="danger" @click="deleteEdu(edu.id)">删除</van-button>
        </div>
      </div>
      <van-button round block plain type="primary" size="small" @click="showEduForm = true; editingEdu = null; eduForm = {}">+ 添加教育背景</van-button>
    </div>

    <!-- Projects -->
    <div class="section-card">
      <div class="section-title">项目经验</div>
      <div v-if="profileStore.projects.length === 0" class="empty-state"><p>暂无项目经验</p></div>
      <div v-for="proj in profileStore.projects" :key="proj.id" class="list-item">
        <div class="item-header">
          <strong>{{ proj.name }}</strong>
          <van-tag plain type="primary">{{ proj.role }}</van-tag>
        </div>
        <div class="item-desc">技术栈：{{ proj.techStack }}</div>
        <div class="item-desc">{{ proj.description }}</div>
        <div class="action-buttons">
          <van-button size="mini" plain type="primary" @click="editProj(proj)">编辑</van-button>
          <van-button size="mini" plain type="danger" @click="deleteProj(proj.id)">删除</van-button>
        </div>
      </div>
      <van-button round block plain type="primary" size="small" @click="showProjForm = true; editingProj = null; projForm = {}">+ 添加项目经验</van-button>
    </div>

    <!-- Skills -->
    <div class="section-card">
      <div class="section-title">技能标签</div>
      <div class="skills-grid">
        <van-tag v-for="skill in profileStore.skills" :key="skill.id" closeable size="medium" color="#ecf5ff" text-color="#1989fa" @close="deleteSkill(skill.id)">{{ skill.name }}</van-tag>
      </div>
      <van-form @submit="addSkill" style="margin-top:12px">
        <van-field v-model="skillForm.name" label="技能名" placeholder="如：Vue.js" :rules="[{ required: true, message: '请输入技能名' }]" />
        <van-field v-model="skillForm.category" label="分类" placeholder="如：前端框架" />
        <van-button round block type="primary" native-type="submit" size="small">添加技能</van-button>
      </van-form>
    </div>

    <!-- Certificates -->
    <div class="section-card">
      <div class="section-title">证书/语言</div>
      <div v-if="profileStore.certificates.length === 0" class="empty-state"><p>暂无证书</p></div>
      <div v-for="cert in profileStore.certificates" :key="cert.id" class="list-item">
        <strong>{{ cert.name }}</strong>
        <div class="item-desc">{{ cert.issuer }} | {{ cert.date }}</div>
        <van-button size="mini" plain type="danger" @click="deleteCert(cert.id)">删除</van-button>
      </div>
      <van-form @submit="addCert" style="margin-top:12px">
        <van-field v-model="certForm.name" label="证书名" placeholder="如：英语六级" :rules="[{ required: true, message: '请输入证书名' }]" />
        <van-field v-model="certForm.issuer" label="颁发机构" placeholder="如：CET" />
        <van-field v-model="certForm.date" label="获得时间" placeholder="如：2024-06" />
        <van-button round block type="primary" native-type="submit" size="small">添加证书</van-button>
      </van-form>
    </div>

    <!-- Work Form Dialog -->
    <van-dialog v-model:show="showWorkForm" :title="editingWork ? '编辑工作经历' : '添加工作经历'" show-cancel-button @confirm="saveWork" close-on-click-overlay>
      <van-form @submit="saveWork">
        <van-field v-model="workForm.company" label="公司" placeholder="请输入公司名称" :rules="[{ required: true, message: '请填写公司' }]" />
        <van-field v-model="workForm.position" label="职位" placeholder="请输入职位" />
        <van-field v-model="workForm.startDate" label="开始时间" placeholder="如：2020-01" />
        <van-field v-model="workForm.endDate" label="结束时间" placeholder="如：2023-12（至今留空）" />
        <van-field v-model="workForm.description" label="工作描述" type="textarea" rows="3" placeholder="主要工作内容" />
        <van-field v-model="workForm.achievements" label="主要成就" type="textarea" rows="2" placeholder="量化成果，如：提升效率30%" />
        <van-field v-model="workForm.tags" label="关键词标签" placeholder="如：React, Node.js（逗号分隔）" />
        <div class="type-selector">
          <span class="type-label">工作类型</span>
          <van-radio-group v-model="workForm.type" direction="horizontal">
            <van-radio name="fulltime">全职</van-radio>
            <van-radio name="internship">实习</van-radio>
            <van-radio name="parttime">兼职</van-radio>
          </van-radio-group>
        </div>
      </van-form>
    </van-dialog>

    <!-- Education Form Dialog -->
    <van-dialog v-model:show="showEduForm" :title="editingEdu ? '编辑教育背景' : '添加教育背景'" show-cancel-button @confirm="saveEdu" close-on-click-overlay>
      <van-form @submit="saveEdu">
        <van-field v-model="eduForm.school" label="学校" placeholder="请输入学校名称" :rules="[{ required: true, message: '请填写学校' }]" />
        <van-field v-model="eduForm.major" label="专业" placeholder="请输入专业" />
        <van-field v-model="eduForm.degree" label="学位" placeholder="如：本科/硕士/博士" />
        <van-field v-model="eduForm.startDate" label="开始时间" placeholder="如：2016-09" />
        <van-field v-model="eduForm.endDate" label="结束时间" placeholder="如：2020-06" />
        <van-field v-model="eduForm.gpa" label="GPA" placeholder="如：3.8/4.0" />
      </van-form>
    </van-dialog>

    <!-- Project Form Dialog -->
    <van-dialog v-model:show="showProjForm" :title="editingProj ? '编辑项目经验' : '添加项目经验'" show-cancel-button @confirm="saveProj" close-on-click-overlay>
      <van-form @submit="saveProj">
        <van-field v-model="projForm.name" label="项目名称" placeholder="请输入项目名称" :rules="[{ required: true, message: '请填写项目名称' }]" />
        <van-field v-model="projForm.role" label="角色" placeholder="如：前端负责人" />
        <van-field v-model="projForm.techStack" label="技术栈" placeholder="如：Vue3, Node.js" />
        <van-field v-model="projForm.description" label="项目描述" type="textarea" rows="3" placeholder="项目背景和你的贡献" />
        <van-field v-model="projForm.link" label="项目链接" placeholder="如有，可填写链接" />
      </van-form>
    </van-dialog>
  </div>
</template>

<script setup>
import { ref, onMounted, reactive, watch } from 'vue'
import { showToast } from 'vant'
import { logAction } from '@/utils/actionLog'
import { useProfileStore } from '@/stores/profile'

const profileStore = useProfileStore()

onMounted(() => {
  if (!profileStore.loaded) profileStore.loadAll()
})

const basic = reactive({
  name: '', phone: '', wechat: '', email: '',
  title: '', summary: '', targetPosition: ''
})

watch(() => profileStore.basicInfo, (val) => {
  if (val) Object.assign(basic, val)
}, { immediate: true })

async function saveBasic() {
  await profileStore.saveBasicInfo({ ...basic })
  showToast('基本信息已保存')
  logAction('profile.saveBasicInfo', { status: 'success', payload: { name: basic.name } })
}

// Work Experiences
const showWorkForm = ref(false)
const editingWork = ref(null)
const workForm = reactive({
  company: '', position: '', startDate: '', endDate: '',
  description: '', achievements: '', tags: '', type: 'fulltime'
})

function editWork(exp) {
  editingWork.value = exp
  Object.assign(workForm, exp)
  showWorkForm.value = true
}

function resetWorkForm() {
  Object.assign(workForm, {
    company: '', position: '', startDate: '', endDate: '',
    description: '', achievements: '', tags: '', type: 'fulltime'
  })
}

async function saveWork() {
  const tags = workForm.tags ? workForm.tags.split(/[,，]/).map(t => t.trim()).filter(Boolean) : []
  const data = { ...workForm, tags }
  if (editingWork.value) {
    await profileStore.updateWorkExperience(editingWork.value.id, data)
  } else {
    await profileStore.addWorkExperience(data)
  }
  showWorkForm.value = false
  showToast(editingWork.value ? '已更新' : '已添加')
  resetWorkForm()
  editingWork.value = null
}

async function deleteWork(id) {
  await profileStore.deleteWorkExperience(id)
  showToast('已删除')
}

// Education
const showEduForm = ref(false)
const editingEdu = ref(null)
const eduForm = reactive({ school: '', major: '', degree: '', startDate: '', endDate: '', gpa: '' })

function editEdu(edu) {
  editingEdu.value = edu
  Object.assign(eduForm, edu)
  showEduForm.value = true
}

async function saveEdu() {
  if (editingEdu.value) {
    await profileStore.updateEducation(editingEdu.value.id, { ...eduForm })
  } else {
    await profileStore.addEducation({ ...eduForm })
  }
  showEduForm.value = false
  showToast(editingEdu.value ? '已更新' : '已添加')
  Object.assign(eduForm, { school: '', major: '', degree: '', startDate: '', endDate: '', gpa: '' })
  editingEdu.value = null
}

async function deleteEdu(id) {
  await profileStore.deleteEducation(id)
  showToast('已删除')
}

// Projects
const showProjForm = ref(false)
const editingProj = ref(null)
const projForm = reactive({ name: '', role: '', techStack: '', description: '', link: '' })

function editProj(proj) {
  editingProj.value = proj
  Object.assign(projForm, proj)
  showProjForm.value = true
}

async function saveProj() {
  if (editingProj.value) {
    await profileStore.updateProject(editingProj.value.id, { ...projForm })
  } else {
    await profileStore.addProject({ ...projForm })
  }
  showProjForm.value = false
  showToast(editingProj.value ? '已更新' : '已添加')
  Object.assign(projForm, { name: '', role: '', techStack: '', description: '', link: '' })
  editingProj.value = null
}

async function deleteProj(id) {
  await profileStore.deleteProject(id)
  showToast('已删除')
}

// Skills
const skillForm = reactive({ name: '', category: '' })

async function addSkill() {
  if (!skillForm.name) {
    showToast('请输入技能名')
    return
  }
  await profileStore.addSkill({ name: skillForm.name, category: skillForm.category || '其他', proficiency: 3 })
  skillForm.name = ''
  skillForm.category = ''
  showToast('已添加')
}

async function deleteSkill(id) {
  await profileStore.deleteSkill(id)
}

// Certificates
const certForm = reactive({ name: '', issuer: '', date: '' })

async function addCert() {
  if (!certForm.name) {
    showToast('请输入证书名')
    return
  }
  await profileStore.addCertificate({ ...certForm })
  certForm.name = ''
  certForm.issuer = ''
  certForm.date = ''
  showToast('已添加')
}

async function deleteCert(id) {
  await profileStore.deleteCertificate(id)
}
</script>

<style scoped>
.profile-editor { padding-bottom: 20px; }
.list-item { padding: 10px 0; border-bottom: 1px solid #f5f5f5; }
.list-item:last-child { border-bottom: none; }
.item-header { display: flex; align-items: center; gap: 8px; margin-bottom: 4px; }
.item-time { font-size: 12px; color: #999; margin-bottom: 4px; }
.item-desc { font-size: 13px; color: #666; line-height: 1.5; margin-bottom: 4px; }
.skills-grid { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 12px; }
.type-selector { padding: 8px 16px; display: flex; align-items: center; gap: 12px; }
.type-label { font-size: 13px; color: #666; white-space: nowrap; }
</style>
