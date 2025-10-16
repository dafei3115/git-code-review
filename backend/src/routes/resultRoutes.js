const express = require('express')
const router = express.Router()
const ResultService = require('../services/ResultService')

// 获取所有审查结果列表
router.get('/', async (req, res) => {
  try {
    const { projectId, startDate, endDate, page = 1, pageSize = 10 } = req.query
    
    const results = await ResultService.getReviewResults({
      projectId,
      startDate,
      endDate,
      page: parseInt(page),
      pageSize: parseInt(pageSize)
    })
    
    res.json({ success: true, data: results })
  } catch (error) {
    res.status(500).json({ success: false, message: error.message })
  }
})

// 获取特定项目的审查结果列表
router.get('/:projectId', async (req, res) => {
  try {
    const { projectId } = req.params
    const { startDate, endDate, page = 1, pageSize = 10 } = req.query
    
    const results = await ResultService.getReviewResultsByProjectId(projectId, {
      startDate,
      endDate,
      page: parseInt(page),
      pageSize: parseInt(pageSize)
    })
    
    res.json({ success: true, data: results })
  } catch (error) {
    res.status(500).json({ success: false, message: error.message })
  }
})

// 获取特定审查结果的详情
router.get('/:projectId/:startTime/:endTime', async (req, res) => {
  try {
    const { projectId, startTime, endTime } = req.params
    
    const result = await ResultService.getReviewDetail(projectId, startTime, endTime)
    if (!result) {
      return res.status(404).json({ success: false, message: '审查结果不存在' })
    }
    
    res.json({ success: true, data: result })
  } catch (error) {
    res.status(500).json({ success: false, message: error.message })
  }
})

// 导出审查结果
router.get('/:projectId/:startTime/:endTime/export', async (req, res) => {
  try {
    const { projectId, startTime, endTime } = req.params
    const { format = 'json' } = req.query
    
    const result = await ResultService.getReviewDetail(projectId, startTime, endTime)
    if (!result) {
      return res.status(404).json({ success: false, message: '审查结果不存在' })
    }
    
    // 根据格式导出结果
    const exportData = await ResultService.exportReviewResult(result, format)
    
    // 设置响应头
    res.setHeader('Content-Type', format === 'json' ? 'application/json' : 'text/plain')
    res.setHeader('Content-Disposition', `attachment; filename="review-result-${projectId}-${startTime.replace(/:/g, '-')}-${endTime.replace(/:/g, '-')}.${format}"`)
    
    res.send(exportData)
  } catch (error) {
    res.status(500).json({ success: false, message: error.message })
  }
})

module.exports = router