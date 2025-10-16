const fs = require('fs-extra')
const path = require('path')
const moment = require('moment')

// 数据目录路径
const dataDir = process.env.DATA_DIR || path.join(__dirname, '../../../data')
const logsDir = path.join(dataDir, 'logs')

// 确保日志目录存在
fs.ensureDirSync(logsDir)

/**
 * 日志记录器
 */
const logger = {
  /**
   * 记录信息日志
   * @param {string} message - 日志消息
   * @param {Object} meta - 附加元数据
   */
  info: (message, meta = {}) => {
    log('info', message, meta)
  },
  
  /**
   * 记录警告日志
   * @param {string} message - 日志消息
   * @param {Object} meta - 附加元数据
   */
  warn: (message, meta = {}) => {
    log('warn', message, meta)
  },
  
  /**
   * 记录错误日志
   * @param {string} message - 日志消息
   * @param {Object} meta - 附加元数据
   */
  error: (message, meta = {}) => {
    log('error', message, meta)
  },
  
  /**
   * 记录调试日志
   * @param {string} message - 日志消息
   * @param {Object} meta - 附加元数据
   */
  debug: (message, meta = {}) => {
    if (process.env.LOG_LEVEL === 'debug') {
      log('debug', message, meta)
    }
  }
}

/**
 * 核心日志记录函数
 * @param {string} level - 日志级别
 * @param {string} message - 日志消息
 * @param {Object} meta - 附加元数据
 */
function log(level, message, meta) {
  const timestamp = moment().format('YYYY-MM-DD HH:mm:ss.SSS')
  const logEntry = {
    timestamp,
    level,
    message,
    meta
  }
  
  // 格式化日志输出
  const logString = JSON.stringify(logEntry) + '\n'
  
  // 输出到控制台
  console[level === 'error' ? 'error' : 'log'](`${timestamp} [${level.toUpperCase()}] ${message}`)
  
  // 写入日志文件
  const logFileName = `${moment().format('YYYY-MM-DD')}.log`
  const logFilePath = path.join(logsDir, logFileName)
  
  fs.appendFile(logFilePath, logString, (err) => {
    if (err) {
      console.error('写入日志文件失败:', err)
    }
  })
}

/**
 * 错误处理工具
 */
const errorHandler = {
  /**
   * 格式化错误响应
   * @param {Error} err - 错误对象
   * @param {string} defaultMessage - 默认错误消息
   * @returns {Object} - 格式化后的错误响应对象
   */
  formatError: (err, defaultMessage = '操作失败') => {
    return {
      success: false,
      message: err.message || defaultMessage,
      error: process.env.NODE_ENV === 'development' ? err.stack : undefined
    }
  },
  
  /**
   * 处理API错误
   * @param {Error} err - 错误对象
   * @param {Response} res - Express响应对象
   * @param {number} statusCode - HTTP状态码
   */
  handleApiError: (err, res, statusCode = 500) => {
    logger.error('API错误:', {
      message: err.message,
      stack: err.stack,
      path: res.req.path,
      method: res.req.method,
      params: res.req.params,
      query: res.req.query
    })
    
    res.status(statusCode).json({
      success: false,
      message: process.env.NODE_ENV === 'development' ? err.message : '服务器内部错误',
      error: process.env.NODE_ENV === 'development' ? err.stack : undefined
    })
  }
}

/**
 * 文件处理工具
 */
const fileUtils = {
  /**
   * 安全地读取JSON文件
   * @param {string} filePath - 文件路径
   * @param {*} defaultValue - 默认值
   * @returns {*} - 文件内容或默认值
   */
  safeReadJson: async (filePath, defaultValue = null) => {
    try {
      if (!await fs.pathExists(filePath)) {
        return defaultValue
      }
      return await fs.readJSON(filePath)
    } catch (error) {
      logger.error(`读取JSON文件失败: ${filePath}`, { error: error.message })
      return defaultValue
    }
  },
  
  /**
   * 安全地写入JSON文件
   * @param {string} filePath - 文件路径
   * @param {*} data - 要写入的数据
   * @returns {boolean} - 操作是否成功
   */
  safeWriteJson: async (filePath, data) => {
    try {
      await fs.ensureDir(path.dirname(filePath))
      await fs.writeJSON(filePath, data, { spaces: 2 })
      return true
    } catch (error) {
      logger.error(`写入JSON文件失败: ${filePath}`, { error: error.message })
      return false
    }
  },
  
  /**
   * 安全地删除文件
   * @param {string} filePath - 文件路径
   * @returns {boolean} - 操作是否成功
   */
  safeRemove: async (filePath) => {
    try {
      if (await fs.pathExists(filePath)) {
        await fs.remove(filePath)
      }
      return true
    } catch (error) {
      logger.error(`删除文件失败: ${filePath}`, { error: error.message })
      return false
    }
  }
}

/**
 * 字符串处理工具
 */
const stringUtils = {
  /**
   * 生成唯一ID
   * @param {string} prefix - ID前缀
   * @returns {string} - 唯一ID
   */
  generateId: (prefix = 'id') => {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  },
  
  /**
   * 截断字符串
   * @param {string} str - 原始字符串
   * @param {number} maxLength - 最大长度
   * @param {string} suffix - 后缀
   * @returns {string} - 截断后的字符串
   */
  truncate: (str, maxLength = 100, suffix = '...') => {
    if (!str || str.length <= maxLength) {
      return str
    }
    return str.substring(0, maxLength) + suffix
  },
  
  /**
   * 转义特殊字符
   * @param {string} str - 原始字符串
   * @returns {string} - 转义后的字符串
   */
  escapeSpecialChars: (str) => {
    if (!str) return str
    return str.replace(/[<>&"']/g, char => {
      switch (char) {
        case '<': return '&lt;'
        case '>': return '&gt;'
        case '&': return '&amp;'
        case '"': return '&quot;'
        case "'": return '&#39;'
        default: return char
      }
    })
  }
}

/**
 * 日期时间工具
 */
const dateUtils = {
  /**
   * 格式化日期时间
   * @param {Date|string} date - 日期对象或字符串
   * @param {string} format - 格式化模板
   * @returns {string} - 格式化后的日期字符串
   */
  format: (date, format = 'YYYY-MM-DD HH:mm:ss') => {
    if (!date) return ''
    return moment(date).format(format)
  },
  
  /**
   * 获取当前日期时间
   * @param {string} format - 格式化模板
   * @returns {string} - 当前日期时间字符串
   */
  now: (format = 'YYYY-MM-DD HH:mm:ss') => {
    return moment().format(format)
  },
  
  /**
   * 计算日期差
   * @param {Date|string} start - 开始日期
   * @param {Date|string} end - 结束日期
   * @param {string} unit - 单位
   * @returns {number} - 日期差
   */
  diff: (start, end, unit = 'days') => {
    return moment(end).diff(moment(start), unit)
  }
}

/**
 * 数组工具
 */
const arrayUtils = {
  /**
   * 分页处理数组
   * @param {Array} array - 原始数组
   * @param {number} page - 页码
   * @param {number} pageSize - 每页数量
   * @returns {Object} - 分页结果
   */
  paginate: (array, page = 1, pageSize = 10) => {
    const total = array.length
    const start = (page - 1) * pageSize
    const end = start + pageSize
    
    return {
      data: array.slice(start, end),
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize)
    }
  },
  
  /**
   * 去重数组
   * @param {Array} array - 原始数组
   * @param {string} key - 去重键（对象数组时使用）
   * @returns {Array} - 去重后的数组
   */
  unique: (array, key = null) => {
    if (!key) {
      return [...new Set(array)]
    }
    
    const seen = new Set()
    return array.filter(item => {
      const value = item[key]
      if (seen.has(value)) {
        return false
      }
      seen.add(value)
      return true
    })
  }
}

module.exports = {
  logger,
  errorHandler,
  fileUtils,
  stringUtils,
  dateUtils,
  arrayUtils
}