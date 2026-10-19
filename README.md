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
