<template>
  <div class="admin-app">
    <Login v-if="!authed" />
    <template v-else>
      <header class="topbar">
        <div class="brand">简历生成助手 · 管理后台</div>
        <div class="top-actions">
          <a class="back-link" href="https://weisresume.cn" target="_blank" rel="noopener">主站 →</a>
          <button class="logout-btn" @click="doLogout">退出登录</button>
        </div>
      </header>
      <nav class="tabs">
        <button :class="{ active: view === 'dashboard' }" @click="view = 'dashboard'">数据看板</button>
        <button :class="{ active: view === 'shares' }" @click="view = 'shares'">分享管理</button>
      </nav>
      <main class="content">
        <Dashboard v-if="view === 'dashboard'" />
        <Shares v-else />
      </main>
    </template>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { authed, logout } from './auth'
import Login from './views/Login.vue'
import Dashboard from './views/Dashboard.vue'
import Shares from './views/Shares.vue'

const view = ref('dashboard')

async function doLogout() {
  await logout()
  view.value = 'dashboard'
}
</script>

<style>
* { margin: 0; padding: 0; box-sizing: border-box; }
body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', sans-serif;
  background: #f5f6f8;
  color: #333;
}
.admin-app { min-height: 100vh; }
.topbar {
  display: flex; align-items: center; justify-content: space-between;
  padding: 14px 24px; background: #1a1a2e; color: #fff; font-weight: 600;
}
.top-actions { display: flex; align-items: center; gap: 14px; }
.back-link { color: #7cc4ff; font-size: 13px; text-decoration: none; }
.logout-btn { border: 1px solid #555; background: transparent; color: #ccc; padding: 5px 12px; border-radius: 8px; cursor: pointer; font-size: 13px; }
.logout-btn:hover { color: #fff; border-color: #888; }
.tabs {
  display: flex; gap: 8px; padding: 12px 24px; background: #fff;
  border-bottom: 1px solid #eee; position: sticky; top: 0; z-index: 10;
}
.tabs button {
  border: none; background: #f0f2f5; color: #666; padding: 8px 18px;
  border-radius: 18px; cursor: pointer; font-size: 14px;
}
.tabs button.active { background: #1989fa; color: #fff; }
.content { max-width: 1080px; margin: 0 auto; padding: 20px 16px 60px; }
.card { background: #fff; border-radius: 10px; padding: 16px; margin-bottom: 16px; box-shadow: 0 1px 4px rgba(0,0,0,0.04); }
.card-title { font-size: 15px; font-weight: 600; margin-bottom: 12px; color: #333; }
.grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 12px; }
.stat { background: #f7f9fc; border-radius: 8px; padding: 12px; text-align: center; }
.stat .num { font-size: 22px; font-weight: 700; color: #1989fa; }
.stat .label { font-size: 12px; color: #888; margin-top: 4px; }
.error-box { color: #ee0a24; padding: 12px; text-align: center; }
.chart { width: 100%; height: 300px; }
</style>
