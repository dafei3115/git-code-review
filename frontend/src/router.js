import { createRouter, createWebHistory } from 'vue-router'

// 合并所有路由
const routes = [
  {
    path: '/',
    redirect: '/project-list'
  },
  // 使用import.meta.glob动态获取所有子模块的路由配置
  ...(() => {
    const modulesRoutes = []
    
    // 创建一个上下文，匹配views目录下的所有routes.js文件
    const modules = import.meta.glob('./views/**/routes.js', { eager: true })
    
    // 遍历所有匹配的文件并导入路由配置
    Object.values(modules).forEach(module => {
      try {
        const moduleRoutes = module.default || []
        if (Array.isArray(moduleRoutes)) {
          modulesRoutes.push(...moduleRoutes)
        }
      } catch (error) {
        console.error(`加载路由配置文件失败:`, error)
      }
    })
    
    return modulesRoutes
  })()
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

// 路由守卫
router.beforeEach((to, from, next) => {
  const isLoggedIn = localStorage.getItem('token') !== null
  
  if (to.path !== '/login' && !isLoggedIn) {
    next('/login')
  } else {
    next()
  }
})

export default router