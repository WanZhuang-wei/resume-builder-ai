 # Phase 1 优化方案设计文档

 > 日期：2026-07-15
 > 项目：简历生成助手
 > 状态：待实现

 ## 一、概述

 本阶段（Phase 1）聚焦于**纯前端优化**，不改变项目架构（Vue 3 + Vite PWA），在现有 Web 应用范围内修复已知问题并增强核心体验。

 Phase 2（桌面截图采集工具）将作为独立项目后续开发，以 Python 本地服务形式与 Vue 应用配合。

 ### 涉及模块

 | 编号 | 模块 | 类型 | 优先级 |
 |------|------|------|--------|
 | 1 | AI 对话历史持久化 | 增强 | P0 |
 | 2 | 岗位收藏功能修复 | 修复 | P0 |
 | 3 | 简历生成字段重构 | 重构 | P1 |
 | 4 | AI 窗口内嵌简历生成 | 新增 | P1 |

 ## 二、AI 对话历史持久化

 ### 现状

 - `chatHistory` 表已在 IndexedDB（Dexie.js）中存在：`++id, role, content, timestamp`
 - 但 AiChat.vue 未使用，messages 为 in-memory `ref([])`，刷新即丢失

 ### 设计

 #### 自动保存

 - 每次用户发送消息 + AI 回复后，自动写入 `chatHistory` 表
 - 每条记录：`{ role: 'user'|'assistant', content: string, timestamp: ISOString }`
 - 批量插入：用户消息和 AI 回复在一次事务中写入，保证成对

 #### 加载逻辑（onMounted）

 - 按 `timestamp` 倒序加载最近 50 条记录（性能与上下文均衡）
 - 加载后按时间正序排列显示，保持对话连贯性
 - 若超过 50 条，底部提示"查看更早的历史记录"按钮，点击加载更多（每次 +30 条）

 #### 操作功能

 - **清空历史**：聊天窗口顶部工具栏按钮，点击后弹出确认对话框，确认后删除 `chatHistory` 表全部记录
 - **导出对话**：将当前 visible 对话导出为文本文件（TXT 格式，含时间戳）
 - **单条删除**：长按 / hover 消息时出现删除图标，点击删除单条（从 DB + 内存同时移除）

 #### 边界处理

 - 频繁对话时做防抖写入，避免 IndexedDB 写入竞争
 - 大数据量下限制初始加载条数，避免页面卡顿

 ## 三、岗位收藏功能修复

 ### 根因分析

 通过审查代码发现两个问题：

 1. **`isFav` 响应式断裂**：`JobExplore.vue` 中 `isFav(job)` 是普通函数调用，非 computed。`toggleFav` 修改 `favorites` 后 Vue 可能跳过 DOM 更新，导致收藏图标刷新不及时或不变。
 2. **`getFavoriteJobs()` 过滤丢失**：该方法用 `allJobs.find()` 匹配完整数据，如果 `allJobs` 与收藏数据的 ID 体系不一致（job.id 为 undefined 时回退至 title 匹配），可能导致收藏列表为空。

 ### 修复方案

 #### 改用 computed isFavMap

 - 在 `useJobsStore` 中新增 computed `favoriteIdSet`，返回 `Set<string>`
 - `isFavorite(job)` 内部改为查 Set：`favoriteIdSet.has(job.id || job.title)`
 - `JobExplore.vue` 模板中直接使用 store 的 `isFavorite` 方法，通过 Pinia 响应式链自动更新

 #### 修复 toggleFavorite

 - 移除 `favorites.value.push(...)`，改为 `favorites.value = [...favorites.value, newItem]`，强制生成新数组引用来触发 Pinia 响应式
 - 删除时改为 `favorites.value = favorites.value.filter(...)`，已有此模式无需修改

 #### getFavoriteJobs 兼容增强

 - 如果 `allJobs.find()` 找不到匹配数据，直接返回收藏表中的摘要数据（title/salary 等），而不是过滤掉
 - 这样用户在 allJobs 未完全加载时也能看到收藏列表

 ## 四、简历生成字段重构

 ### 现状

 ResumeBuilder.vue 中"目标公司"为必填项（`required: true`），生成的简历绑定 `{ targetCompany, targetPosition }`，不方便海投。

 ### 新设计

 #### 输入字段

 | 字段 | 必填 | 说明 |
 |------|------|------|
 | 目标岗位 | 是 | 岗位名称 |
 | 岗位描述(JD) | 否 | 粘贴 JD 文本，AI 据此定制简历 |
 | 目标公司 | 否 | 可选，填了则带上公司名 |

 #### 交互流程

 进入简历生成页面时，AI 先反问用户："是否要自定义岗位描述？"
 - **选是**：显示 JD 文本框 → 用户粘贴 → AI 生成定制化简历（针对性强）
 - **选否**：直接根据岗位名 + 用户经历生成通用简历（适合海投）

 #### DB 兼容

 - `resumes` 表新增字段：`jobDescription`（文本）、`companyName`（原 targetCompany 保留作为别名）
 - 已有数据不受影响，新数据按新结构存储

 ## 五、AI 窗口内嵌简历生成

 ### 现状

 AiChat.vue 只有纯文本输入框，缺少操作入口。

 ### 设计

 #### 工具栏

 在聊天输入框上方新增一条工具栏，包含"生成简历"按钮（使用简历图标 + 文字）。

 #### 交互流程

 1. 用户点击"生成简历"按钮
 2. 弹出轻量表单（van-dialog + van-form）：目标岗位（必填）、岗位描述（可选）、目标公司（可选）
 3. 表单底部有"反问先"逻辑：若 JD 字段为空，AI 将在回复中先反问用户是否需要添加 JD 定制
 4. 提交后调用 DeepSeek API 生成简历内容
 5. AI 以 Markdown 格式将简历内容输出到聊天窗口（作为一条 assistant 消息）
 6. 该消息下方附带"保存为简历"按钮，点击后调用 resumeStore.saveCurrent() 存入 DB

 #### 技术点

 - 复用现有 `resumeStore.generate()` 逻辑，提取为独立 API 调用
 - 生成的简历内容支持 Markdown 渲染（聊天框需支持 v-html 或 Markdown 解析）
 - "保存为简历"按钮使用 Vant Button 组件，嵌入消息模板

 ## 六、非功能性要求

 - 所有 IndexedDB 操作考虑异常降级（delete 失败时 console.warn 而非阻塞 UI）
 - 收藏功能修复后确保在 JobExplore（列表页）和 JobDetail（详情页）表现一致
 - 简历生成字段重构不破坏已有数据的展示和导出
 - AI 聊天历史加载要有 loading 状态，避免白屏等待
