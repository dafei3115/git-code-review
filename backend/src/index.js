const express = require('express')
const cors = require('cors')
const dotenv = require('dotenv')
const path = require('path')
const fs = require('fs-extra')

// 加载环境变量
dotenv.config()

// 创建Express应用
const app = express()

// 中间件
app.use(cors())
app.use(express.json())
app.use(express.urlencoded({ extended: true }))

// 确保数据目录存在
const dataDir = process.env.DATA_DIR || path.join(__dirname, '../data')
const projectsDir = path.join(dataDir, 'projects')
const resultsDir = path.join(dataDir, 'results')

const initializeDirectories = async () => {
  try {
    await fs.ensureDir(dataDir)
    await fs.ensureDir(projectsDir)
    await fs.ensureDir(resultsDir)
    
    // 确保projects.json文件存在
    const projectsFilePath = path.join(dataDir, 'projects.json')
    if (!await fs.pathExists(projectsFilePath)) {
      await fs.writeJSON(projectsFilePath, { projects: [] }, { spaces: 2 })
    }
    
    console.log('数据目录初始化成功')
  } catch (error) {
    console.error('数据目录初始化失败:', error)
    process.exit(1)
  }
}

// 导入路由
const projectRoutes = require('./routes/projectRoutes')
const reviewRoutes = require('./routes/reviewRoutes')
const resultRoutes = require('./routes/resultRoutes')

// 使用路由
app.use('/projects', projectRoutes)
app.use('/review', reviewRoutes)
app.use('/review-results', resultRoutes)

// 健康检查接口
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

// 启动服务器
const PORT = process.env.PORT || 3001

const startServer = async () => {
  try {
    await initializeDirectories()
    
    app.listen(PORT, () => {
      console.log(`服务器运行在 http://localhost:${PORT}`)
    })
  } catch (error) {
    console.error('服务器启动失败:', error)
    process.exit(1)
  }
}

startServer()

// 错误处理
process.on('uncaughtException', (error) => {
  console.error('未捕获的异常:', error)
})

process.on('unhandledRejection', (reason, promise) => {
  console.error('未处理的Promise拒绝:', reason)
})