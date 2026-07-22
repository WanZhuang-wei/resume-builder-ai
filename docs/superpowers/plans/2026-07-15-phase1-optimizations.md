 # Phase 1 优化实现计划
 > **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.
 **目标：** 修复 4 个已知问题：AI 对话历史持久化、岗位收藏响应式修复、简历生成字段重构、AI 窗口内嵌简历生成。
 **涉及文件：** src/views/AiChat.vue, src/stores/jobs.js, src/views/JobExplore.vue, src/views/JobDetail.vue, src/views/ResumeBuilder.vue, src/db/index.js, src/api/deepseek.js
 ## Task 1: DB schema 扩展
 - [ ] 修改 resumes 表添加 jobDescription 字段（src/db/index.js:7）
 - [ ] 确认不破坏已有数据（无需 version bump）
 ## Task 2: 岗位收藏功能修复
 - [ ] Jobs store：新增 favoriteIdSet computed，修复 toggleFavorite（push→spread），getFavoriteJobs 添加回退逻辑
 - [ ] JobExplore.vue：isFav(job)→jobsStore.isFavorite(job)
 - [ ] 确认 JobDetail.vue 已兼容（isFav 已是 computed）
 ## Task 3: AI 对话历史持久化
 - [ ] 导入 db，onMounted 加载最近 50 条历史
 - [ ] sendMessage 中用户/AI 消息后自动写入 chatHistory 表
 - [ ] 工具栏：清空历史（确认清空）+ 导出对话（TXT Blob）+ 加载更早（分页）
 - [ ] 单条删除（hover 显示 ×，按 content+role 匹配删除）
 ## Task 4: 简历生成字段重构
 - [ ] 表单字段改为：目标岗位(必填)+目标公司(可选)+岗位描述(可选)
 - [ ] 点击生成时 JD 为空→弹出反问对话框（直接生成/填写 JD）
 - [ ] resume store 的 generate/saveCurrent 支持 jobDescription 参数
 ## Task 5: AI 窗口内嵌简历生成
 - [ ] deepseek.js 新增 generateResumeWithAI
 - [ ] AiChat 工具栏添加"生成简历"按钮+表单对话框
 - [ ] 提交后 AI 以 Markdown 输出简历到聊天窗口
 - [ ] 简历消息下方附带"保存为简历"按钮
 - [ ] renderMarkdown 函数实现简易 Markdown→HTML 渲染
