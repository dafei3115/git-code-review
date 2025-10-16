const express = require('express')
const router = express.Router()
const ProjectService = require('../services/ProjectService')
const ReviewService = require('../services/ReviewService')
const { validateReviewRequest } = require('../utils/validators')

// 执行代码审查
router.post('/:projectId', async (req, res) => {
  try {
    const { projectId } = req.params
    const { startTime, endTime } = req.body
    
    // 验证请求参数
    const validationError = validateReviewRequest({ startTime, endTime })
    if (validationError) {
      return res.status(400).json({ success: false, message: validationError })
    }
    
    // 获取项目配置
    const project = await ProjectService.getProjectById(projectId)
    if (!project) {
      return res.status(404).json({ success: false, message: '项目不存在' })
    }
    
    // 检查是否配置了DeepSeek API Key
    // if (!project.deepseekApiKey) {
    //   return res.status(400).json({ success: false, message: '请配置DeepSeek API Key' })
    // }
    
    // 异步执行代码审查
    ReviewService.performCodeReview(project, startTime, endTime)
      .then(result => {
        console.log('代码审查完成:', result)
        // 这里可以添加审查完成后的回调逻辑，如通知等
      })
      .catch(error => {
        console.error('代码审查失败:', error)
        // 这里可以添加错误处理逻辑，如通知管理员等
      })
    
    // 立即返回，告知客户端审查已开始
    res.json({
      success: true,
      message: '代码审查已开始，请稍后查看结果',
      data: {
        projectId,
        startTime,
        endTime
      }
    })
  } catch (error) {
    res.status(500).json({ success: false, message: error.message })
  }
})

// 获取审查进度（轮询接口）
router.get('/:projectId/progress', async (req, res) => {
  try {
    const { projectId } = req.params
    
    // 检查项目是否存在
    const project = await ProjectService.getProjectById(projectId)
    if (!project) {
      return res.status(404).json({ success: false, message: '项目不存在' })
    }
    
    // 获取审查进度
    const progress = await ReviewService.getReviewProgress(projectId)
    
    res.json({
      success: true,
      data: progress
    })
  } catch (error) {
    res.status(500).json({ success: false, message: error.message })
  }
})

module.exports = router