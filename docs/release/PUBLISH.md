# V0.2 发布准备

发布目标为独立公开仓库`KevinnZou/event-seating-tool`与GitHub Pages。2026-10-21用户已授权整理后发布，本次状态见`V0.2.0.md`。整体验收清单见 `docs/ACCEPTANCE_V0.2.md`。不得在旧归档仓库执行此流程。

## 独立仓库设置

1. 新建名为 `event-seating-tool` 的独立仓库，检查将提交的内容全部为应用代码、虚构fixtures与文档；不要把个人备份放入项目。
2. 将本项目提交推送到该新仓库的默认分支，默认示例为main。本地开发分支可以保留，通过HEAD:main推送到独立仓库，不修改旧归档项目。
3. 在仓库Settings → Pages选择GitHub Actions作为来源，设置github-pages环境保护规则及可发布分支。首次推送只做Quality检查，默认不会发布。
4. 在Actions手动运行“Publish independent Pages site”，输入 `发布 event-seating-tool`。此流程先复用全部质量检查，成功后才部署同一份静态产物。
5. 需要后续自动部署时，在新仓库变量中显式设置 `ENABLE_PAGES_DEPLOY=true`。之后main分支push才会进入发布；删除/关闭该变量即可停用。工作流还限制仓库名与默认分支，避免误用于旧仓库。

工作流采用GitHub官方 [deploy-pages](https://github.com/actions/deploy-pages)、[upload-pages-artifact](https://github.com/actions/upload-pages-artifact) 与 [configure-pages](https://github.com/actions/configure-pages)。仅部署任务有pages:write与id-token:write权限，质量任务只读代码。

## 构建与路径

使用相对base和HashRouter，默认适配 `https://<用户名>.github.io/event-seating-tool/`。每个发布包含静态资源及sw.js，Service Worker作用域限于当前项目路径。不要将多个版本的资源混合上传。

`npm run test:pages` 本地检查同一子路径的刷新、离线关闭重开和更新确认，在Chromium与WebKit中运行。构建的`.nojekyll`由Pages静态产物保留。无需后端或任何业务密钥。

## 发布后验证

- 打开实际URL，确认首次无名单；用“试用虚构演示”完成导入、菜单移桌、导出和JSON备份恢复。
- 看到“离线资源已就绪”后断网关闭再打开，同浏览器仍能查看和修改虚构活动。
- 更新后确认刷新入口出现，先备份再刷新；当前活动仍完整。旧标签页应尽快备份并更新，不能无限依赖旧资源缓存。
- 至少用实际Safari与实际Android/iOS手机走一遍。Playwright引擎/设备仿真不等于真实设备验收。
- 公共站点仅含静态代码与虚构演示；不要上传用户备份。匿名反馈入口仅下载用户自填草稿，后续由用户自行决定分享，不自动上传或采集实名数据。

## 回退

保留发布前JSON备份；必要时在新仓库重新发布上一个已验证提交的完整产物。V0.2数据已兼容升级到Dexie4，旧V0.1代码不应直接写回新数据；回退前保留V0.2完整备份并核对版本兼容，不要清理IndexedDB。不要通过清理站点数据来更新应用；正常使用“新版本就绪，备份后刷新”。退回旧代码不能替代外部数据备份。
