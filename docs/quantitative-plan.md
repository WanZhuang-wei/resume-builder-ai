# 简历生成助手 — 量化体系落地工作方案

> 版本: v1.0 | 生成时间: 2026-07-27
> 本文档将四阶段路线图拆解为可独立分支落地的具体任务包，每个任务包包含：分支名、涉及文件、实现要点、验收标准。

---

## 总览

```
阶段一: 基础设施 (1-2天)
  ├── task-1.1  创建 MetricsCollector 工具模块
  ├── task-1.2  deepseek.js API 打点
  ├── task-1.3  parser.js 文档解析打点
  ├── task-1.4  router.js 路由切换耗时采集
  └── task-1.5  数据持久化到 localStorage
      ↓
阶段二: 关键指标落地 (2-3天)
  ├── task-2.1  双引擎匹配度评分 (jobMatcher.js)
  ├── task-2.2  简历生成质量追踪 (resume store)
  ├── task-2.3  分享查看统计 (share store)
  └── task-2.4  文档解析准确率测试
      ↓
阶段三: 可视化与面板 (1-2天)
  ├── task-3.1  Dashboard 系统状态卡片
  ├── task-3.2  Settings 量化指标面板
  └── task-3.3  数据导出与报告生成
      ↓
阶段四: 持续改进 (长期/迭代)
  ├── task-4.1  Playwright 性能基线
  ├── task-4.2  ATS 兼容性评分
  └── task-4.3  趋势图表与漏斗分析
```

---

## 阶段一: 基础设施

### task-1.1: 创建 MetricsCollector 工具模块

| 项目 | 内容 |
|------|------|
| 分支名 | `codex/metrics-phase1-collector` |
| 涉及文件 | **新建** `src/utils/metrics.js` |
| 预计工时 | 半天 |
| 依赖 | 无 |

**实现要点**:
- 创建 MetricsCollector 类，单例模式导出
- 包含以下计数器容器：
  - `api: { calls, errors, retries, totalLatency, firstTokenLatency[] }`
  - `parse: { calls, errors, totalDuration, formats: {} }`
  - `perf: { pageLoads: {}, routeTransitions: [] }`
  - `generation: { counts, userEdits, matchScores[] }`
- 暴露方法：
  - `recordApiCall({ duration, firstToken, success, retries })`
  - `recordParse({ format, duration, success })`
  - `recordGeneration({ matchScore, userEdited })`
  - `recordRouteTransition({ from, to, duration })`
  - `generateReport()` → 返回格式化 JSON
  - `persist()` / `loadPersisted()` → localStorage 存取
  - `clear()` → 重置

**验收标准**:
- [ ] `import { metrics } from '@/utils/metrics'` 可正常导入
- [ ] `metrics.recordApiCall({...})` 不抛异常
- [ ] `metrics.generateReport()` 返回结构完整的 JSON
- [ ] `metrics.persist()` 写入 localStorage，`loadPersisted()` 恢复数据

---

### task-1.2: deepseek.js API 打点

| 项目 | 内容 |
|------|------|
| 分支名 | `codex/metrics-phase1-api-timing` |
| 涉及文件 | `src/api/deepseek.js` |
| 预计工时 | 半天 |
| 依赖 | task-1.1 |

**实现要点**:
- 在 `chat()` 函数中：
  - 调用前后记录 `performance.now()`，算总耗时
  - 调用成功后调用 `metrics.recordApiCall({ duration, success: true })`
  - 调用失败时调用 `metrics.recordApiCall({ duration, success: false })`
- 在 `streamChat()` 函数中：
  - 首次收到 chunk 时记录 firstToken 延迟
  - 流结束后记录完整耗时
  - 通过 `response.body.getReader()` 读取时记录 chunk 到达间隔
- 在 `fetchWithRetry()` 函数中：
  - 记录重试次数传给 `recordApiCall`

**验收标准**:
- [ ] 非流式 chat 调用后 metrics 中 api.calls +1
- [ ] 流式 streamChat 调用后 firstTokenLatency 有值
- [ ] API 出错时 errors +1
- [ ] 重试时 retries 计数正确

---

### task-1.3: parser.js 文档解析打点

| 项目 | 内容 |
|------|------|
| 分支名 | `codex/metrics-phase1-parse-timing` |
| 涉及文件 | `src/utils/parser.js` |
| 预计工时 | 半天 |
| 依赖 | task-1.1 |

**实现要点**:
- 在解析函数（PDF/DOCX/TXT）入口/出口加计时
- 记录每个解析操作的格式类型(`pdf`/`docx`/`txt`/`image`)
- 解析成功 → `recordParse({ format, duration, success: true })`
- 解析失败 → `recordParse({ format, duration, success: false })`
- 记录提取的字段数量（可作为质量近似指标）

**验收标准**:
- [ ] 三种格式解析后 metrics.parse 均有记录
- [ ] 解析耗时正确（正数，单位 ms）
- [ ] formatDistribution 显示各格式调用次数

---

### task-1.4: router.js 路由切换耗时采集

| 项目 | 内容 |
|------|------|
| 分支名 | `codex/metrics-phase1-router-perf` |
| 涉及文件 | `src/router/index.js` |
| 预计工时 | 小半天 |
| 依赖 | task-1.1 |

**实现要点**:
- 在 `router.beforeEach` 记录开始时间戳
- 在 `router.afterEach` 计算耗时并调用 metrics.recordRouteTransition
- 记录 from.path 和 to.path

**验收标准**:
- [ ] 每次路由切换后 metrics 中 routeTransitions 数组 +1
- [ ] 每条记录包含 from、to、duration 三个字段

---

### task-1.5: 数据持久化到 localStorage

| 项目 | 内容 |
|------|------|
| 分支名 | `codex/metrics-phase1-persist` |
| 涉及文件 | `src/utils/metrics.js` |
| 预计工时 | 半天 |
| 依赖 | task-1.1 |

**实现要点**:
- persist() 方法：以日期为 key (`resume_metrics_2026-07-27`) 将 metrics 序列化到 localStorage
- loadPersisted(date?)：加载指定日期的数据，无参则加载今天
- clear()：清空当前 session 的统计
- 保留最近 7 天的数据（写入前清理过期 key）
- 在 App.vue 的 `onMounted` 中自动加载持久化数据

**验收标准**:
- [ ] 调用 persist() 后 localStorage 出现对应 key
- [ ] 页面刷新后 loadPersisted() 恢复数据
- [ ] 超过 7 天的 key 自动清理

---

## 阶段二: 关键指标落地

### task-2.1: 双引擎匹配度评分

| 项目 | 内容 |
|------|------|
| 分支名 | `codex/metrics-phase2-dual-score` |
| 涉及文件 | `src/utils/jobMatcher.js`, `src/api/deepseek.js` |
| 预计工时 | 1 天 |
| 依赖 | 阶段一完成 |

**实现要点**:
- 在 jobMatcher.js 中新增 `calculateKeywordMatch(jdText, resumeText)`：
  - 从 JD 文本中提取关键词（正则提取：技术栈名词、技能词汇、学历要求）
  - 从简历文本中提取对应关键词
  - 计算 Jaccard 相似度 = 交集大小 / 并集大小
  - 返回 0-100 的分数
- analyzeJob 返回值中加入结构化的匹配度分数：
  - 修改 system prompt，要求 AI 输出格式化的 JSON 评分
  - 包含 `{ keywordMatch, semanticMatch, overallScore }` 三个字段
- 最终匹配度 = keywordMatch × 0.5 + semanticMatch × 0.5

**验收标准**:
- [ ] calculateKeywordMatch 对相似文本返回高分，对不相关文本返回低分
- [ ] analyzeJob 返回结果中包含数字评分字段
- [ ] 匹配度结果可通过 metrics.recordGeneration 记录

---

### task-2.2: 简历生成质量追踪

| 项目 | 内容 |
|------|------|
| 分支名 | `codex/metrics-phase2-gen-quality` |
| 涉及文件 | `src/stores/resume.js`, `src/views/ResumeBuilder.vue` |
| 预计工时 | 半天 |
| 依赖 | task-2.1 |

**实现要点**:
- resume store 中 `saveCurrent()` 方法：保存时比对 currentContent 和生成时的原始内容
- 如果内容有差异（用户编辑过），调用 `metrics.recordGeneration({ userEdited: true, matchScore })`
- 如果内容一致，调用 `metrics.recordGeneration({ userEdited: false, matchScore })`
- 在简历生成的返回结果中提取或计算一个"匹配度分数"（利用 task-2.1 的结果）
- 记录每次生成的 token 消耗

**验收标准**:
- [ ] 生成后直接保存 → userEdited = false
- [ ] 生成后修改再保存 → userEdited = true
- [ ] matchScore 有值

---

### task-2.3: 分享查看统计

| 项目 | 内容 |
|------|------|
| 分支名 | `codex/metrics-phase2-share-stats` |
| 涉及文件 | `src/stores/share.js`, `src/pages/HrViewPage.vue` |
| 预计工时 | 半天 |
| 依赖 | 无 |

**实现要点**:
- share store 中 shareConfig 表增加字段：
  - `viewCount: Number`（默认 0）
  - `lastViewedAt: ISOString | null`
- 新增方法 `incrementViewCount(shareToken)`：
  - 按 token 查找记录
  - viewCount +1
  - 更新 lastViewedAt
  - put 回 IndexedDB
- HrViewPage.vue 的 `onMounted` 中调用 `shareStore.incrementViewCount(route.params.token)`
- 分享页可选的展示：底部显示 "XXX次查看"

**验收标准**:
- [ ] 每次打开分享链接 viewCount +1
- [ ] lastViewedAt 记录最后查看时间
- [ ] 数据库 schema 兼容旧数据（viewCount 不存在时默认为 0）

---

### task-2.4: 文档解析准确率测试

| 项目 | 内容 |
|------|------|
| 分支名 | `codex/metrics-phase2-parse-test` |
| 涉及文件 | **新建** `tests/parse-accuracy.spec.js`, `src/utils/parser.js` |
| 预计工时 | 1 天 |
| 依赖 | 无 |

**实现要点**:
- 准备一组标准测试文档（含 PDF/DOCX/TXT，包含完整的个人信息模板）
- 编写 Playwright/Vitest 测试：
  - 对每个测试文档运行解析
  - 解析结果与预期字段比对
  - 计算字段级准确率（正确字段数 / 总字段数）
- 在 parser.js 中添加 `estimateAccuracy(parsedResult)` 方法：
  - 基于字段完整度（非空字段 / 总字段）给出近似准确率
  - 不需要标注数据也能给出一个参考值
- 测试结果输出到 `test-results/parse-accuracy.json`

**验收标准**:
- [ ] 测试可运行，输出准确率报告
- [ ] 每种格式至少一个测试用例
- [ ] 字段空值率（近似准确率）可在 metrics 中记录

---

## 阶段三: 可视化与面板

### task-3.1: Dashboard 系统状态卡片

| 项目 | 内容 |
|------|------|
| 分支名 | `codex/metrics-phase3-dashboard-card` |
| 涉及文件 | `src/views/Dashboard.vue` |
| 预计工时 | 1 天 |
| 依赖 | 阶段一、二完成 |

**实现要点**:
- 在 Dashboard 已有的布局中新增一个"系统状态"区域（可折叠）
- 展示内容：
  - API 调用成功率（百分比 + 进度条/环形图）
  - API 平均响应时间（ms）
  - 文档解析成功率
  - 已生成简历总数
  - 平均匹配度评分
  - 性能评分简明版
- 使用 Vant 现有的组件（Cell、Tag、Progress 等）实现
- 数据来自 metrics.generateReport()
- 默认收起，用户可点击展开查看

**验收标准**:
- [ ] Dashboard 显示量化指标卡片
- [ ] 数据随使用实时更新
- [ ] 可折叠/展开，不干扰主要功能

---

### task-3.2: Settings 量化指标面板

| 项目 | 内容 |
|------|------|
| 分支名 | `codex/metrics-phase3-settings-panel` |
| 涉及文件 | `src/views/Settings.vue` |
| 预计工时 | 1 天 |
| 依赖 | 阶段一、二完成 |

**实现要点**:
- 在 Settings 页面新增"量化指标"选项卡或区域
- 分三个 Tab 展示：
  - **性能**：API 延迟趋势、首字时间、路由切换时间
  - **质量**：匹配度评分历史、解析准确率、编辑率
  - **概览**：完整报告 JSON（可复制/下载）
- 导出按钮：将 metrics.generateReport() 导出为 JSON 文件
- 重置按钮：清空所有统计（需确认弹窗）

**验收标准**:
- [ ] Settings 页面出现量化指标区域
- [ ] 可导出 JSON 报告
- [ ] 可重置统计数据

---

### task-3.3: 数据导出与报告生成

| 项目 | 内容 |
|------|------|
| 分支名 | `codex/metrics-phase3-export-report` |
| 涉及文件 | `src/utils/metrics.js`, `src/utils/backup.js` |
| 预计工时 | 半天 |
| 依赖 | task-3.2 |

**实现要点**:
- metrics.generateReport() 完善为包含历史趋势数据
- 生成 Markdown 格式报告函数 `generateMarkdownReport()`：
  - 用表格和文本呈现指标
  - 包含 KPI summary 头部
- 利用已有 backup.js 的 downloadFile 方法导出报告
- 报告可直接用于简历项目描述

**验收标准**:
- [ ] generateMarkdownReport() 输出格式化的 Markdown
- [ ] 导出文件可下载
- [ ] 内容可直接复制到简历中使用

---

## 阶段四: 持续改进（长期）

### task-4.1: Playwright 性能基线

| 项目 | 内容 |
|------|------|
| 分支名 | `codex/metrics-phase4-playwright-baseline` |
| 涉及文件 | **新建** `e2e/performance.spec.js` |
| 预计工时 | 1-2 天 |
| 依赖 | 阶段三完成 |

**实现要点**:
- 用 Playwright 录制关键页面加载的性能指标
- 采集：首屏时间、LCP、路由切换时间、API 模拟响应时间
- 设定性能基线值，对比开发构建与生产构建
- 输出性能报告到 `test-results/perf-baseline.json`

### task-4.2: ATS 兼容性评分

利用双引擎评分的基础，针对常见 ATS 系统（Workday、Greenhouse、Lever）的关键字提取规则做模拟评分。

### task-4.3: 趋势图表与漏斗分析

用 Chart.js 或 ECharts 在 Dashboard 中展示指标历史趋势，以及用户操作路径的漏斗图。

---

## 依赖关系图

```
task-1.1 (MetricsCollector)
  ├── task-1.2 (API打点)
  ├── task-1.3 (解析打点)
  ├── task-1.4 (路由耗时)
  └── task-1.5 (持久化)
      │
      ▼
task-2.1 (双引擎评分) ◄── task-2.4 (解析测试)
task-2.2 (生成质量)  ◄── task-2.3 (分享统计)
      │
      ▼
task-3.1 (Dashboard卡片) ── task-3.2 (Settings面板)
      │                       │
      └──── task-3.3 (报告导出) ──┘
      │
      ▼
task-4.x (持续改进)
```

---

## 分支策略

每个 task 对应一个独立分支，按顺序合并：

- `codex/metrics-phase1-collector`
- `codex/metrics-phase1-api-timing`
- `codex/metrics-phase1-parse-timing`
- `codex/metrics-phase1-router-perf`
- `codex/metrics-phase1-persist`
- `codex/metrics-phase2-dual-score`
- `codex/metrics-phase2-gen-quality`
- `codex/metrics-phase2-share-stats`
- `codex/metrics-phase2-parse-test`
- `codex/metrics-phase3-dashboard-card`
- `codex/metrics-phase3-settings-panel`
- `codex/metrics-phase3-export-report`

分支命名规则：`codex/metrics-阶段名-任务关键词`

合并策略：每个 phase 内的分支可并行开发，完成后合并到主干。
Phase 之间串行（phase-2 依赖 phase-1 的 MetricsCollector）。

---

## 验收总清单

完成全部四阶段后，最终验收标准：

- [ ] MetricsCollector 可采集 10+ 类指标数据
- [ ] API 性能数据（成功率/延迟/首字时间/重试率）持续记录
- [ ] 文档解析数据（5种格式/耗时/准确率）持续记录
- [ ] 简历生成质量（匹配度/编辑率）持续记录
- [ ] 分享查看次数持续记录
- [ ] Dashboard 和 Settings 页面可查看量化面板
- [ ] 可通过 JSON/Markdown 导出量化报告
- [ ] 报告数据可直接用于项目描述

**一句话总结**：全部完成后，本项目将从"无量化指标"变成拥有 **22+ 个活数据指标、可视化面板、可导出报告**的成熟产品级项目。
