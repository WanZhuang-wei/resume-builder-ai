# 前端功能断链审计与可保存反馈机制

> 审计日期: 2026-08-02
> 审计范围: `src/views`、`src/components`、`src/stores`、`src/api`、`src/utils`、`server`
> 审计方式: 逐文件阅读事件绑定与数据流，结合 `npm test`（8 个文件 / 52 项单元测试）确认现有测试覆盖

## 一、总体判断

项目不是“没有功能”，而是**大量按钮已经绑定了 handler，但 handler 背后的数据流没有闭环**：

1. 组件从页面 A 跳转到页面 B，但页面 B 没有接收 A 传来的参数；
2. 表单保存到 IndexedDB 时漏字段，重新打开时数据回不来；
3. 某些“AI 功能”实际只做了本地正则或页面跳转，并没有真正调用 AI；
4. 分享页功能依赖本地后端，但开发模式默认不启动后端；
5. 错误反馈只有瞬时 Toast 或 `console.warn`，没有落盘、没有上下文、没有导出，所以复现困难。

现有 52 个单元测试全部通过，但它们只覆盖 `src/utils` 的纯函数（匹配、指标、解析），**没有覆盖任何页面事件闭环**。这就是“测试绿了，但界面还是像假的”的原因。

## 二、断链清单（按影响排序）

### P0：核心流程直接断链

| # | 位置 | 现象 | 根因 | 修复方向 |
|---|------|------|------|----------|
| 1 | `src/views/ProfileEditor.vue:165-167` | 首次进入“个人资料”页时，已保存的基本信息不回显 | `onMounted` 里先异步 `loadAll()`，随后同步判断 `profileStore.basicInfo`，数据还没加载完；`basic` 不是响应式同步 | 用 `watch(() => profileStore.basicInfo, ...)` 或 `await loadAll()` 后再赋值；补充“保存后刷新仍在”的 UI 测试 |
| 2 | `src/stores/resume.js:42-52` + `src/views/ResumeBuilder.vue:171` | 保存的简历重新打开后 JD 丢失 | `saveCurrent` 的 entry 没有写 `jobDescription` 字段（数据库 schema 已有该字段），但 `loadSavedResume` 又去读它 | entry 增加 `jobDescription`；单测断言保存后 `jobDescription` 被持久化 |
| 3 | `src/views/ResumeBuilder.vue:124-138` | AI 生成失败时页面没有任何错误提示 | `doGenerate()` 直接 `await resumeStore.generate(...)`，没有 `try/catch`，异常变成未处理 Promise | 包一层 `try/catch`，失败时 Toast + 写入操作日志 |
| 4 | `src/views/JobAnalyzer.vue:36` | 从“岗位采集”点“分析”跳转后，JD 没有自动带入 | `JobCollector.goAnalyze` 传了 `query.jd`，但 `JobAnalyzer` 从未读取 `route.query.jd` | 在 `onMounted` 读取 `route.query.jd` 并填入 `jobDescription` |
| 5 | `src/views/Dashboard.vue:94` | 在首页弹窗保存 API Key 后，顶部“未配置 API Key”横幅仍不消失 | `hasApiKey` 是普通常量，只在初始化时计算一次，不响应式 | 改为 `ref(!!getApiKey())`，`onApiKeySaved` 中重新赋值 |
| 6 | `src/views/ShareProfile.vue:108` + `server/index.js` | 生成分享链接被错误的 API Key 门禁挡住；同时 `npm run dev` 不启动分享服务 | 生成短链接只需要 `POST /api/share`，不需要 AI；后端未随开发模式启动 | 去掉 `getApiKey()` 检查；`start.bat` 或 `npm run dev` 同时启动 `server/index.js`；README 同步修正“无需后端”的表述 |

### P1：功能存在但实现是假的或不完整

| # | 位置 | 现象 | 根因 | 修复方向 |
|---|------|------|------|----------|
| 7 | `src/views/JobCollector.vue:89-103` | “AI 解析”按钮不调用 AI，只做本地正则，绝大多数 JD 提取不出内容；Toast 提示“已尝试提取”误导用户 | handler 里没有调用 `extractResumeData` 或 `chat` | 接入真实 AI 解析；或明确改为“本地简单提取”并如实提示；同时保存 `city` 字段（当前表单有城市，但 `jobData` 漏存） |
| 8 | `src/pages/HrViewPage.vue:94` + `src/components/HrChatBox.vue:108` | HR 打开分享页后，AI 问答必然失败 | HR 的浏览器没有候选人的 API Key，分享数据里也没有 key，server 也没有 `/api/chat` 代理 | 三种方案选一：服务端代理 DeepSeek 并保存候选人 key（推荐）；分享页隐藏问答；或明确提示功能不可用 |
| 9 | `src/pages/HrViewPage.vue` | 分享查看计数从未增加 | `shareStore.incrementViewCount` 已实现，但 `HrViewPage` 从未调用 | 分享页加载成功后调用 `incrementViewCount(param)`，并在“分享简历”页展示查看次数 |
| 10 | `src/views/AiChat.vue:289-291, 342-346` | 问答页“生成简历”未配置 Key 时，保存 Key 后的恢复流程会把“生成简历”当作普通消息或 JD 发给 AI | `pendingMessage` 恢复逻辑与 `pendingResumeGeneration` 是两套状态，互不衔接 | 统一为单一 pending 动作对象（类型 + 参数），保存 Key 后按类型恢复 |
| 11 | `src/views/AiChat.vue:84-112` + `src/views/AiChat.vue:323` | 聊天历史刷新后，AI 生成的简历消息不再显示“保存为简历”按钮 | 历史记录只保存 `role/content`，没有保存 `_meta` | 为消息增加 `meta` 字段（新增 IndexedDB 字段或单独表），读取历史时恢复按钮 |
| 12 | `src/views/ShareProfile.vue:22-57` | 点击分享页复选框可能表现为“点了没反应”或状态反跳 | `van-cell @click` 与内部 `van-checkbox` 同时响应，事件冒泡导致双重切换 | 使用 `@click.stop` 或只保留 checkbox 交互，并加 Playwright 断言状态只翻转一次 |

### P2：体验与可维护性问题

| # | 位置 | 现象 | 根因 | 修复方向 |
|---|------|------|------|----------|
| 13 | `src/views/AiChat.vue:252-264` | 删除单条消息可能删错 | 用 `role + content` 模糊匹配数据库记录，内容重复时删除最后一条，与界面索引不对应 | 消息列表直接携带数据库 `id`，删除按 `id` 操作 |
| 14 | `src/views/JobExplore.vue:64-68` | 分类筛选后推荐卡片匹配度全部显示 0% | `filterBySubcategory` 把 `matchScore` 置 0 | 用 `computeMatchScore` 重新计算，或改用独立“分类职位”列表 |
| 15 | `src/components/MetricsDashboard.vue` | 5 秒轮询的 `setInterval` 没有清理 | 组件卸载后定时器仍运行 | `onUnmounted` 清理 |
| 16 | `src/api/deepseek.js:40-55` | 重试最终失败时，指标记录的 `retries` 固定为 0 | `catch` 中丢失 `retriesUsed` 信息 | 在最终失败分支传入实际重试次数，便于排查网络问题 |

## 三、为什么你“得不到容易保存的反馈”

当前反馈链路是这样的：

```
按钮 → handler → Toast / console.warn → 消失
```

问题：

1. Toast 几秒后消失，无法回溯当时点了什么、传了什么参数、卡在哪一步；
2. `console.warn` 只在开发者工具可见，普通操作后无法导出；
3. `metrics` 只保存聚合数字（成功率、延迟），**不保存错误消息、请求参数、当前页面、操作对象**；
4. 没有“操作日志”面板，也没有“把日志发给 AI/开发者”的通道；
5. UI 测试只检查元素存在，不检查“点击后数据是否真的写入并重新出现”。

## 四、建议先落地：可保存的操作日志（Action Log）

这是解决“复现难”的第一优先项，预计半天到一天工作量。

### 1. 新建 `src/utils/actionLog.js`

提供一个轻量日志器，数据持久化到 IndexedDB 或 `localStorage`，环形保留最近 200 条：

```js
// 每条记录
{
  id: 1,
  ts: "2026-08-02T15:20:00.000Z",
  page: "/resume",
  action: "generateResume",
  status: "failed",        // started | success | failed | cancelled
  payload: { targetPosition: "前端工程师" },  // 摘要化，不存全文大对象
  error: { message, stack },
  durationMs: 8300,
  route: { from: "/dashboard", to: "/resume" },
  apiKeyConfigured: true
}
```

### 2. 统一埋点入口

在 `src/utils/actionLog.js` 暴露：

```js
export function logAction(action, { status, payload, error, durationMs })
export function getRecentLogs()
export function clearLogs()
export function exportLogs(format = "json")
```

### 3. 关键埋点位置

- `api/deepseek.js`：请求开始/成功/失败，记录 URL、状态码、错误消息、耗时；
- `stores/resume.js`、`stores/profile.js`、`stores/knowledge.js`：保存/删除/导入的写入结果；
- 所有页面的大按钮：生成简历、AI 解析、自动填入、分享链接、一键整理；
- 全局错误捕获：`window.addEventListener("error")` 与 `unhandledrejection`，自动记录未捕获异常；
- 路由切换：记录 `from/to`，出现异常时能还原操作路径。

### 4. 设置页增加“操作日志”

在 `Settings.vue` 增加一个面板：

- 最近 20 条日志列表（时间、页面、动作、状态、错误摘要）；
- “导出 JSON”“导出 Markdown”按钮，复用 `downloadFile`；
- “清空日志”按钮；
- 数据来源统一走 `actionLog`，不要和 `metrics` 混在一起。

### 5. 输出效果

以后再遇到“点了没反应”，你可以直接：

1. 复现一次；
2. 到设置页导出 `action-log.json`；
3. 把日志交给开发者或 AI，日志里已有页面、动作、参数、错误、耗时，不再靠猜。

## 五、测试升级：从“有元素”到“功能闭环”

`_playwright_test.js` 目前只检查“页面有内容、有按钮”。建议新增一组“闭环测试”，每个用例必须验证数据落库并重新渲染：

| 用例 | 步骤 | 断言 |
|------|------|------|
| 资料回显 | 填写姓名保存 → 刷新 → 打开资料页 | 输入框仍显示姓名 |
| 简历保存 | 生成（mock AI）→ 保存 → 查看 | 岗位与 JD 都回填 |
| 采集跳分析 | 采集页填 JD 点分析 | 分析页 textarea 自动带 JD |
| 分享勾选 | 点击联系方式 checkbox | 状态只翻转一次，最终与点击次数一致 |
| 分享链接 | 不配 API Key 也能生成（mock server） | 生成成功且链接可打开 |
| HR 问答 | mock `/api/chat` 代理 | 能收到回答，不报“API 配置异常” |
| API Key 横幅 | 首页弹窗保存 key | 横幅消失 |

单元测试侧，至少补：

- `resumeStore.saveCurrent` 保存 `jobDescription`；
- `ShareProfile` 生成链接不依赖 `getApiKey`；
- `JobAnalyzer` 从 `route.query.jd` 初始化；
- `actionLog` 持久化与导出格式稳定。

## 六、实施顺序建议

### 第一步（0.5-1 天）：建立反馈闭环

1. 新增 `src/utils/actionLog.js`；
2. 接入 `deepseek.js`、`resume.js`、`DocumentUpload.vue`、`ResumeBuilder.vue`、`ShareProfile.vue` 等关键流程；
3. 设置页加“操作日志”面板与导出；
4. 全局错误捕获；
5. 写完 `actionLog` 的单元测试。

### 第二步（1 天）：修 P0 断链

按第二节的 1-6 逐项修复，每修一项补一条闭环测试。建议顺序：

资料回显 → 简历保存/失败提示 → 采集页 JD 带入分析页 → 首页 Key 状态 → 分享链接流程。

### 第三步（1-2 天）：把“假功能”变真

1. `JobCollector` 的 AI 解析接入真实 `extractResumeData` 或 DeepSeek，并保存城市字段；
2. HR 问答改为服务端代理（或在产品层面明确降级）；
3. 分享查看计数真正累加并在分享页展示；
4. AI 对话的“保存为简历”状态在历史刷新后恢复。

### 第四步（1 天）：补 UI 闭环测试与回归

把第五节的闭环用例写进 `_playwright_test.js`，并加入 `package.json` 的 `test:ui` 流程；以后每次改动跑：

```bash
npm test
npm run test:ui
```

## 七、验证基线（审计时）

```text
npm test
Test Files  8 passed (8)
Tests       52 passed (52)
```

结论：单元测试健康，但覆盖范围只在 `src/utils`，不能证明页面功能闭环。
