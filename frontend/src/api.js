import axios from 'axios'
import { ElMessage } from 'element-plus'

// 创建axios实例
const api = axios.create({
  baseURL: '/api', // 通过Vite配置的代理转发到后端
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json'
  }
})

// 请求拦截器
api.interceptors.request.use(
  config => {
    // 在发送请求之前做些什么
    const token = localStorage.getItem('token')
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  error => {
    // 对请求错误做些什么
    console.error('Request error:', error)
    return Promise.reject(error)
  }
)

// 响应拦截器
api.interceptors.response.use(
  response => {
    // 对响应数据做点什么
    return response.data
  },
  error => {
    // 对响应错误做点什么
    console.error('Response error:', error)
    
    if (error.response) {
      switch (error.response.status) {
        case 401:
          // 未授权，跳转到登录页面
          localStorage.removeItem('token')
          window.location.href = '/login'
          ElMessage.error('请重新登录')
          break
        case 403:
          ElMessage.error('没有权限执行此操作')
          break
        case 404:
          ElMessage.error('请求的资源不存在')
          break
        case 500:
          ElMessage.error('服务器内部错误')
          break
        default:
          ElMessage.error(error.response.data.message || '请求失败')
      }
    } else if (error.request) {
      ElMessage.error('网络错误，请检查网络连接')
    } else {
      ElMessage.error('请求配置错误')
    }
    
    return Promise.reject(error)
  }
)

// API接口定义
export default {
  // 项目管理
  getProjects: () => api.get('/projects'),
  getProjectDetail: (id) => api.get(`/projects/${id}`),
  createProject: (data) => api.post('/projects', data),
  updateProject: (id, data) => api.put(`/projects/${id}`, data),
  deleteProject: (id) => api.delete(`/projects/${id}`),
  
  // 代码审查
  startReview: (projectId, data) => api.post(`/review/${projectId}`, data),
  
  // 审查结果
  getReviewResults: () => api.get('/review-results'),
  getReviewDetail: (projectId, startTime, endTime) => 
    api.get(`/review-results/${projectId}/${startTime}/${endTime}`)
}