# 量化系统实验记录

## Phase 1 — 基础设施验证 (2026-07-27)
**测试**: 17项通过
**集成验证**: 7次API模拟 + 4次解析模拟 + 3次生成模拟 + 7次路由切换
**结论**: 采集器可用, 4/6目标达标

## Phase 2 — 双引擎匹配 + 质量追踪 (2026-07-27)
**测试**: 41项通过
**集成验证**: 真实简历 vs 5个Boss直聘岗位
| 岗位 | 匹配度 | 薪资 |
|------|--------|------|
| AI应用工程师(Agent/RAG) | 91% | 8-13K |
| AI应用工程师(电商) | 88% | 9-14K |
| AI Agent应用工程师 | 82% | 8-12K |
| AI模型工程师 | 62% | 20-40K |
| 机器视觉工程师 | 40% | 4-6K |
**新增**: calculateKeywordMatch(Jaccard) + calculateDualScore(关键词×0.5+AI×0.5) + estimateAccuracy + incrementViewCount + 编辑追踪
**结论**: 双引擎离线可用

## Phase 3 — 可视化面板 + 报告导出 (2026-07-27)
**新增**: src/components/MetricsDashboard.vue(紧凑/完整双模式)
**集成**: Dashboard.vue(紧凑卡片) + Settings.vue(完整面板)
**导出**: Markdown报告(markdown表格格式)
**结论**: 量化数据可直接在应用内查看

## Phase 4 — 持续改进 (2026-07-27)
**测试**: 52项通过 (8测试文件)
**新增**:
| 模块 | 文件 | 能力 |
|------|------|------|
| ATS评分 | src/utils/atsScorer.js | 12维度兼容性评分 + 改进建议 |
| 历史趋势 | src/utils/metrics.js | 每日快照snapshot + 30天历史 |
| Playwright基线 | e2e/perf-baseline.js | 页面加载/FCP/路由切换性能采集 + 截图 |

**ATS评分维度**: 教育/经历/技能/项目/手机/邮箱/姓名/量化%/规模/技术词/动词/证书
**历史追踪**: saveSnapshot() 自动伴随 persist() 执行, 保留30条
**测试覆盖**: 8文件52测试, 含 history/ATS/estimateAccuracy/双引擎/路由/持久化全链路
**结论**: 四阶段全部完成, 应用可正常启动使用
