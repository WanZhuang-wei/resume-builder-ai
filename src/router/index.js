import { createRouter, createWebHashHistory } from 'vue-router'
import { metrics } from '@/utils/metrics'

const routes = [
  { path: '/', redirect: '/dashboard' },
  { path: '/dashboard', name: 'Dashboard', component: () => import('@/views/Dashboard.vue'), meta: { title: '首页', icon: 'home-o' } },
  { path: '/jobs', name: 'JobExplore', component: () => import('@/views/JobExplore.vue'), meta: { title: '岗位', icon: 'search' } },
  { path: '/profile', name: 'ProfileEditor', component: () => import('@/views/ProfileEditor.vue'), meta: { title: '个人资料', icon: 'contact' } },
  { path: '/resume', name: 'ResumeBuilder', component: () => import('@/views/ResumeBuilder.vue'), meta: { title: '简历生成', icon: 'description' } },
  { path: '/chat', name: 'AiChat', component: () => import('@/views/AiChat.vue'), meta: { title: '问答助手', icon: 'chat-o' } },
  { path: '/analyze', name: 'JobAnalyzer', component: () => import('@/views/JobAnalyzer.vue'), meta: { title: '岗位分析', icon: 'search' } },
  { path: '/share', name: 'ShareProfile', component: () => import('@/views/ShareProfile.vue'), meta: { title: '分享简历', icon: 'share-o' } },
  { path: '/manage/:id', name: 'ShareManage', component: () => import('@/views/ShareManage.vue'), meta: { title: '分享管理', icon: 'setting-o' } },
  { path: '/settings', name: 'Settings', component: () => import('@/views/Settings.vue'), meta: { title: '设置', icon: 'setting-o' } },
  { path: '/collect', name: 'JobCollector', component: () => import('@/views/JobCollector.vue'), meta: { title: '岗位采集', icon: 'photograph' } },
  { path: '/import', name: 'DocumentUpload', component: () => import('@/views/DocumentUpload.vue'), meta: { title: '导入文档', icon: 'file-o' } },
  { path: '/hr/:data', name: 'HrView', component: () => import('@/pages/HrViewPage.vue'), meta: { public: true } },
  { path: '/job/:title', name: 'JobDetail', component: () => import('@/views/JobDetail.vue'), meta: { title: '职位详情', icon: 'description' } },
]

const router = createRouter({
  history: createWebHashHistory(),
  routes
})

router.beforeEach((to, from, next) => {
  to.meta._startTime = performance.now()
  next()
})

router.afterEach((to, from) => {
  const startTime = to.meta._startTime
  if (startTime) {
    const duration = performance.now() - startTime
    metrics.recordRouteTransition({
      from: from?.path || '',
      to: to.path,
      duration
    })
  }
})

export default router

