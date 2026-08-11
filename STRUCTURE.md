# Project Structure: 简历生成助手 (Resume Builder AI)

> 自动生成于 2026-07-27
> 项目路径: D:\workspace\project002_简历生成助手

## 目录结构

```
D:\workspace\project002_简历生成助手
├── docs/                                # 项目文档
│   ├── frontend-audit-2026-08-02.md     # 前端功能断链审计与反馈机制方案
│   ├── quantitative-design.md           # 量化体系设计方案
│   ├── quantitative-plan.md             # 量化落地工作方案
│   └── experiment-log.md                # 实验记录(Phase1-4)
├── public/pwa-icons/                    # PWA 图标
├── src/                                 # 源码目录 ★
│   ├── main.js                          # Vue 入口
│   ├── App.vue                          # 根组件(导航+框架)
│   ├── api/
│   │   ├── deepseek.js                  # DeepSeek API封装(含metrics打点)
│   │   └── extract.js                   # AI文档内容提取
│   ├── components/
│   │   ├── MetricsDashboard.vue         # ★量化指标面板(紧凑/完整双模式)
│   │   └── ...                          # 其他UI组件
│   ├── db/                              # IndexedDB数据层
│   ├── pages/
│   │   └── HrViewPage.vue              # HR视角查看页面(含viewCount)
│   ├── router/
│   │   ├── index.js                     # Vue Router(含路由计时打点)
│   │   └── jobRoutes.js                 # 岗位相关路由
│   ├── stores/
│   │   ├── resume.js                    # 简历store(含编辑追踪)
│   │   ├── share.js                     # 分享store(含viewCount)
│   │   └── ...                          # 其他Pinia stores
│   ├── utils/
│   │   ├── actionLog.js                 # 操作日志(可导出/清空)
│   │   ├── metrics.js                   # ★核心: MetricsCollector采集器
│   │   ├── parser.js                    # 文档解析(含metrics打点+estimateAccuracy)
│   │   ├── jobMatcher.js               # ★双引擎匹配度评分(Jaccard+AI)
│   │   ├── atsScorer.js                # ★ATS兼容性评分(12维度)
│   │   ├── compress.js                  # 数据压缩
│   │   ├── backup.js                    # 数据备份
│   │   └── __tests__/                   # ★★9个测试文件,57个测试
│   │       ├── actionLog.test.js        # 操作日志持久化/导出测试
│   │       ├── metrics.test.js          # MetricsCollector核心测试
│   │       ├── deepseek-metrics.test.js # API打点测试
│   │       ├── parser-router-metrics.test.js # 解析+路由测试
│   │       ├── jobMatcher.test.js       # 双引擎匹配测试
│   │       ├── phase2-metrics.test.js   # 准确率+Pinia测试
│   │       ├── phase2-demo.test.js      # Phase2集成验证
│   │       ├── phase4-metrics.test.js   # 历史快照+ATS评分测试
│   │       └── atsScorer.test.js        # ATS评分测试
│   └── views/                           # 页面组件
├── e2e/
│   └── perf-baseline.js                 # Playwright性能基线脚本
├── test-results/                        # 测试产物目录
├── vite.config.js                       # Vite配置(含vitest)
└── package.json                         # 项目配置
```

## 路由表

| 路径 | 页面组件 | 功能 |
|------|----------|------|
| `/` → `/dashboard` | Dashboard.vue | 仪表盘首页(含MetricsDashboard卡片) |
| `/jobs` → `/collect` | JobCollector.vue | 岗位采集(重定向) |
| `/dashboard` | Dashboard.vue | 仪表盘首页 |
| `/profile` | ProfileEditor.vue | 编辑个人信息 |
| `/resume` | ResumeBuilder.vue | 构建和编辑简历 |
| `/chat` | AiChat.vue | AI智能辅助对话 |
| `/analyze` | JobAnalyzer.vue | 岗位需求分析 |
| `/collect` | JobCollector.vue | 岗位采集 |
| `/import` | DocumentUpload.vue | 文档上传+自动填写 |
| `/share` | ShareProfile.vue | 分享简历 |
| `/settings` | Settings.vue | 应用设置(含MetricsDashboard完整面板) |
| `/hr/:data` | HrViewPage.vue | HR视角查看简历 |

## 导航

首页 → 资料 → 简历 → 问答 → 导入

## 量化系统架构

```
用户操作 → 采集打点(Phase1) → 匹配评分(Phase2) → 可视化面板(Phase3)
     │           │                    │                    │
     │    metrics.recordApiCall()     │                    │
     │    metrics.recordParse()       │                    │
     │    metrics.recordGeneration()  ├─ jobMatcher.js     ├─ Dashboard.vue(紧凑)
     │    metrics.recordRoute()       ├─ atsScorer.js      ├─ Settings.vue(完整)
     │                                ├─ estimateAccuracy  └─ exportMarkdown
     │                                └─ saveSnapshot(历史)
     └─ localStorage持久化 ← ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┘
```

## 测试

| 命令 | 说明 |
|------|------|
| `npm test` | 运行57个单元测试 |
| `npm run test:watch` | 持续监听模式 |
| `npm run test:coverage` | 覆盖率报告 |
| `node e2e/perf-baseline.js` | Playwright性能基线 |
| `powershell -File _run_playwright.ps1` | Playwright功能闭环测试(17项) |

## 技术栈

- **框架**: Vue 3 (Composition API)
- **构建**: Vite 6 + vitest
- **UI**: Vant 4
- **状态**: Pinia
- **路由**: Vue Router (Hash)
- **AI**: DeepSeek API
- **存储**: Dexie.js (IndexedDB)
- **PWA**: Workbox
- **测试**: Vitest + jsdom + Playwright
