<template>
  <div>
    <div style="margin-bottom: 20px;">
      <h2>审查结果列表</h2>
    </div>
    
    <el-card>
      <template #header>
        <div class="card-header">
          <span>审查结果</span>
          <div style="float: right; display: flex; gap: 10px;">
            <el-input
              v-model="searchProjectId"
              placeholder="搜索项目ID"
              style="width: 200px;"
              clearable
            />
            <el-date-picker
              v-model="dateRange"
              type="daterange"
              range-separator="至"
              start-placeholder="开始日期"
              end-placeholder="结束日期"
              value-format="YYYY-MM-DD"
              style="width: 300px;"
            />
            <el-button type="primary" @click="searchResults">搜索</el-button>
          </div>
        </div>
      </template>
      
      <el-table :data="filteredResults" stripe style="width: 100%">
        <el-table-column prop="projectId" label="项目ID" width="180" />
        <el-table-column prop="projectName" label="项目名称" width="200" />
        <el-table-column prop="startTime" label="开始时间" width="200">
          <template #default="scope">
            {{ formatDate(scope.row.startTime) }}
          </template>
        </el-table-column>
        <el-table-column prop="endTime" label="结束时间" width="200">
          <template #default="scope">
            {{ formatDate(scope.row.endTime) }}
          </template>
        </el-table-column>
        <el-table-column prop="status" label="审查结果" width="100">
          <template #default="scope">
            <el-tag :type="scope.row.status === 'success' ? 'success' : 'danger'">
              {{ scope.row.status === 'success' ? '通过' : '失败' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="totalFiles" label="总文件数" width="100" />
        <el-table-column prop="passedFiles" label="通过文件数" width="120" />
        <el-table-column prop="failedFiles" label="失败文件数" width="120" />
        <el-table-column label="操作" width="120" fixed="right">
          <template #default="scope">
            <el-button type="primary" size="small" @click="viewDetail(scope.row)">查看</el-button>
          </template>
        </el-table-column>
      </el-table>
      
      <div style="margin-top: 20px; display: flex; justify-content: flex-end;">
        <el-pagination
          v-model:current-page="currentPage"
          v-model:page-size="pageSize"
          :page-sizes="[10, 20, 50, 100]"
          layout="total, sizes, prev, pager, next, jumper"
          :total="filteredResults.length"
        />
      </div>
    </el-card>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import dayjs from 'dayjs'
import api from '../../api'

const router = useRouter()
const reviewResults = ref([])
const projectsMap = ref({})
const searchProjectId = ref('')
const dateRange = ref([])
const currentPage = ref(1)
const pageSize = ref(10)

// 格式化日期
const formatDate = (dateString) => {
  if (!dateString) return ''
  return dayjs(dateString).format('YYYY-MM-DD HH:mm:ss')
}

// 获取审查结果列表
const getReviewResults = async () => {
  try {
    const response = await api.getReviewResults()
    reviewResults.value = response?.data?.data ?? []
    
    // 获取所有项目信息并创建映射
    const projectsResponse = await api.getProjects()
    projectsResponse.data.projects.forEach(project => {
      projectsMap.value[project.id] = project.name
    })
    
    // 为每个结果添加项目名称
    reviewResults.value.forEach(result => {
      result.projectName = projectsMap.value[result.projectId] || '未知项目'
    })
  } catch (error) {
    ElMessage.error('获取审查结果列表失败')
    console.error('Get review results error:', error)
  }
}

// 过滤结果
const filteredResults = computed(() => {
  let results = [...reviewResults.value]
  
  // 按项目ID过滤
  if (searchProjectId.value) {
    results = results.filter(result => 
      result.projectId.toLowerCase().includes(searchProjectId.value.toLowerCase())
    )
  }
  
  // 按日期范围过滤
  if (dateRange.value && dateRange.value.length === 2) {
    const startDate = dayjs(dateRange.value[0]).startOf('day')
    const endDate = dayjs(dateRange.value[1]).endOf('day')
    
    results = results.filter(result => {
      const resultDate = dayjs(result.startTime)
      return resultDate.isAfter(startDate.subtract(1, 'day')) && resultDate.isBefore(endDate.add(1, 'day'))
    })
  }
  
  return results
})

// 搜索结果
const searchResults = () => {
  currentPage.value = 1
  // 实际应用中这里应该调用API重新获取数据
}

// 查看详情
const viewDetail = (result) => {
  console.log('查看详情', result)
  router.push({
    name: 'ReviewDetail',
    params: {
      projectId: result.projectId,
      startTime: result.startTime,
      endTime: result.endTime
    }
  })
}

onMounted(() => {
  getReviewResults()
  
  // 默认显示最近30天的数据
  const endDate = dayjs()
  const startDate = endDate.subtract(30, 'day')
  dateRange.value = [startDate.format('YYYY-MM-DD'), endDate.format('YYYY-MM-DD')]
})
</script>

<style scoped>
.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
</style>