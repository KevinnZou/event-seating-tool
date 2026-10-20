# 智能排桌助手 V0.1

中文圆桌活动排桌工具，支持婚礼、宴会、年会。一套 React + TypeScript + Vite 前端，无账号、后端、云数据库或 LLM API。数据只保存在当前浏览器的 IndexedDB（Dexie），所有内置演示与测试数据均虚构。

## 启动

Node 24 LTS、npm 11；已提供 `.nvmrc` 与锁文件。

```bash
npm ci
npm run dev
```

按终端给出的地址打开；端口被占用时 Vite 会自动递增。生产预览：`npm run build && npm run preview`。当前使用相对 base + HashRouter，适配 GitHub Pages 子路径；未配置任何远程、未推送或部署。

## 页面与功能

- `/#/`：本地活动列表，创建/编辑/复制/删除活动，虚构演示，完整备份恢复，确认清空本地数据。
- `/#/events/<UUID>`：人数概览、宾客组/桌位 CRUD、拼音与中文搜索、分类/出席/桌位筛选、排序、分页名单、批量移动/状态/删除、整组拖放或菜单移动、家庭拆分、桌位排序/对调、锁定保护、撤销重做、校验定位、检查点管理。
- “导入名单”：下载虚构CSV/XLSX模板，粘贴中文文本或选择CSV/XLSX，选择Sheet/字段映射，逐行预览/纠错/排除，确认后事务提交。默认新增，可显式按ID指定更新或输入活动名替换全部名单。
- `/#/events/<UUID>/export`：文字、宾客CSV、桌位CSV、未安排CSV、三Sheet Excel、A4名单/桌卡打印与保存PDF、奇偶桌分组、JSON备份恢复。

## 人数与数据安全

- 宾客组 `size` 才是占用人数，夫妻/家庭不自动拆开，也不根据名字后缀覆盖手填人数。同名保留独立ID。
- 人数与容量均为1–999整数；默认容量10，超员阻止。`01`与`1`视为重复桌号；跳号按实际桌记录计数。
- 计划出席=确认+待定，不含不参加；不参加保留记录但不占席。删桌整组迁回未安排。锁定桌先解锁再改动。
- 所有变更通过service/repository与事务写入；统计与校验是纯函数。批量操作全有或全无。撤销最多30步，仅本次页面会话；导入/恢复前自动保存持久检查点。
- CSV/XLSX文本防公式注入；公式单元格不会执行，导入时要求人工改成文字。应用不上传名单、不使用埋点或远程字体。

## 备份与恢复

本机数据可能因清理站点数据、无痕模式、换浏览器/设备而丢失，请定期下载JSON文件。**报表不是可恢复备份，本机检查点也不能代替外部文件。**

“完整备份与恢复”默认下载活动、桌位、宾客、安排、活动设置及历史检查点，可选择单活动/全部活动。历史很大时可明确取消“包含历史检查点”，只备份全部当前数据；当前名单仍完整，历史检查点仍留在本机，不会自动删除。

恢复前检查格式/版本/ID/关联/人数与容量，默认导入为新活动并重建所有引用。按ID覆盖需明确确认，覆盖前保存检查点；其他活动保留。恢复后展示活动、组、桌及人数报告。页面只记录触发下载的时间，请自行确认文件已保存。

浏览器持久存储申请只能降低自动清理风险，不替代备份。其他标签页查看同一活动时会提示；跨标签页无协同编辑保证，导入与撤销遇到版本变化会拒绝覆盖。

## 导入限制

- 文件上限10MB；最多5000条宾客组、100列，XLSX总单元格最多10万；ZIP展开最多32MB/2000项；不支持宏、加密或外链工作簿。
- CSV支持UTF-8 BOM、引号/换行，UTF-8失败时尝试GB18030。字段映射可修正。
- 无法判断的人数/复杂注释保留在预览中，必须修正或明确取消勾选，不静默丢行。指定更新需用户按ID选择目标，不按姓名匹配覆盖。
- XLSX引擎按需加载；首次使用读写Excel时会比普通操作稍慢。

## 质量命令

```bash
npm run lint
npm run typecheck
npm test
npm run build
npm run format:check
npm run privacy:check # 先 build
npx playwright install chromium
npm run test:e2e
npm run test:pages
```

`test:pages`包含生产构建及 `/event-seating-tool/` 子路径、Hash深链接刷新验收。测试自行启停测试服务器。

本次使用已有Chromium缓存执行浏览器测试；如需使用已有可执行文件：`PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH="/绝对路径/Chromium" npm run test:e2e`，Pages测试同理。CI默认安装锁定Playwright对应的Chromium，不需要密钥。`CAPTURE_QA=1`可额外生成虚构数据截图到 `docs/design/v01/`。

## 目录与验收

- `src/app`：路由、存储探测、错误边界、标签页提醒。
- `src/db`：Dexie schema与repository；数据库schema2兼容迁移schema1。
- `src/domain`：实体/Zod、纯函数、CRUD/批量服务、撤销与检查点。
- `src/features`：活动、排桌、导入、校验、交付与备份界面。
- `src/lib`：文件名/下载/错误信息。
- `src/tests` / `e2e`：虚构数据单元、集成、桌面/手机、300/500人及Pages测试。
- [技术决策](docs/DECISIONS.md)、[最新验收](docs/ACCEPTANCE_V0.1.md)、[M0/M1阶段记录](docs/ACCEPTANCE.md)。

未实现可选的一键排桌建议、命名版本对比、SVG/PNG平面图、二维码、Service Worker/PWA、账号/云同步和逐席分座。Safari与真实手机尚未单独实测；当前手机验收为Chromium仿真。CI已准备质量验证和dist产物上传，但没有自动部署或公开发布。
