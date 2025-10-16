// 动态获取视图模块路由配置的工具函数

/**
 * 动态获取指定模块的路由配置
 * @param {string} moduleName - 模块名称（public, project-config, code-review）
 * @returns {Promise<Array>} 路由配置数组
 */
export const getModuleRoutes = async (moduleName) => {
  try {
    const moduleRoutes = await import(`./${moduleName}/routes.js`)
    return Array.isArray(moduleRoutes.default) ? moduleRoutes.default : []
  } catch (error) {
    console.error(`获取${moduleName}模块路由配置失败:`, error)
    return []
  }
}

/**
 * 动态获取所有模块的路由配置
 * @returns {Promise<Array>} 所有路由配置的合并数组
 */
export const getAllRoutes = async () => {
  let allRoutes = []
  
  try {
    // 获取公共模块路由
    const publicRoutes = await getModuleRoutes('public')
    allRoutes = allRoutes.concat(publicRoutes)
    
    // 获取项目配置模块路由
    const projectConfigRoutes = await getModuleRoutes('project-config')
    allRoutes = allRoutes.concat(projectConfigRoutes)
    
    // 获取代码审查模块路由
    const codeReviewRoutes = await getModuleRoutes('code-review')
    allRoutes = allRoutes.concat(codeReviewRoutes)
  } catch (error) {
    console.error('获取所有模块路由配置失败:', error)
  }
  
  return allRoutes
}

/**
 * 动态获取路由配置信息（包括模块分类）
 * @returns {Promise<Object>} 包含模块分类的路由配置信息
 */
export const getRoutesInfo = async () => {
  try {
    const publicRoutes = await getModuleRoutes('public')
    const projectConfigRoutes = await getModuleRoutes('project-config')
    const codeReviewRoutes = await getModuleRoutes('code-review')
    
    return {
      modules: {
        public: publicRoutes,
        'project-config': projectConfigRoutes,
        'code-review': codeReviewRoutes
      },
      all: [
        ...publicRoutes,
        ...projectConfigRoutes,
        ...codeReviewRoutes
      ]
    }
  } catch (error) {
    console.error('获取路由配置信息失败:', error)
    return {
      modules: {},
      all: []
    }
  }
}