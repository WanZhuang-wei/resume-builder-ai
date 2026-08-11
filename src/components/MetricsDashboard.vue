<template>
  <div class="metrics-panel section-card">
    <!-- 标题栏（可折叠） -->
    <div class="panel-header" @click="expanded = !expanded">
      <van-icon name="chart-trending-o" style="color:#1989fa;margin-right:6px" />
      <span class="panel-title">系统状态</span>
      <van-tag v-if="!expanded && stats.api.totalCalls > 0" round size="small" color="#07c160" style="margin-left:8px">
        {{ stats.api.totalCalls }}次调用
      </van-tag>
      <van-icon :name="expanded ? 'arrow-up' : 'arrow-down'" style="margin-left:auto;color:#ccc" />
    </div>

    <template v-if="expanded">
      <!-- API 指标 -->
      <div v-if="stats.api.totalCalls > 0" class="metric-group">
        <div class="metric-label"><van-icon name="records" /> API 调用</div>
        <div class="metric-bar">
          <span class="bar-text">成功率 {{ (stats.api.successRate || 0).toFixed(1) }}%</span>
          <van-progress :percentage="Math.round(stats.api.successRate || 0)" :stroke-width="6" color="#07c160" />
        </div>
        <div class="metric-details">
          <span>调用 {{ stats.api.totalCalls }} 次</span>
          <span>失败 {{ stats.api.errors }} 次</span>
          <span>延迟 {{ (stats.api.avgLatency || 0).toFixed(0) }}ms</span>
          <span v-if="stats.api.avgFirstToken">首字 {{ stats.api.avgFirstToken.toFixed(0) }}ms</span>
        </div>
      </div>

      <!-- 解析指标 -->
      <div v-if="stats.parse.totalCalls > 0" class="metric-group">
        <div class="metric-label"><van-icon name="file-text" /> 文档解析</div>
        <div class="metric-bar">
          <span class="bar-text">成功率 {{ (stats.parse.successRate || 0).toFixed(1) }}%</span>
          <van-progress :percentage="Math.round(stats.parse.successRate || 0)" :stroke-width="6" color="#1989fa" />
        </div>
        <div class="metric-details">
          <span>{{ stats.parse.totalCalls }} 次</span>
          <span>格式 {{ Object.keys(stats.parse.formatDistribution).length }} 种</span>
          <span>均耗时 {{ (stats.parse.avgDuration || 0).toFixed(0) }}ms</span>
        </div>
      </div>

      <!-- 生成指标 -->
      <div v-if="stats.generation.totalGenerated > 0" class="metric-group">
        <div class="metric-label"><van-icon name="description" /> 简历生成</div>
        <div class="metric-bar">
          <span class="bar-text">平均匹配度 {{ (stats.generation.avgMatchScore || 0).toFixed(1) }}%</span>
          <van-progress :percentage="Math.round(stats.generation.avgMatchScore || 0)" :stroke-width="6" color="#ff976a" />
        </div>
        <div class="metric-details">
          <span>生成 {{ stats.generation.totalGenerated }} 份</span>
          <span>编辑率 {{ (stats.generation.userEditRate || 0).toFixed(1) }}%</span>
        </div>
      </div>

      <!-- 路由指标 -->
      <div v-if="stats.perf.routeTransitionCount > 0" class="metric-group">
        <div class="metric-label"><van-icon name="exchange" /> 路由切换</div>
        <div class="metric-details">
          <span>{{ stats.perf.routeTransitionCount }} 次</span>
        </div>
      </div>

      <!-- 空状态 -->
      <div v-if="stats.api.totalCalls === 0 && stats.parse.totalCalls === 0 && stats.generation.totalGenerated === 0" class="empty-metrics">
        <van-icon name="info-o" /> 暂无统计数据，开始使用应用后会自动采集
      </div>

      <!-- 底部操作（仅完整模式） -->
      <div v-if="full" class="panel-actions">
        <van-button size="small" plain round icon="description" @click="exportReport">导出报告</van-button>
        <van-button size="small" plain round icon="delete" @click="clearMetrics">清空数据</van-button>
      </div>
    </template>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from "vue";
import { showSuccessToast, showConfirmDialog } from "vant";
import { metrics } from "@/utils/metrics";
import { downloadFile } from "@/utils/backup";

const props = defineProps({ full: { type: Boolean, default: false } });
const expanded = ref(props.full);
const refreshKey = ref(0);

const stats = computed(() => {
  refreshKey.value; // 强制重新计算
  return metrics.getStats();
});

function refresh() {
  refreshKey.value++;
}

onMounted(() => {
  setInterval(refresh, 5000); // 5秒刷新
});

function exportReport() {
  const report = metrics.generateReport();
  const markdown = [
    "# 量化指标报告",
    "> 由简历生成助手 MetricsCollector 自动生成",
    "",
    "## API 调用",
    "| 指标 | 数值 |",
    "|------|------|",
    "| 总调用 | " + stats.value.api.totalCalls + " |",
    "| 成功率 | " + (stats.value.api.successRate?.toFixed(1) || "N/A") + "% |",
    "| 平均延迟 | " + (stats.value.api.avgLatency?.toFixed(0) || "N/A") + "ms |",
    "| 首字时间 | " + (stats.value.api.avgFirstToken?.toFixed(0) || "N/A") + "ms |",
    "",
    "## 文档解析",
    "| 指标 | 数值 |",
    "|------|------|",
    "| 总解析 | " + stats.value.parse.totalCalls + " |",
    "| 成功率 | " + (stats.value.parse.successRate?.toFixed(1) || "N/A") + "% |",
    "| 格式分布 | " + JSON.stringify(stats.value.parse.formatDistribution) + " |",
    "",
    "## 简历生成",
    "| 指标 | 数值 |",
    "|------|------|",
    "| 生成总数 | " + stats.value.generation.totalGenerated + " |",
    "| 平均匹配度 | " + (stats.value.generation.avgMatchScore?.toFixed(1) || "N/A") + "% |",
    "| 编辑率 | " + (stats.value.generation.userEditRate?.toFixed(1) || "N/A") + "% |",
    "",
    "## 路由切换",
    "| 指标 | 数值 |",
    "|------|------|",
    "| 切换次数 | " + stats.value.perf.routeTransitionCount + " |",
  ].join("\n");

  downloadFile(markdown, "metrics-report.md", "text/markdown");
  showSuccessToast("报告已导出");
}

function clearMetrics() {
  showConfirmDialog({ title: "清空数据", message: "确定清空所有采集的量化数据？" }).then(() => {
    metrics.clear();
    metrics.persist();
    refresh();
    showSuccessToast("已清空");
  }).catch(() => {});
}
</script>

<style scoped>
.panel-header {
  display: flex;
  align-items: center;
  cursor: pointer;
  user-select: none;
}
.panel-title { font-size: 15px; font-weight: 600; }

.metric-group {
  margin-top: 12px;
  padding: 10px;
  background: #f8f9fc;
  border-radius: 8px;
}
.metric-label { font-size: 13px; font-weight: 500; margin-bottom: 6px; color: #555; }
.metric-bar { margin: 4px 0; }
.bar-text { font-size: 11px; color: #888; display: block; margin-bottom: 2px; }
.metric-details {
  display: flex; flex-wrap: wrap; gap: 8px;
  font-size: 11px; color: #999; margin-top: 4px;
}
.metric-details span { background: #f0f2f6; padding: 2px 8px; border-radius: 4px; }

.empty-metrics {
  text-align: center; padding: 20px; font-size: 13px; color: #ccc;
}

.panel-actions {
  display: flex; gap: 8px; margin-top: 12px; justify-content: flex-end;
}
</style>
