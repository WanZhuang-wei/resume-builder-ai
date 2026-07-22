# Phase 2: 桌面截图采集工具设计方案

> 日期：2026-07-15
> 项目：简历生成助手 — 截图采集扩展
> 状态：待实现

## 一、概述

Phase 2 是一个独立的 **Python 桌面截图采集工具**，以本地 HTTP 服务的形式与现有 Vue 前端配合工作。用户通过截图采集招聘网站上的岗位信息，经 OCR + AI 解析后存入知识库，供 AI 综合分析使用。

### 核心理念

- **分步采集**：一个岗位可能分布在页面不同位置，允许多次截图归入同一组
- **本地优先**：截图、OCR、临时存储均在本地完成，不依赖网络（仅 AI 解析需要 API）
- **前端复用**：AI 解析复用 Vue 应用已有的 DeepSeek API Key 配置
- **解耦设计**：Python 工具只负责采集和识别，AI 解析和展示由前端完成

### 系统架构

```
┌──────────────────────────────────────┐
│      Python 桌面采集工具              │
│  ┌─────────┐  ┌───────────────┐      │
│  │截图引擎  │→→│ OCR + 原始    │      │
│  │(快捷键/  │  │ 文本存储      │      │
│  │ 浮动栏)  │  │ (SQLite)      │      │
│  └─────────┘  └───────┬───────┘      │
│                        ↓              │
│              HTTP API (localhost:8765) │
└───────────────────────┬──────────────┘
                        ↓
┌───────────────────────┴──────────────────┐
│          Vue 前端（现有应用）              │
│  ┌──────────┐  ┌──────────┐  ┌────────┐ │
│  │采集面板   │  │AI 解析    │  │知识库   │ │
│  │(展示/编辑)│  │(DeepSeek) │  │(分析/   │ │
│  │          │  │          │  │ 匹配度) │ │
│  └──────────┘  └──────────┘  └────────┘ │
└─────────────────────────────────────────┘
```

## 二、截图采集引擎

### 交互流程

1. 用户启动 Python 工具 → 系统托盘图标常驻 + 浮动捕获栏置顶显示
2. 点击捕获栏「新建岗位」按钮（或 `Ctrl+Shift+N`）→ 进入采集模式
3. 捕获栏切换为采集状态，显示：岗位编号、已截图张数、「完成采集」按钮
4. 点击捕获栏「截图」按钮（或 `Ctrl+Shift+S`）→ 屏幕遮罩 + 十字准星拖拽选框
5. 选框确认后截取该区域 → 缩略图显示在捕获栏中
6. 重复步骤 4-5，截取该岗位其他信息区域（如 JD、公司信息等）
7. 点击「完成采集」→ 该组截图统一进行 OCR → 存原始文本到 SQLite
8. 前端轮询到新数据 → 调用 AI 解析 → 结构化数据入库
9. 捕获栏复位，准备采集下一个岗位

### 捕获栏 UI

```
┌─────────────────────────────────────────────────────┐
│ 📋 岗位采集 #2          [📷截图] [↩重拍] [✅完成]  │ 已截 3 张
│ 分组名: 前端开发工程师 - 字节跳动（可选编辑）        │
└─────────────────────────────────────────────────────┘
```

- 无边框、置顶显示、半透明背景
- 可拖拽移动位置，不遮挡浏览区域
- 截图模式下显示缩略图预览

### 技术实现

- **全局快捷键**：Python `keyboard` 库注册 `Ctrl+Shift+S`（截图）、`Ctrl+Shift+N`（新建分组）
- **区域截图**：`mss` 库（跨平台、高性能）
- **UI 界面**：`tkinter` 实现浮动捕获栏（轻量、Python 内置）
- **系统托盘**：`pystray` 库实现托盘图标常驻

## 三、截图分组与归类

### 分组模型

每次采集以「岗位」为单位组织截图：

```
岗位采集分组 (job_group)
├── 分组 ID (自动生成)
├── 状态: collecting / ocr_done / parsed / draft
├── 截图列表:
│   ├── screenshot_001.png  (岗位列表行 - 薪资+标题)
│   ├── screenshot_002.png  (岗位详情页 - JD)
│   └── screenshot_003.png  (公司信息)
├── 原始 OCR 文本: (拼接后的纯文本)
└── 解析结果: (结构化 JSON，由前端 AI 填充)
```

### 关键规则

- 同一分组内的截图在「完成采集」后统一进行 OCR 识别
- OCR 后的原始文本按截图顺序拼接，保持语义连贯
- 前端 AI 解析时接收完整拼接文本，输出结构化 JSON
- 解析失败时保留原始 OCR 文本，标注为「待补充」状态

## 四、OCR + AI 解析流水线

### OCR 层

- **引擎**：Tesseract OCR（`pytesseract` 库）
- **中文支持**：需安装 `tesseract-ocr-chi-sim` 语言包
- **预处理**：截图灰度化 → 二值化 → 去噪（使用 `Pillow`/`OpenCV`）
- **输出**：纯文本字符串，按截图顺序拼接

### AI 解析层

由 **Vue 前端完成**，复用现有 DeepSeek API 能力：

1. 前端从 Python 服务获取岗位原始 OCR 文本
2. 调用 DeepSeek API，Prompt 要求输出结构化 JSON
3. 解析结果存入前端 IndexedDB（`collectedJobs` 表）
4. 字段映射兼容现有 `jobPositions` 表结构

### 输出 JSON 结构

```json
{
  "title": "前端开发工程师",
  "company": "字节跳动",
  "salaryMin": 25,
  "salaryMax": 45,
  "education": "本科",
  "experienceMin": 3,
  "experienceMax": 5,
  "requiredSkills": ["Vue.js", "TypeScript", "Webpack"],
  "description": "负责前端架构设计与开发...",
  "category": "技术",
  "subCategory": "前端开发",
  "industry": "互联网"
}
```

### 容错处理

- OCR 质量低时，在提示词中标注「以下文字识别度可能较低」
- AI 解析返回不完整 JSON 时，保留部分结果 + 标记缺失字段
- 前端提供手动编辑入口，用户可以补全或修正

## 五、本地存储与 API 接口

### Python 端存储

**数据库**：SQLite（`~/.jobcollector/jobs.db`）

**表结构**：

```sql
CREATE TABLE job_groups (
  id TEXT PRIMARY KEY,
  status TEXT NOT NULL DEFAULT 'collecting',  -- collecting|ocr_done|parsed|draft
  name TEXT,                                  -- 分组名（自动生成或用户输入）
  raw_text TEXT,                              -- 拼接后的 OCR 原始文本
  parsed_json TEXT,                           -- AI 解析结果（由前端写入）
  screenshot_count INTEGER DEFAULT 0,
  created_at TEXT,
  ocr_done_at TEXT,
  parsed_at TEXT
);

CREATE TABLE screenshots (
  id TEXT PRIMARY KEY,
  group_id TEXT NOT NULL,
  file_path TEXT NOT NULL,
  order_index INTEGER DEFAULT 0,
  created_at TEXT,
  FOREIGN KEY (group_id) REFERENCES job_groups(id)
);
```

**截图文件**：`~/.jobcollector/screenshots/{group_id}/{timestamp}.png`

### REST API（localhost:8765）

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/status` | 采集器状态（是否活跃、当前分组、截图数） |
| POST | `/api/collect/start` | 新建采集分组 |
| POST | `/api/collect/screenshot` | 截取当前分组的一张截图 |
| POST | `/api/collect/finish` | 完成当前分组（触发 OCR） |
| POST | `/api/collect/cancel` | 取消当前分组 |
| GET | `/api/jobs` | 获取所有已采集岗位列表 |
| GET | `/api/jobs/<id>` | 获取岗位详情（含 OCR 文本） |
| POST | `/api/jobs/<id>/parsed` | 前端写入 AI 解析结果 |
| DELETE | `/api/jobs/<id>` | 删除岗位及其截图 |
| POST | `/api/screenshot/trigger` | 程序化触发截图（等价于快捷键） |

### 前端对接

- 新建 `src/api/jobCollector.js`：封装对 Python 服务的 HTTP 调用
- 新建 `src/views/JobCollector.vue`：采集面板页面（实时状态、截图预览、手动编辑）
- IndexedDB 新增 `collectedJobs` 表：存储解析后的岗位数据
- 采集完成后自动跳转到知识库/分析页面

## 六、错误处理与边界情况

| 场景 | 处理方式 |
|------|---------|
| Python 服务未启动 | 前端检测连接失败时显示提示「请先启动采集工具」 |
| 截图为空白/无效区域 | OCR 前检测图片内容量，低于阈值提示重新截图 |
| OCR 识别率过低 | 前端提示「文字识别度低，建议放大后重截」 |
| AI 解析失败 | 保留原始 OCR 文本，标记「待解析」，支持手动重试 |
| 网络中断 | 截图和 OCR 不受影响；AI 解析延迟到网络恢复 |
| 重复采集同一岗位 | 前端支持比对标题+公司去重，提示用户是否合并 |
| Python 工具崩溃 | 截图文件不会丢失；重启后扫描未完成分组恢复状态 |

## 七、非功能性要求

- 截图操作响应时间 < 200ms（选框出现）
- OCR 处理时间 < 5s/张（取决于文字量）
- Python 服务内存占用 < 100MB
- 浮动捕获栏不应遮挡浏览器主要阅读区域
- 所有截图文件定期清理（超过 30 天的未使用截图）


