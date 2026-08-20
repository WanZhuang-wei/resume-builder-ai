# 项目部署状态总结（简历生成助手 resume-builder-ai）
> 更新日期：2026-08-21（已完成 v1 分享管理 + 独立管理后台 + 匿名埋点）
> 本地路径：D:\workspace\project002_简历生成助手
> GitHub：https://github.com/WanZhuang-wei/resume-builder-ai （master）

## 1. 线上服务
| 项目 | 值 |
|---|---|
| 主站/分享站 | **https://weisresume.cn**（HTTP 200，标题"简历生成助手"） |
| Cloudflare Pages 主站项目 | `resume-builder-ai`（默认域名 `resume-builder-ai.pages.dev`） |
| 管理后台 | **https://admin.weisresume.cn**（待用户添加 DNS 后生效；Pages 项目 `resume-admin`，暂用 `resume-admin-82d.pages.dev`） |
| EdgeOne Pages（腾讯云） | 项目 `makers-rtlrwndumfxj`，运行中，未绑定域名（ICP 备案审核中） |

## 2. 域名 weisresume.cn
- 价格：33 元/年；注册 2026-08-20，到期 **2027-08-20**
- 实名认证：✅ 已通过（个人 · 韦万壮）
- 命名审核：✅ 已通过（状态正常）
- 安全锁：✅ 禁止转移锁 + 禁止更新锁（均已开启）
- 自动续费：❌ 未开启（建议开启）
- 到期提醒：✅ 已开启
- DNS：托管在 **Cloudflare**（NS：`perla.ns.cloudflare.com` / `yevgen.ns.cloudflare.com`）；原 DNSPod（ibony/mackerel）已更换

## 3. Cloudflare 账号 / 配置
- 账号邮箱：`3519543133@qq.com`；Account ID：`ff757a001109ed03f8496f785684423a`
- Zone：`weisresume.cn`；Zone ID：`80b722b8981d76ae6434137f712d42b7`；Free 套餐
- Pages 项目 Secret：`DEEPSEEK_API_KEY`（主站 production，`wrangler pages secret put` 方式）
- KV：`SHARES_KV`（分享简历内容 payload；key = `share:{id}`，创建/延期时带绝对过期时间）
- **D1**：`resume-metrics`（ID `cca23504-3dff-456d-9407-cc4816a88f88`），4 张表：`shares / events / devices / rate_limits`（schema 见 `db/schema.sql`）
- **待完成（需用户手动，两个自动化通道被安全策略拦截）**：
  1. DNS 记录：CNAME `admin` → `resume-admin-82d.pages.dev`（Proxied，TTL Auto）
  2. Zero Trust Access：应用覆盖 `admin.weisresume.cn`，One-time PIN 登录，策略仅允许 `3519543133@qq.com`（免费版 50 用户内）

## 4. 服务端 API（Cloudflare Pages Functions）
| 接口 | 说明 |
|---|---|
| `POST /api/share` | 创建/复用分享（同 fingerprint 复用同 id，默认 40 天 TTL；body 支持 `fingerprint/forceNew/deviceId`） |
| `GET /api/share/:id` | 读取分享数据（D1 状态校验 + KV payload + share_view 事件） |
| `GET /api/share/:id/status` | HR 提问次数/剩余 |
| `POST /api/share/:id/ask` | 扣减提问次数（旧接口，已改 D1 sessions） |
| `POST /api/share/:id/chat` | HR 提问：限流 20 次/分 + 次数扣减 + DeepSeek 代理 + 用量记录 |
| `GET/POST /api/share/:id/manage` | 管理：重置/上限/延期(30天)/撤销/删除（需 manageToken） |
| `POST /api/ai/chat` | 通用 AI 代理（限流 30 次/分 + 每日 token 上限 + 用量记录） |
| `POST /api/events` | 匿名事件批量上报（白名单：app_open/feature_use/share_create/share_view/share_ask/ai_request） |
| 管理端 API（admin 项目，Access 保护 + Cf-Access 头校验） | `GET /api/admin/summary`、`GET /api/admin/shares`、`POST /api/admin/shares/:id/{revoke|extend|delete}`、`GET /api/admin/ai/usage`、`GET /api/admin/export/shares.csv` |

EdgeOne 侧同步：`cloud-functions/api/ai/chat.js` + `.edgeone/cloud-functions/api-node/config.json`（尚未部署启用）。

## 5. 前端要点
- 技术栈：Vue3 + Vite + Vant + Pinia + Vue Router(hash) + Dexie(IndexedDB) + PWA
- AI 调用 `src/api/deepseek.js`：生产环境走同源 `/api/ai/chat`（带 deviceId/feature）；本地开发回退 localStorage Key；`hasAiAccess()`
- 分享链接格式：`{origin}/#/hr/{8位id}`；**稳定链接**：同一份内容指纹返回同一 id，40 天自动过期，可延期/撤销/删除
- 我的分享：底部导航"我的分享"入口（`/shares`），IndexedDB `myShares` 表持久化本机记录，支持复制/管理/延期/撤销
- 埋点：`src/utils/tracker.js`（匿名 device_id + 批量上报，仅生产启用）；功能漏斗埋点：auto_fill / resume_generate / job_analyze / job_collect / qa
- 隐私说明：设置页 + 我的分享页（仅匿名统计、不收集简历内容、90 天清理）
- 分享数据：KV 存 payload（带过期），D1 存元数据/次数/事件；旧 KV 分享在首次访问时自动迁移进 D1
- `.env`：`VITE_SHARE_API=http://localhost:3001`（仅本地开发；**构建部署时需临时移开 .env**）

## 6. 部署流程（已验证）
```powershell
# 主站
npm test                          # 83 tests 全通过
Move-Item .env .env.deploybak     # 构建前移开 .env
npm run build                     # 产物 dist/
Move-Item .env.deploybak .env
npx wrangler pages deploy dist --project-name resume-builder-ai

# 管理后台（必须在 admin/ 目录内执行，使用 admin/wrangler.toml + admin/functions）
cd admin
npm install
npm run build                     # 产物 admin/dist/
npx wrangler pages deploy dist --project-name resume-admin --branch main
```
部署后验证：
- `curl https://weisresume.cn/`
- `POST https://weisresume.cn/api/share`（同指纹两次 → 同 id）
- `GET https://resume-admin-82d.pages.dev/api/admin/summary`（无 Access 头 → 401）

## 7. 最近提交（已推送 GitHub master）
- `45084413` fix: 智能问答与首页 AI 门控改用 hasAiAccess
- `2ac89601` feat: 主应用 AI 走服务器端 DeepSeek 代理（免本地 Key）+ 修复备份覆盖空数据 bug
- 本次 v1 待提交：D1/分享生命周期/埋点/我的分享/admin 子项目/文档

## 8. 待办
- **用户手动（Cloudflare 控制台，约 2 分钟）**：①DNS 加 CNAME `admin` → `resume-admin-82d.pages.dev`；②Zero Trust Access 保护 `admin.weisresume.cn`（One-time PIN，仅本人邮箱）
- ICP 备案通过后如需切 EdgeOne：临时关闭禁止更新锁（需微信扫码验证）→ NS 改回 DNSPod → EdgeOne 绑定 weisresume.cn
- `www.weisresume.cn` 未配置（可选：加 CNAME + 跳转）
- 自动续费未开（腾讯云域名控制台可开）
- 主站 PWA 缓存：升级后旧缓存用户需刷新一次

## 9. 浏览器/账号登录状态（操作提示）
- 腾讯云：Codex 内置浏览器已登录（账号 100051535437）；本机 Edge 也已登录
- Cloudflare：Codex 内置浏览器已登录（3519543133@qq.com）
- ⚠️ 内置浏览器访问 dash.cloudflare.com / one.dash.cloudflare.com 被安全策略拦截；Windows 控制（Computer Use）识别浏览器 URL 也被拦截 → 需要操作 Cloudflare 控制台时，请用户在**本机 Edge** 手动完成，或提供可用的浏览器通道

## 10. 常用链接
- 腾讯云域名控制台：https://console.cloud.tencent.com/domain/all-domain
- EdgeOne 项目：https://console.cloud.tencent.com/edgeone/makers/project/makers-rtlrwndumfxj/index
- Cloudflare Pages（主站）：https://dash.cloudflare.com/ff757a001109ed03f8496f785684423a/pages/view/resume-builder-ai
- Cloudflare Pages（管理端）：https://dash.cloudflare.com/ff757a001109ed03f8496f785684423a/pages/view/resume-admin
- Cloudflare DNS：https://dash.cloudflare.com/ff757a001109ed03f8496f785684423a/weisresume.cn/dns/records
- Cloudflare Zero Trust：https://one.dash.cloudflare.com/
- 管理后台（DNS 生效后）：https://admin.weisresume.cn
