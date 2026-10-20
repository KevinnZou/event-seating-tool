# 本次续开发提交记录

全部为独立项目内的本地提交；未关联远程、未推送或部署。每条功能提交前均执行质量检查，修复另留fix提交便于追溯。

```text
269a2ab feat(seating): add searchable board, batch commands and guarded undo
6a75424 fix(seating): capture move target before asynchronous history transaction
d3f6c5e feat(import): add lossless drafts, bounded file parsing and atomic commits
37c9321 feat(import): add editable three-step import and actionable validation center
062e0e4 fix(history): preserve multi-step undo and canonical snapshot comparisons
9b0b89b feat(backup): add validated full bundles and transactional safe restore
fcd988b feat(export): add accurate text, CSV and lazy XLSX report generation
7377c4b feat(delivery): wire safe backup management and printable export pages
fabd8bc feat(import): support explicit ID-based updates without merging names
b30020e fix(storage): expose quota failures and keep backups usable as history grows
41016ee fix(seating): preserve numeric table parity and readable filtered layouts
977d95e feat(workflows): add import templates and searchable seating targets
b3e2ce2 perf(ui): paginate guest lists and streamline dense import previews
```

其后以单独的验收/文档提交收尾。可用 `git log --oneline`、`git show <提交号>` 复查。

## 桌位与拆分续完善

```text
fbaaac6 feat(seating): add complete table details and reversible whole-table release
430497b feat(seating): support explicit multi-part splitting with live count validation
f6e7024 fix(storage): make snapshot replacement atomic for standalone callers
```

随后补充锁定桌详情浏览器验收与拖放点击时序测试，再单独更新本README/验收文档。75项单元/集成、24项桌面/手机E2E及生产子路径检查通过；完整命令结果见ACCEPTANCE_V0.1.md。所有提交均保留在本地。

## V0.1全计划开发收尾

```text
31205f3 feat(offline): support production restart, complete asset caching and confirmed updates
8397808 feat(help): add private feedback drafts and reliable keyboard navigation
8dd7515 feat(release): complete cross-browser checks and gated independent Pages workflow
```

本轮最终验收包为docs/REVIEW_READY.md，结果为81项单元/集成、84项跨引擎/设备E2E、6项生产子路径/离线/更新测试。每个功能提交前均完成lint/typecheck/tests/build及相关浏览器验证；新增依赖为零。之后另留文档收尾提交，所有提交在本地，没有远程推送或部署。

## V0.2 完整开发

```text
07d9b2a feat(v02): add persistent venue geometry, named snapshots and safe seating rules
392c61b feat(floorplan): add venue editor, visual group seating and SVG PNG delivery
5cc1fb5 feat(versions): deliver named comparisons and explainable seating previews with backup safeguards
f678b68 feat(demo): add complete venue example and finalize offline print verification
```

其后为完整12桌虚构演示、横向打印/离线验证、HMR隔离与统一验收文档提交。当前分支codex/v0.2；完整提交号使用git log复查。最终98项单元/集成、126项六配置E2E、6项双引擎生产/离线测试通过，入口与逐项验收见docs/ACCEPTANCE_V0.2.md。没有远程推送/部署。
