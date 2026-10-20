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
