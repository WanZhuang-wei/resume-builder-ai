# Phase 2: 桌面截图采集工具 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement.

**目标：** 构建独立的 Python 桌面截图采集工具，通过 HTTP API 桥接与现有 Vue 前端配合，实现分组截图 → OCR → AI 解析 → 知识库的工作流。

**架构：** Python 本地服务（Flask + SQLite + Tesseract OCR + tkinter UI）运行在 localhost:8765，Vue 前端通过封装的 API 层调用。截图和 OCR 在 Python 端完成，AI 解析复用前端 DeepSeek API。

**项目结构：**
```
jobcollector/
├── main.py             入口
├── requirements.txt    依赖
├── config.py           配置
├── server.py           Flask API
├── collector/
│   ├── screenshot.py   截图引擎
│   ├── hotkey.py       全局热键
│   └── ocr.py          OCR
├── models/
│   └── database.py     SQLite
├── ui/
│   ├── float_bar.py    浮动捕获栏
│   └── overlay.py      截图遮罩
└── utils/
    └── image.py        图片预处理
```

## Task 1: Python 项目骨架 + 数据库

- [ ] 创建 jobcollector/ 目录结构
- [ ] requirements.txt（flask, mss, pytesseract, pillow, keyboard, pystray, opencv-python）
- [ ] config.py（端口 8765、热键、截图目录）
- [ ] models/database.py（SQLite 建表 + CRUD）

## Task 2: 截图引擎 + 选框遮罩

- [ ] collector/screenshot.py（mss 区域截图）
- [ ] ui/overlay.py（tkinter 全屏遮罩 + 鼠标选框）
- [ ] utils/image.py（灰度化/二值化预处理）

## Task 3: OCR 流水线

- [ ] collector/ocr.py（pytesseract 调用 + 原始文本拼接）

## Task 4: 浮动捕获栏 UI

- [ ] ui/float_bar.py（tkinter 无边框置顶工具栏 + 状态管理）

## Task 5: HTTP API 服务

- [ ] server.py（Flask，注册所有 API 端点）
- [ ] main.py（入口，启动服务 + 托盘图标）

## Task 6: Vue 前端对接

- [ ] src/api/jobCollector.js（Python 服务 HTTP 封装）
- [ ] src/views/JobCollector.vue（采集面板页面）
- [ ] src/stores/collectedJobs.js（采集岗位 store）
- [ ] 修改 src/db/index.js（新增 collectedJobs 表）
- [ ] 修改 src/router/index.js（新增路由）

## Task 7: 集成测试

- [ ] 启动 Python 服务，测试 API 端点
- [ ] 启动 Vue 前端，测试采集 → OCR → 解析流程
