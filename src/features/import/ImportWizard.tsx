import { useState } from "react";
import { Modal } from "../../components/ui/Modal";
import type { Snapshot } from "../../domain/models";
import { fingerprint } from "../../domain/snapshots";
import { calculateEventStats } from "../../domain/calculations";
import { historyService } from "../../domain/historyService";
import { rowErrors, type DraftRow } from "./parsers";
import { ImportSource } from "./ImportSource";
import { PreviewRows } from "./PreviewRows";
import { planImport, importService } from "./importService";
export function ImportWizard({
  snapshot,
  onClose,
}: {
  snapshot: Snapshot;
  onClose: () => void;
}) {
  const [step, setStep] = useState(0),
    [rows, setRows] = useState<DraftRow[]>([]),
    [base, setBase] = useState(snapshot),
    [page, setPage] = useState(0),
    [mode, setMode] = useState<"append" | "replace">("append"),
    [create, setCreate] = useState(false),
    [confirm, setConfirm] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [report, setReport] = useState("");
  const included = rows.filter((r) => r.included),
    invalid = included.filter((r) => rowErrors(r).length).length;
  let planError = "",
    summary = "";
  if (step > 0 && step < 3) {
    try {
      const planned = planImport(base, rows, mode, create),
        stats = calculateEventStats(planned);
      summary = `导入后：${stats.groupCount} 组 / 录入 ${stats.totalRecordedCount} 人 / 计划 ${stats.plannedCount} 人 / 已排 ${stats.assignedCount} 人 / 未排 ${stats.unassignedCount} 人`;
    } catch (e) {
      planError = e instanceof Error ? e.message : "预览失败";
    }
  }
  const duplicate = included.filter(
    (r, i) =>
      base.guests.some(
        (g) => g.displayName === r.name && g.id !== r.targetId,
      ) || included.slice(0, i).some((g) => g.name === r.name),
  ).length;
  function editRow(id: string, patch: Partial<DraftRow>) {
    setRows(rows.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }
  return (
    <Modal
      title={`导入名单 · ${step === 0 ? "1 输入" : step === 1 ? "2 预览与纠错" : step === 2 ? "3 确认写入" : "完成"}`}
      onClose={onClose}
    >
      <div className="import-wizard">
        {step === 0 ? (
          <ImportSource
            onPreview={(draft) => {
              setRows(draft);
              setBase(snapshot);
              setPage(0);
              setError("");
              setStep(1);
            }}
          />
        ) : step === 1 || step === 2 ? (
          <>
            <p>
              本次新增 {included.filter((r) => !r.targetId).length} 组；指定更新{" "}
              {included.filter((r) => r.targetId).length} 组；明确排除{" "}
              {rows.length - included.length} 行；错误 {invalid} 行；疑似同名{" "}
              {duplicate} 行（全部保留独立记录）。
            </p>
            <label>
              导入方式
              <select
                value={mode}
                onChange={(e) =>
                  setMode(e.target.value as "append" | "replace")
                }
              >
                <option value="append">
                  新增 / 逐行指定更新（不自动合并）
                </option>
                <option value="replace">替换全部名单（保留桌位）</option>
              </select>
            </label>
            <label className="check">
              <input
                type="checkbox"
                checked={create}
                onChange={(e) => setCreate(e.target.checked)}
              />
              按默认容量自动创建未知桌号
            </label>
            {summary && <p className="notice">{summary}</p>}
            {planError && <p className="error">{planError}</p>}
            {duplicate > 0 && (
              <p className="notice">
                同名仅提醒，不自动合并或覆盖，请核对原文。
              </p>
            )}
            {step === 1 ? (
              <>
                <PreviewRows
                  snapshot={base}
                  mode={mode}
                  rows={rows}
                  page={page}
                  setPage={setPage}
                  editRow={editRow}
                />
                <footer>
                  <button onClick={() => setStep(0)}>返回输入</button>
                  <button
                    className="primary"
                    disabled={!!planError || busy}
                    onClick={() => setStep(2)}
                  >
                    核对完成，下一步
                  </button>
                </footer>
              </>
            ) : (
              <>
                <p>
                  提交将作为一个事务写入，并先保存本地检查点。失败时原有数据保持不变。
                </p>
                {mode === "replace" && (
                  <label>
                    输入完整活动名确认替换
                    <input
                      value={confirm}
                      onChange={(e) => setConfirm(e.target.value)}
                    />
                  </label>
                )}
                <footer>
                  <button onClick={() => setStep(1)}>返回纠错</button>
                  <button
                    className="primary"
                    disabled={
                      busy ||
                      !!planError ||
                      (mode === "replace" && confirm !== base.event.name)
                    }
                    onClick={async () => {
                      setBusy(true);
                      setError("");
                      try {
                        const r = await importService.commit(
                          base.event.id,
                          rows,
                          mode,
                          create,
                          fingerprint(base),
                          confirm,
                        );
                        historyService.clear(base.event.id);
                        setReport(
                          `已新增 ${r.added} 组，已更新 ${r.updated} 组，明确排除 ${r.skipped} 行。当前计划出席 ${r.planned} 人。导入前检查点已保存。`,
                        );
                        setStep(3);
                      } catch (e) {
                        setError(
                          e instanceof Error ? e.message : "导入失败，已回滚",
                        );
                      } finally {
                        setBusy(false);
                      }
                    }}
                  >
                    {busy ? "正在保存…" : "确认导入"}
                  </button>
                </footer>
              </>
            )}
          </>
        ) : (
          <>
            <p role="status" className="notice">
              {report}
            </p>
            <button className="primary" onClick={onClose}>
              完成
            </button>
          </>
        )}
        {error && (
          <p role="alert" className="error">
            {error}
          </p>
        )}
      </div>
    </Modal>
  );
}
