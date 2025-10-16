// 验证器工具模块

/**
 * 验证项目配置
 * @param {Object} projectConfig - 项目配置对象
 * @returns {string|null} - 错误信息，如果没有错误则返回null
 */
const validateProjectConfig = (projectConfig) => {
  if (!projectConfig) {
    return '项目配置不能为空'
  }
  
  // 验证项目名称
  if (!projectConfig.name || projectConfig.name.trim() === '') {
    return '项目名称不能为空'
  }
  console.log(projectConfig, 'projectConfig.repoType')
  // 验证仓库地址
  if (!projectConfig.repoUrl || typeof projectConfig.repoUrl !== 'string' || projectConfig.repoUrl.trim() === '') {
    return '仓库地址不能为空'
  }
  
  // 验证仓库类型
  if (!projectConfig.repoType || !['GitHub', 'GitLab'].includes(projectConfig.repoType)) {
    return '仓库类型无效，必须是git、svn或local'
  }
  
  // // 验证技术栈
  // if (!projectConfig.techStack || !Array.isArray(projectConfig.techStack) || projectConfig.techStack.length === 0) {
  //   return '请至少选择一种技术栈'
  // }
  
  // // 验证文件扩展名
  // if (projectConfig.fileExtensions && !Array.isArray(projectConfig.fileExtensions)) {
  //   return '文件扩展名必须是数组格式'
  // }
  
  // // 验证忽略目录
  // if (projectConfig.ignoreDirs && !Array.isArray(projectConfig.ignoreDirs)) {
  //   return '忽略目录必须是数组格式'
  // }
  
  // // 验证DeepSeek API Key（如果提供）
  // if (projectConfig.deepseekApiKey && typeof projectConfig.deepseekApiKey !== 'string') {
  //   return 'DeepSeek API Key必须是字符串格式'
  // }
  
  // // 验证报告配置
  // if (projectConfig.reportConfig && typeof projectConfig.reportConfig !== 'object') {
  //   return '报告配置必须是对象格式'
  // }
  
  return null
}

/**
 * 验证审查请求
 * @param {Object} reviewRequest - 审查请求对象
 * @returns {string|null} - 错误信息，如果没有错误则返回null
 */
const validateReviewRequest = (reviewRequest) => {
  if (!reviewRequest) {
    return '审查请求不能为空'
  }
  
  // 验证开始时间
  if (reviewRequest.startTime) {
    const startTime = new Date(reviewRequest.startTime)
    if (isNaN(startTime.getTime())) {
      return '开始时间格式无效'
    }
  }
  
  // 验证结束时间
  if (reviewRequest.endTime) {
    const endTime = new Date(reviewRequest.endTime)
    if (isNaN(endTime.getTime())) {
      return '结束时间格式无效'
    }
  }
  
  // 验证开始时间不能晚于结束时间
  if (reviewRequest.startTime && reviewRequest.endTime) {
    const startTime = new Date(reviewRequest.startTime)
    const endTime = new Date(reviewRequest.endTime)
    if (startTime > endTime) {
      return '开始时间不能晚于结束时间'
    }
  }
  
  return null
}

/**
 * 验证分页参数
 * @param {Object} paginationParams - 分页参数对象
 * @returns {Object} - 验证后的分页参数
 */
const validatePaginationParams = (paginationParams) => {
  let { page = 1, pageSize = 10 } = paginationParams
  
  // 验证页码
  page = parseInt(page)
  if (isNaN(page) || page < 1) {
    page = 1
  }
  
  // 验证每页数量
  pageSize = parseInt(pageSize)
  if (isNaN(pageSize) || pageSize < 1 || pageSize > 100) {
    pageSize = 10
  }
  
  return { page, pageSize }
}

/**
 * 验证日期范围
 * @param {string} startDate - 开始日期
 * @param {string} endDate - 结束日期
 * @returns {Object|null} - 验证后的日期对象，如果无效则返回null
 */
const validateDateRange = (startDate, endDate) => {
  const result = { valid: true, start: null, end: null, error: null }
  
  // 验证开始日期
  if (startDate) {
    const start = new Date(startDate)
    if (isNaN(start.getTime())) {
      result.valid = false
      result.error = '开始日期格式无效'
      return result
    }
    result.start = start
  }
  
  // 验证结束日期
  if (endDate) {
    const end = new Date(endDate)
    if (isNaN(end.getTime())) {
      result.valid = false
      result.error = '结束日期格式无效'
      return result
    }
    result.end = end
  }
  
  // 验证开始日期不能晚于结束日期
  if (result.start && result.end && result.start > result.end) {
    result.valid = false
    result.error = '开始日期不能晚于结束日期'
    return result
  }
  
  return result
}

/**
 * 验证API Key
 * @param {string} apiKey - API Key
 * @returns {string|null} - 错误信息，如果没有错误则返回null
 */
const validateApiKey = (apiKey) => {
  if (!apiKey) {
    return 'API Key不能为空'
  }
  
  if (typeof apiKey !== 'string') {
    return 'API Key必须是字符串格式'
  }
  
  if (apiKey.trim().length < 10) {
    return 'API Key格式无效'
  }
  
  return null
}

/**
 * 验证文件路径
 * @param {string} filePath - 文件路径
 * @returns {string|null} - 错误信息，如果没有错误则返回null
 */
const validateFilePath = (filePath) => {
  if (!filePath) {
    return '文件路径不能为空'
  }
  
  if (typeof filePath !== 'string') {
    return '文件路径必须是字符串格式'
  }
  
  // 检查是否包含不允许的字符
  const invalidChars = /[<>"|?*]/
  if (invalidChars.test(filePath)) {
    return '文件路径包含不允许的字符'
  }
  
  return null
}

module.exports = {
  validateProjectConfig,
  validateReviewRequest,
  validatePaginationParams,
  validateDateRange,
  validateApiKey,
  validateFilePath
}