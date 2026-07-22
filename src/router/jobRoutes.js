export function registerJobRoutes(router) {
  router.addRoute({
    path: '/jobs',
    name: 'JobExplore',
    component: () => import('@/views/JobExplore.vue'),
    meta: { title: '岗位探索', icon: 'search' }
  })
  router.addRoute({
    path: '/job/:title',
    name: 'JobDetail',
    component: () => import('@/views/JobDetail.vue'),
    meta: { title: '岗位详情', icon: 'description' }
  })
}
