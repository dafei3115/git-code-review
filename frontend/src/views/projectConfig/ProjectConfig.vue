<template>
  <div>
    <div style="margin-bottom: 20px;">
      <h2>{{ projectId ? '编辑项目配置' : '新增项目配置' }}</h2>
    </div>
    
    <el-card>
      <el-form ref="projectFormRef" :model="projectForm" :rules="rules" label-width="150px">
        <el-form-item label="项目名称" prop="name">
          <el-input v-model="projectForm.name" placeholder="请输入项目名称"></el-input>
        </el-form-item>
        
        <el-form-item label="仓库类型" prop="repoType">
          <el-select v-model="projectForm.repoType" placeholder="请选择仓库类型">
            <el-option label="GitHub" value="GitHub"></el-option>
            <el-option label="GitLab" value="GitLab"></el-option>
          </el-select>
        </el-form-item>
        
        <el-form-item label="仓库地址" prop="repoUrl">
          <el-input v-model="projectForm.repoUrl" placeholder="请输入仓库地址"></el-input>
        </el-form-item>
        
        <el-form-item label="仓库Token" prop="token">
          <el-input v-model="projectForm.token" placeholder="请输入仓库Token" type="password"></el-input>
        </el-form-item>
        
        <el-form-item label="管理员邮箱" prop="adminEmail">
          <el-input v-model="projectForm.adminEmail" placeholder="请输入管理员邮箱"></el-input>
        </el-form-item>
        
        <el-form-item label="项目类型" prop="projectType">
          <el-select v-model="projectForm.projectType" placeholder="请选择项目类型">
            <el-option label="前端" value="前端"></el-option>
            <el-option label="后端" value="后端"></el-option>
            <el-option label="全栈" value="全栈"></el-option>
          </el-select>
        </el-form-item>
        
        <!-- <el-form-item label="DeepSeek API Key" prop="deepseekApiKey">
          <el-input v-model="projectForm.deepseekApiKey" placeholder="请输入DeepSeek API Key" type="password"></el-input>
        </el-form-item> -->
        
        <el-form-item label="技术栈">
          <el-input v-model="techStackInput" placeholder="请输入技术栈，多个用逗号分隔"></el-input>
          <div style="margin-top: 10px;">
            <el-tag v-for="(tech, index) in projectForm.techStack" :key="index" closable @close="removeTechStack(index)">
              {{ tech }}
            </el-tag>
          </div>
        </el-form-item>
        
        <el-form-item label="审查文件后缀">
          <el-input v-model="fileExtensionsInput" placeholder="请输入文件后缀，多个用逗号分隔"></el-input>
          <div style="margin-top: 10px;">
            <el-tag v-for="(ext, index) in projectForm.fileExtensions" :key="index" closable @close="removeFileExtension(index)">
              {{ ext }}
            </el-tag>
          </div>
        </el-form-item>
        
        <el-form-item label="审查忽略目录">
          <el-input v-model="ignoreDirsInput" placeholder="请输入忽略目录，多个用逗号分隔"></el-input>
          <div style="margin-top: 10px;">
            <el-tag v-for="(dir, index) in projectForm.ignoreDirectories" :key="index" closable @close="removeIgnoreDirectory(index)">
              {{ dir }}
            </el-tag>
          </div>
        </el-form-item>
        
        <el-form-item>
          <el-button type="primary" @click="handleSubmit" :loading="loading">保存</el-button>
          <el-button @click="handleCancel">取消</el-button>
        </el-form-item>
      </el-form>
    </el-card>
  </div>
</template>

<script setup>
import { ref, watch, onMounted, reactive } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { ElMessage } from 'element-plus'
import api from '../../api'

const router = useRouter()
const route = useRoute()
const projectId = route.params.id

const projectForm = reactive({
  id: '',
  name: '',
  repoType: '',
  repoUrl: '',
  token: '',
  adminEmail: '',
  projectType: '',
  techStack: [],
  fileExtensions: [],
  ignoreDirectories: [],
  reviewRules: [],
  ignoreRules: [],
  // deepseekApiKey: ''
})

const projectFormRef = ref(null)

const techStackInput = ref('')
const fileExtensionsInput = ref('')
const ignoreDirsInput = ref('')
const loading = ref(false)

const rules = {
  name: [
    { required: true, message: '请输入项目名称', trigger: 'blur' }
  ],
  repoType: [
    { required: true, message: '请选择仓库类型', trigger: 'change' }
  ],
  repoUrl: [
    { required: true, message: '请输入仓库地址', trigger: 'blur' }
  ],
  token: [
    { required: true, message: '请输入仓库Token', trigger: 'blur' }
  ],
  adminEmail: [
    { required: true, message: '请输入管理员邮箱', trigger: 'blur' },
    { type: 'email', message: '请输入有效的邮箱地址', trigger: 'blur' }
  ],
  projectType: [
    { required: true, message: '请选择项目类型', trigger: 'change' }
  ],
  // deepseekApiKey: [
  //   { required: true, message: '请输入DeepSeek API Key', trigger: 'blur' }
  // ]
}

// 获取项目详情
const getProjectDetail = async () => {
  try {
    const response = await api.getProjectDetail(projectId)
    // ✅ 正确：使用 Object.assign 更新整个对象
    Object.assign(projectForm, response.data)
    
    // 或者手动更新每个字段
    // Object.keys(response.data).forEach(key => {
    //   projectForm[key] = response.data[key]
    // })
  } catch (error) {
    ElMessage.error('获取项目详情失败')
    console.error('Get project detail error:', error)
  }
}

// 添加技术栈
watch(techStackInput, (newValue) => {
  if (newValue.includes(',')) {
    const techs = newValue.split(',').map(tech => tech.trim()).filter(tech => tech)
    projectForm.techStack = [...new Set([...projectForm.techStack, ...techs])]
    techStackInput.value = ''
  }
})

// 添加文件后缀
watch(fileExtensionsInput, (newValue) => {
  if (newValue.includes(',')) {
    const exts = newValue.split(',').map(ext => ext.trim()).filter(ext => ext)
    projectForm.fileExtensions = [...new Set([...projectForm.fileExtensions, ...exts])]
    fileExtensionsInput.value = ''
  }
})

// 添加忽略目录
watch(ignoreDirsInput, (newValue) => {
  if (newValue.includes(',')) {
    const dirs = newValue.split(',').map(dir => dir.trim()).filter(dir => dir)
    projectForm.ignoreDirectories = [...new Set([...projectForm.ignoreDirectories, ...dirs])]
    ignoreDirsInput.value = ''
  }
})

// 移除技术栈
const removeTechStack = (index) => {
  projectForm.techStack.splice(index, 1)
}

// 移除文件后缀
const removeFileExtension = (index) => {
  projectForm.fileExtensions.splice(index, 1)
}

// 移除忽略目录
const removeIgnoreDirectory = (index) => {
  projectForm.ignoreDirectories.splice(index, 1)
}

// 提交表单
const handleSubmit = async () => {
  const formEl = document.querySelector('form')
  
  try {
    // 模拟表单验证
    let isValid = true
    Object.keys(rules).forEach(key => {
      const rule = rules[key][0]
      if (rule.required && (!projectForm[key] || projectForm[key].trim() === '')) {
        isValid = false
        ElMessage.error(rule.message)
      }
    })
    
    if (!isValid) return
    
    loading.value = true
    
    if (projectId) {
      // 编辑项目
      await api.updateProject(projectId, projectForm)
      ElMessage.success('项目更新成功')
    } else {
      // 新增项目
      await api.createProject(projectForm)
      ElMessage.success('项目创建成功')
    }
    
    router.push('/project-list')
  } catch (error) {
    ElMessage.error(projectId ? '项目更新失败' : '项目创建失败')
    console.error('Submit project error:', error)
  } finally {
    loading.value = false
  }
}

// 取消操作
const handleCancel = () => {
  router.push('/project-list')
}

onMounted(() => {
  if (projectId) {
    getProjectDetail()
  }
})
</script>