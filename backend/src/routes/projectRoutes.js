const express = require('express')
const router = express.Router()
const ProjectService = require('../services/ProjectService')
const { validateProjectConfig } = require('../utils/validators')

// 获取项目列表
router.get('/', async (req, res) => {
  try {
    const projects = await ProjectService.getProjects()
    res.json({ success: true, data: projects })
  } catch (error) {
    res.status(500).json({ success: false, message: error.message })
  }
})

// 获取项目详情
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params
    const project = await ProjectService.getProjectById(id)
    if (!project) {
      return res.status(404).json({ success: false, message: '项目不存在' })
    }
    res.json({ success: true, data: project })
  } catch (error) {
    res.status(500).json({ success: false, message: error.message })
  }
})

// 创建项目
router.post('/', async (req, res) => {
  try {
    const projectData = req.body
    
    // 验证项目配置
    const validationError = validateProjectConfig(projectData)
    if (validationError) {
      return res.status(400).json({ success: false, message: validationError })
    }
    
    const project = await ProjectService.createProject(projectData)
    res.status(201).json({ success: true, data: project })
  } catch (error) {
    res.status(500).json({ success: false, message: error.message })
  }
})

// 更新项目
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params
    const projectData = req.body
    
    // 验证项目配置
    const validationError = validateProjectConfig(projectData)
    if (validationError) {
      return res.status(400).json({ success: false, message: validationError })
    }
    
    const project = await ProjectService.updateProject(id, projectData)
    if (!project) {
      return res.status(404).json({ success: false, message: '项目不存在' })
    }
    res.json({ success: true, data: project })
  } catch (error) {
    res.status(500).json({ success: false, message: error.message })
  }
})

// 删除项目
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params
    const success = await ProjectService.deleteProject(id)
    if (!success) {
      return res.status(404).json({ success: false, message: '项目不存在' })
    }
    res.json({ success: true, message: '项目删除成功' })
  } catch (error) {
    res.status(500).json({ success: false, message: error.message })
  }
})

module.exports = router