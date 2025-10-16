<template>
  <div>
    <el-container>
      <el-header style="background-color: #303133; color: #fff; padding: 0 20px; line-height: 60px;">
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <h1 style="margin: 0; font-size: 20px;">代码审核系统</h1>
          <div v-if="isLoggedIn">
            <el-button type="text" style="color: #fff; margin-right: 10px;">{{ username }}</el-button>
            <el-button type="text" style="color: #fff;" @click="logout">退出</el-button>
          </div>
        </div>
      </el-header>
      <el-container>
        <el-aside width="200px" style="background-color: #f0f2f5; padding: 20px 0;">
          <el-menu router default-active="project-list">
            <el-menu-item index="project-list">
              <el-icon><Collection /></el-icon>
              <span>项目列表</span>
            </el-menu-item>
            <el-menu-item index="review-results">
              <el-icon><Document /></el-icon>
              <span>审查结果</span>
            </el-menu-item>
          </el-menu>
        </el-aside>
        <el-main style="padding: 20px;">
          <router-view />
        </el-main>
      </el-container>
    </el-container>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { Collection, Document } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import { useRouter } from 'vue-router'

const router = useRouter()
const isLoggedIn = ref(true)
const username = ref('管理员')

const logout = () => {
  isLoggedIn.value = false
  username.value = ''
  router.push('/login')
  ElMessage.success('退出登录成功')
}

onMounted(() => {
  // 模拟登录状态检查
  const token = localStorage.getItem('token')
  if (!token) {
    isLoggedIn.value = false
    router.push('/login')
  }
})
</script>

<style>
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
}

.el-menu {
  border-right: none;
}
</style>