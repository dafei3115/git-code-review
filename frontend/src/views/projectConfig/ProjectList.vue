<template>
  <div>
    <div style="margin-bottom: 20px; display: flex; justify-content: space-between; align-items: center;">
      <h2>项目列表</h2>
      <el-button type="primary" @click="addProject">新增项目</el-button>
    </div>
    
    <el-card>
      <template #header>
        <div class="card-header">
          <span>项目信息</span>
          <el-input
            v-model="searchKeyword"
            placeholder="搜索项目名称"
            style="width: 300px; float: right;"
            clearable
          />
        </div>
      </template>
      
      <el-table :data="filteredProjects" stripe style="width: 100%">
        <el-table-column prop="id" label="项目ID" width="180" />
        <el-table-column prop="name" label="项目名称">
          <template #default="scope">
            <el-link :underline="false" @click="editProject(scope.row.id)">{{ scope.row.name }}</el-link>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="200" fixed="right">
          <template #default="scope">
            <el-button type="primary" size="small" @click="editProject(scope.row.id)">编辑</el-button>
            <el-button type="success" size="small" @click="reviewCode(scope.row.id)">审查</el-button>
            <el-button type="danger" size="small" @click="deleteProject(scope.row.id)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
      
      <div style="margin-top: 20px; display: flex; justify-content: flex-end;">
        <el-pagination
          v-model:current-page="currentPage"
          v-model:page-size="pageSize"
          :page-sizes="[10, 20, 50, 100]"
          layout="total, sizes, prev, pager, next, jumper"
          :total="filteredProjects.length"
        />
      </div>
    </el-card>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import api from '../../api'

const router = useRouter()
const projects = ref([])
const searchKeyword = ref('')
const currentPage = ref(1)
const pageSize = ref(10)

// 获取项目列表
const getProjects = async () => {
  try {
    const response = await api.getProjects()
    console.log(response, 'response')
    if(response?.success){
      projects.value = response.data || []
    }
  } catch (error) {
    ElMessage.error('获取项目列表失败')
    console.error('Get projects error:', error)
  }
}

// 过滤项目
const filteredProjects = computed(() => {
  if (!searchKeyword.value) {
    return projects.value
  }
  return projects.value.filter(project => 
    project.name.toLowerCase().includes(searchKeyword.value.toLowerCase())
  )
})

// 新增项目
const addProject = () => {
  router.push('/project-config')
}

// 编辑项目
const editProject = (id) => {
  router.push(`/project-config/${id}`)
}

// 删除项目
const deleteProject = async (id) => {
  try {
    await ElMessageBox.confirm('确定要删除这个项目吗？', '提示', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning'
    })
    
    await api.deleteProject(id)
    await getProjects()
    ElMessage.success('项目删除成功')
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error('项目删除失败')
      console.error('Delete project error:', error)
    }
  }
}

// 执行代码审查
const reviewCode = (id) => {
  router.push(`/review-code/${id}`)
}

onMounted(() => {
  getProjects()
})
</script>

<style scoped>
.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
</style>