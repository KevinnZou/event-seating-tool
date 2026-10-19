# 智能排桌助手 V0.1 · M0 + M1

独立 React + TypeScript + Vite 应用，只做中文圆桌活动，无账号、后端、LLM 或云服务。所有演示与测试数据虚构。

## 运行

Node 24 LTS（开发验证 24.19.0），npm 11。`npm ci` 后 `npm run dev`；按终端地址打开。生产预览 `npm run build && npm run preview`。

## 质量

`npm run lint`、`npm run typecheck`、`npm test`、`npm run build`。E2E：先 `npx playwright install chromium`，再 `npm run test:e2e`。格式：`npm run format:check`。

## 隐私

数据只保存在当前浏览器 IndexedDB；不用 localStorage 存名单，不上传任何数据。换浏览器/设备、清理站点数据、无痕模式可能导致丢失。M4 才提供完整 JSON 备份与恢复，当前阶段请仅用虚构数据试用，不作为唯一正式名单存储。

## 目录

`src/app` 路由与错误边界；`components/ui` 基础组件；`features` 页面与表单；`domain` Zod 模型、纯函数、事务服务；`db` Dexie 与 repository；`src/tests` 单测；`e2e` 浏览器验收；`docs` 决策及验收记录。

GitHub Pages 使用相对 base 和 HashRouter。CI 构建 dist 静态产物，不自动部署，不配置远程；后续经授权可将 dist 上传 Pages。不需要秘密或环境变量。

## 本次完成

- `/#/`：本地活动列表、空状态、新建、编辑、复制、输入活动名确认删除；可显式创建虚构演示。
- `/#/events/<UUID>`：人数概览、宾客组与桌位 CRUD、备注/分组/出席状态、菜单整组移桌、基础校验、保存状态。
- Dexie 事务保证活动隔离、超员阻止、同名保留、删桌迁回未安排、锁定保护；刷新后恢复。
- 活动复制重建全部 ID；人数和容量均为 1–999 整数；桌号 `01` 与 `1` 视为同号；跳号桌数按实体数量统计。

M2 的搜索/拼音/筛选、拖拽/网格工作台/撤销与性能验收，M3 的导入/完整校验中心，M4 的报表、打印、完整 JSON 备份恢复均**尚未实现**。不提供账号、逐席分座、云同步。当前没有 Service Worker，也未部署网站。

## 浏览器测试与复查

`npm run test:pages` 自动构建并验证 `/event-seating-tool/` 子路径与 Hash 深链接刷新。测试自行启停测试服务器。

若已有 Chromium 而下载缓慢，可用 `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH="/绝对路径/Chromium可执行文件" npm run test:e2e`，`test:pages` 同理。本次实测使用系统已有 Playwright Chromium 缓存 1223。默认不设置此变量时，使用 `npx playwright install chromium` 下载的对应浏览器。

实测内置浏览器、Chromium 桌面 1504×1046、手机 390×664 仿真；尚未实测 Safari 与真实手机。详细验收、质量结果、截图和有意设计差异见 [验收记录](docs/ACCEPTANCE.md) 与 [技术决策](docs/DECISIONS.md)。

后续建议：只实现 M2，复用现有事务服务，不在组件直接写库；加入可搜索的未安排区、桌卡详情、dnd-kit 与无拖拽移动、基础撤销，并以虚构300人30桌验收；继续推迟导入/导出与远程发布。
