// 项目配置模块路由配置
export default [
  {
    path: '/project-list',
    name: 'ProjectList',
    component: () => import('./ProjectList.vue')
  },
  {
    path: '/project-config/:id?',
    name: 'ProjectConfig',
    component: () => import('./ProjectConfig.vue')
  }
]