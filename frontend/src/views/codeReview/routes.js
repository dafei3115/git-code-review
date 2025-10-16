// 代码审查模块路由配置
export default [
  {
    path: '/review-code/:id',
    name: 'ReviewCode',
    component: () => import('./ReviewCode.vue')
  },
  {
    path: '/review-results',
    name: 'ReviewResults',
    component: () => import('./ReviewResults.vue')
  },
  {
    path: '/review-detail/:projectId/:startTime/:endTime',
    name: 'ReviewDetail',
    component: () => import('./ReviewDetail.vue')
  }
]