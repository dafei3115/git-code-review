<template>
  <div>
    <div style="margin-bottom: 20px;">
      <h2>审查详情</h2>
    </div>
    
    <el-card v-if="reviewDetail">
      <div style="margin-bottom: 20px;">
        <h3>审查概览</h3>
        <el-descriptions border :column="2" :size="'medium'">
          <el-descriptions-item label="项目ID">{{ reviewDetail.projectId }}</el-descriptions-item>
          <el-descriptions-item label="项目名称">{{ projectName }}</el-descriptions-item>
          <el-descriptions-item label="开始时间">{{ formatDate(reviewDetail.startTime) }}</el-descriptions-item>
          <el-descriptions-item label="结束时间">{{ formatDate(reviewDetail.endTime) }}</el-descriptions-item>
          <el-descriptions-item label="审查结果">
            <el-tag :type="reviewDetail.status === 'success' ? 'success' : 'danger'">
              {{ reviewDetail.status === 'success' ? '通过' : '失败' }}
            </el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="总文件数">{{ reviewDetail.totalFiles }}</el-descriptions-item>
          <el-descriptions-item label="通过文件数">{{ reviewDetail.passedFiles }}</el-descriptions-item>
          <el-descriptions-item label="失败文件数">{{ reviewDetail.failedFiles }}</el-descriptions-item>
        </el-descriptions>
      </div>
      
      <div style="margin-top: 30px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
          <h3>文件审查详情</h3>
          <el-select v-model="fileStatusFilter" placeholder="筛选文件状态">
            <el-option label="全部" value=""></el-option>
            <el-option label="通过" value="success"></el-option>
            <el-option label="失败" value="failure"></el-option>
          </el-select>
        </div>
        
        <el-table :data="filteredFiles" stripe style="width: 100%">
          <el-table-column prop="filePath" label="文件路径" min-width="400">
            <template #default="scope">
              <el-link :underline="false" @click="toggleFileDetails(scope.row)">{{ scope.row.filePath }}</el-link>
            </template>
          </el-table-column>
          <el-table-column prop="status" label="状态" width="100">
            <template #default="scope">
              <el-tag :type="scope.row.status === 'success' ? 'success' : 'danger'">
                {{ scope.row.status === 'success' ? '通过' : '失败' }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column label="问题数" width="100">
            <template #default="scope">
              {{ (scope.row.issues && scope.row.issues.length) || 0 }}
            </template>
          </el-table-column>
        </el-table>
      </div>
      
      <!-- 文件问题详情 -->
      <div v-if="selectedFile" style="margin-top: 30px;">
        <h3>问题详情 - {{ selectedFile.filePath }}</h3>
        <div v-if="selectedFile.issues && selectedFile.issues.length > 0">
          <el-table :data="selectedFile.issues" style="width: 100%">
            <el-table-column prop="line" label="行号" width="100" />
            <el-table-column prop="column" label="列号" width="100" />
            <el-table-column prop="severity" label="严重程度" width="120">
              <template #default="scope">
                <el-tag :type="getSeverityType(scope.row.severity)">
                  {{ scope.row.severity }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="message" label="问题描述" />
            <el-table-column prop="rule" label="违反规则" width="200" />
          </el-table>
        </div>
        <div v-else class="no-issues">
          未发现问题
        </div>
      </div>
    </el-card>
    
    <div v-else class="loading">
      <el-alert title="加载中..." type="info" show-icon />
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { ElMessage } from 'element-plus'
import dayjs from 'dayjs'
import api from '../../api'

const route = useRoute()
const projectId = route.params.projectId
const startTime = route.params.startTime
const endTime = route.params.endTime

const reviewDetail = ref(null)
const projectName = ref('')
const fileStatusFilter = ref('')
const selectedFile = ref(null)

// 格式化日期
const formatDate = (dateString) => {
  if (!dateString) return ''
  return dayjs(dateString).format('YYYY-MM-DD HH:mm:ss')
}

// 获取严重程度对应的标签类型
const getSeverityType = (severity) => {
  switch (severity.toLowerCase()) {
    case 'critical':
    case 'error':
      return 'danger'
    case 'warning':
      return 'warning'
    case 'info':
      return 'info'
    default:
      return 'success'
  }
}

// 获取审查详情
const getReviewDetail = async () => {
  try {
    const response = await api.getReviewDetail(projectId, startTime, endTime)
    reviewDetail.value = response.data
    
    // 获取项目名称
    const projectResponse = await api.getProjectDetail(projectId)
    projectName.value = projectResponse.data.name
  } catch (error) {
    ElMessage.error('获取审查详情失败')
    console.error('Get review detail error:', error)
  }
}

// 过滤文件
const filteredFiles = ref([])

// 切换文件详情显示
const toggleFileDetails = (file) => {
  if (selectedFile.value && selectedFile.value.filePath === file.filePath) {
    selectedFile.value = null
  } else {
    selectedFile.value = file
  }
}

// 监听文件状态筛选变化
const watchFileStatusFilter = () => {
  if (!reviewDetail.value || !reviewDetail.value.details) {
    filteredFiles.value = []
    return
  }
  
  if (!fileStatusFilter.value) {
    filteredFiles.value = reviewDetail.value.details
  } else {
    filteredFiles.value = reviewDetail.value.details.filter(file => 
      file.status === fileStatusFilter.value
    )
  }
}

onMounted(() => {
  getReviewDetail()
  
  // 模拟数据加载后的筛选
  setTimeout(() => {
    watchFileStatusFilter()
  }, 1000)
  
  // 监听筛选条件变化
  const watcher = setInterval(() => {
    if (reviewDetail.value) {
      watchFileStatusFilter()
      clearInterval(watcher)
    }
  }, 500)
})
</script>

<style scoped>
.no-issues {
  text-align: center;
  padding: 20px;
  color: #606266;
}

.loading {
  padding: 40px;
}
</style>