<template>
  <div class="login-wrap">
    <div class="login-card">
      <div class="login-title">简历生成助手 · 管理后台</div>
      <div class="login-sub">请登录后查看数据</div>
      <form @submit.prevent="submit">
        <label class="field">
          <span>用户名</span>
          <input v-model="username" autocomplete="username" placeholder="用户名" />
        </label>
        <label class="field">
          <span>密码</span>
          <input v-model="password" type="password" autocomplete="current-password" placeholder="密码" />
        </label>
        <div v-if="error" class="login-error">{{ error }}</div>
        <button class="login-btn" type="submit" :disabled="loading">
          {{ loading ? '登录中...' : '登录' }}
        </button>
      </form>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { login } from '../auth'

const username = ref('')
const password = ref('')
const loading = ref(false)
const error = ref('')

async function submit() {
  if (!username.value.trim() || !password.value) {
    error.value = '请输入用户名和密码'
    return
  }
  loading.value = true
  error.value = ''
  try {
    await login(username.value.trim(), password.value)
  } catch (e) {
    error.value = e.message
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.login-wrap {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #1a1a2e, #16213e);
  padding: 20px;
}
.login-card {
  width: 100%;
  max-width: 360px;
  background: #fff;
  border-radius: 12px;
  padding: 28px 24px;
  box-shadow: 0 8px 30px rgba(0,0,0,0.25);
}
.login-title { font-size: 18px; font-weight: 700; text-align: center; color: #1a1a2e; }
.login-sub { font-size: 13px; color: #999; text-align: center; margin: 6px 0 20px; }
.field { display: block; margin-bottom: 14px; }
.field span { display: block; font-size: 13px; color: #666; margin-bottom: 6px; }
.field input {
  width: 100%; border: 1px solid #e0e0e0; border-radius: 8px;
  padding: 10px 12px; font-size: 14px; outline: none;
}
.field input:focus { border-color: #1989fa; }
.login-error { color: #ee0a24; font-size: 13px; margin-bottom: 12px; text-align: center; }
.login-btn {
  width: 100%; background: #1989fa; color: #fff; border: none;
  border-radius: 8px; padding: 11px; font-size: 15px; cursor: pointer; margin-top: 4px;
}
.login-btn:disabled { opacity: 0.6; cursor: default; }
</style>
