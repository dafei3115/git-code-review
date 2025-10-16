// 公共模块路由配置
export default [
  {
    path: '/login',
    name: 'Login',
    component: () => import('./Login.vue')
  }
]