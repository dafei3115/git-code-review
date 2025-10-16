<template>
  <div class="login-container">
    <div class="login-form-wrapper">
      <h2>代码审核系统登录</h2>
      <el-form ref="loginForm" :model="loginForm" :rules="rules" label-width="80px">
        <el-form-item label="用户名" prop="username">
          <el-input v-model="username" placeholder="请输入用户名"></el-input>
        </el-form-item>
        <el-form-item label="密码" prop="password">
          <el-input type="password" v-model="password" placeholder="请输入密码"></el-input>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="handleLogin" :loading="loading">登录</el-button>
        </el-form-item>
      </el-form>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'

const router = useRouter()
const username = ref('')
const password = ref('')
const loginForm = computed(() => ({
  username: username.value,
  password: password.value
}))
const loading = ref(false)

const rules = {
  username: [
    { required: true, message: '请输入用户名', trigger: 'blur' }
  ],
  password: [
    { required: true, message: '请输入密码', trigger: 'blur' }
  ]
}

const handleLogin = async () => {
  loading.value = true
  
  try {
    // 模拟登录请求
    await new Promise(resolve => setTimeout(resolve, 1000))
    
    // 简单的用户名密码验证
    if (loginForm.value.username === 'admin' && loginForm.value.password === 'admin123') {
      // 保存token到本地存储
      localStorage.setItem('token', 'mock-token')
      localStorage.setItem('username', '管理员')
      
      ElMessage.success('登录成功')
      router.push('/project-list')
    } else {
      ElMessage.error('用户名或密码错误')
    }
  } catch (error) {
    ElMessage.error('登录失败，请重试')
    console.error('Login error:', error)
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.login-container {
  display: flex;
  justify-content: center;
  align-items: center;
  height: 100vh;
  background-color: #f5f7fa;
}

.login-form-wrapper {
  width: 400px;
  padding: 40px;
  background-color: #fff;
  border-radius: 8px;
  box-shadow: 0 2px 12px 0 rgba(0, 0, 0, 0.1);
}

.login-form-wrapper h2 {
  text-align: center;
  margin-bottom: 30px;
  color: #303133;
}
</style>