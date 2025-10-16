const fs = require('fs-extra')
const path = require('path')

// 数据目录路径
const dataDir = process.env.DATA_DIR || path.join(__dirname, '../../../data')
const projectsFilePath = path.join(dataDir, 'projects.json')
const projectsDir = path.join(dataDir, 'projects')

class ProjectService {
  // 获取所有项目列表
  static async getProjects() {
    try {
      const projectsData = await fs.readJSON(projectsFilePath)
      return projectsData.projects || []
    } catch (error) {
      console.error('获取项目列表失败:', error)
      throw new Error('获取项目列表失败')
    }
  }

  // 根据ID获取项目详情
  static async getProjectById(id) {
    try {
      const projects = await this.getProjects()
      return projects.find(project => project.id === id)
    } catch (error) {
      console.error('获取项目详情失败:', error)
      throw new Error('获取项目详情失败')
    }
  }

  // 创建新项目
  static async createProject(projectData) {
    try {
      const projects = await this.getProjects()
      
      // 生成唯一ID
      const id = `project_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`
      
      const newProject = {
        ...projectData,
        id,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
      
      // 添加到项目列表
      projects.push(newProject)
      
      // 保存项目列表
      await fs.writeJSON(projectsFilePath, { projects }, { spaces: 2 })
      
      // 创建项目配置目录
      const projectDir = path.join(projectsDir, id)
      await fs.ensureDir(projectDir)
      
      // 保存项目配置到单独的文件
      const projectConfigPath = path.join(projectDir, 'config.json')
      await fs.writeJSON(projectConfigPath, newProject, { spaces: 2 })
      
      return newProject
    } catch (error) {
      console.error('创建项目失败:', error)
      throw new Error('创建项目失败')
    }
  }

  // 更新项目
  static async updateProject(id, projectData) {
    try {
      let projects = await this.getProjects()
      const projectIndex = projects.findIndex(project => project.id === id)
      
      if (projectIndex === -1) {
        return null
      }
      
      // 更新项目信息
      const updatedProject = {
        ...projects[projectIndex],
        ...projectData,
        updatedAt: new Date().toISOString()
      }
      
      projects[projectIndex] = updatedProject
      
      // 保存项目列表
      await fs.writeJSON(projectsFilePath, { projects }, { spaces: 2 })
      
      // 更新项目配置文件
      const projectDir = path.join(projectsDir, id)
      const projectConfigPath = path.join(projectDir, 'config.json')
      await fs.writeJSON(projectConfigPath, updatedProject, { spaces: 2 })
      
      return updatedProject
    } catch (error) {
      console.error('更新项目失败:', error)
      throw new Error('更新项目失败')
    }
  }

  // 删除项目
  static async deleteProject(id) {
    try {
      let projects = await this.getProjects()
      const projectIndex = projects.findIndex(project => project.id === id)
      
      if (projectIndex === -1) {
        return false
      }
      
      // 从列表中移除
      projects.splice(projectIndex, 1)
      
      // 保存更新后的项目列表
      await fs.writeJSON(projectsFilePath, { projects }, { spaces: 2 })
      
      // 删除项目目录
      const projectDir = path.join(projectsDir, id)
      await fs.remove(projectDir)
      
      // 同时删除与该项目相关的审查结果
      const resultsDir = path.join(dataDir, 'results')
      const projectResultsDir = path.join(resultsDir, id)
      if (await fs.pathExists(projectResultsDir)) {
        await fs.remove(projectResultsDir)
      }
      
      return true
    } catch (error) {
      console.error('删除项目失败:', error)
      throw new Error('删除项目失败')
    }
  }

  // 验证项目配置
  static validateConfig(config) {
    const errors = []
    
    if (!config.name || typeof config.name !== 'string' || config.name.trim() === '') {
      errors.push('项目名称不能为空')
    }
    
    if (!config.repoUrl || typeof config.repoUrl !== 'string' || config.repoUrl.trim() === '') {
      errors.push('仓库地址不能为空')
    }
    
    if (!config.repoType || !['git', 'svn', 'local'].includes(config.repoType)) {
      errors.push('仓库类型无效')
    }
    
    if (!config.techStack || !Array.isArray(config.techStack) || config.techStack.length === 0) {
      errors.push('请至少选择一种技术栈')
    }
    
    return errors.length > 0 ? errors.join('; ') : null
  }
}

module.exports = ProjectService