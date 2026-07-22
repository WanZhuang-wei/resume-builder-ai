 # 项目结构文档 — 简历生成助手
 
 > 自动生成于: 2026-07-12
 > 项目路径: `D:\workspace\project002_简历生成助手`
 
 ## 目录结构
 
 ```
 D:\workspace\project002_简历生成助手/
 │
 ├── .npmrc                          # npm 镜像源配置
 ├── index.html                      # Vite 入口 HTML
 ├── package.json                    # 项目依赖与脚本
 ├── vite.config.js                  # Vite + Vue 构建配置
 ├── package-lock.json               # 依赖锁定文件
 ├── start.bat                       # 一键启动脚本（双击运行）
 │
 ├── public/
 │   └── pwa-icons/                  # PWA 图标资源
 │
 ├── src/                            # ★ 源代码目录
 │   ├── main.js                     # Vue 应用入口（组件注册）
 │   ├── App.vue                     # 根组件（导航 + 页面框架）
 │   │
 │   ├── api/
 │   │   ├── deepseek.js             # DeepSeek API 封装（对话/简历/分析/HR问答）
 │   │   └── extract.js              # AI 文档内容提取（自动填写核心）
 │   │
 │   ├── components/
 │   │   ├── HrChatBox.vue           # HR 聊天对话框（支持知识库上下文）
 │   │   ├── HrInfoCard.vue          # HR 信息卡片组件
 │   │   └── ResumeTemplate.vue      # 简历模板渲染组件
 │   │
 │   ├── db/
 │   │   └── index.js                # IndexedDB 数据库层（含 knowledgeBase 表）
 │   │
 │   ├── pages/
 │   │   └── HrViewPage.vue          # HR 视角专用页面
 │   │
 │   ├── router/
 │   │   └── index.js                # Vue Router 路由定义
 │   │
 │   ├── stores/
 │   │   ├── profile.js              # 个人信息 Pinia store
 │   │   ├── resume.js               # 简历数据 Pinia store
 │   │   ├── settings.js             # 应用设置 Pinia store
 │   │   ├── share.js                # 分享功能 Pinia store
 │   │   └── knowledge.js            # 知识库 Pinia store（文档管理 + HR上下文）
 │   │
 │   ├── utils/
 │   │   ├── backup.js               # 数据备份与恢复工具
 │   │   ├── compress.js             # 数据压缩工具
 │   │   ├── export.js               # 导出（PDF/图片）工具
 │   │   └── parser.js               # 文档解析工具（PDF/DOCX/TXT → 纯文本）
 │   │
 │   └── views/
 │       ├── AiChat.vue              # AI 智能聊天页面
 │       ├── Dashboard.vue           # 仪表盘首页（含 API Key 提示横幅）
 │       ├── DocumentUpload.vue      # 文档上传 + AI 自动填写页面 ★新增
 │       ├── JobAnalyzer.vue         # 职位需求分析页面
 │       ├── ProfileEditor.vue       # 个人信息编辑页面
 │       ├── ResumeBuilder.vue       # 简历构建/编辑页面
 │       ├── Settings.vue            # 设置页面（含 Key 测试连接）
 │       └── ShareProfile.vue        # 简历分享页面
 │
 ├── dist/                           # 构建产物（生产环境）
 └── node_modules/                   # 依赖包
 ```
 
 ## 使用说明
 
 ### 1. 环境要求
 - Node.js >= 18
 - npm >= 9
 
 ### 2. 安装依赖
 ```bash
 npm install
 ```
 
 ### 3. 一键启动（推荐）
 双击项目根目录下的 **`start.bat`**，即可自动启动开发服务器并打开浏览器。
 
 ### 4. 手动启动
 ```bash
 npm run start
 ```
 
 ### 5. 标准开发模式
 ```bash
 npm run dev
 ```
 
 ### 6. 生产构建
 ```bash
 npm run build
 ```
 
 ### 7. 开始使用
 1. 打开应用 → 点击首页顶栏 ⚙️ 齿轮图标 → **设置**
 2. 在设置页填入 DeepSeek API Key → 保存 → 点"测试连接"验证
 3. 回到首页，前往"资料"页面填写个人信息
 4. 或者到"导入"页，上传简历/毕业设计/项目文档，AI 自动提取并填入
 5. 然后去"简历"页用 AI 生成简历，去"问答"页进行求职咨询
 
 ## 路由说明
 
 | 路由路径 | 页面组件 | 功能说明 |
 |----------|----------|----------|
 | `/` → `/dashboard` | Dashboard.vue | 仪表盘首页，总览简历数据 |
 | `/profile` | ProfileEditor.vue | 编辑个人信息 |
 | `/resume` | ResumeBuilder.vue | 构建和编辑简历 |
 | `/chat` | AiChat.vue | AI 智能辅助对话 |
 | `/analyze` | JobAnalyzer.vue | 职位需求分析 |
 | `/import` | DocumentUpload.vue | 文档上传 + AI 自动填写 ★ |
 | `/share` | ShareProfile.vue | 分享简历 |
 | `/settings` | Settings.vue | 应用设置 |
 | `/hr/:data` | HrViewPage.vue | HR 视角查看简历 |
 
 ## 底部导航
 
 首页 → 资料 → 简历 → 问答 → 导入
 
 顶栏右侧 ⚙️ 齿轮图标 → 设置页
 
 ## 数据存储
 - **Dexie.js (IndexedDB)** — 浏览器本地存储
 - 表格：`basicInfo`, `workExperiences`, `education`, `projects`, `skills`, `certificates`, `resumes`, `shareConfigs`, `chatHistory`, `knowledgeBase`
 
 ## 功能模块
 
 ### AI 问答
 - 基于 DeepSeek API，支持普通对话和流式输出
 - 自动注入个人资料作为上下文
 
 ### 岗位分析
 - 输入 JD，AI 逐项分析匹配度，生成行动建议
 
 ### 自动填写 ★新增
 - 支持 PDF / DOCX / TXT 格式上传
 - AI 智能提取基本信息、工作经历、教育、项目、技能
 - 一键填入个人资料
 - 补充信息自动存入知识库
 - HR 查看时可查阅知识库内容
 
 ### HR 视角
 - 通过分享链接查看简历
 - 内置 AI 问答，支持知识库文档检索
 
 ## 技术栈
 - **框架**: Vue 3 (Composition API)
 - **构建**: Vite
 - **状态管理**: Pinia
 - **路由**: Vue Router
 - **UI 库**: Vant
 - **AI 接口**: DeepSeek API
 - **本地存储**: Dexie.js (IndexedDB)
 - **PWA**: Workbox
 - **文档解析**: pdfjs-dist + mammoth
 - **导出**: html2canvas + html2pdf.js
 
 ## 维护说明
 1. 每次新增/删除/重命名文件后，请运行此 skill 更新 `STRUCTURE.md`
 2. `node_modules/` 和 `dist/` 为构建产物，不纳入版本控制
