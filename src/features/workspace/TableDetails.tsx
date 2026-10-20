import { useState } from "react";
import { Modal } from "../../components/ui/Modal";
import { occupancy } from "../../domain/calculations";
import {
  attendanceLabels,
  type Snapshot,
  type TableEntity,
} from "../../domain/models";
import { workspaceService } from "../../domain/workspaceService";
import { errorMessage } from "../../lib/errors";

export function TableDetails({
  snapshot,
  tableId,
  execute,
  onEdit,
  onClose,
}: {
  snapshot: Snapshot;
  tableId: string;
  execute: (action: () => Promise<unknown>) => Promise<void>;
  onEdit: (table: TableEntity) => void;
  onClose: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const table = snapshot.tables.find((t) => t.id === tableId);
  const groups = snapshot.guests.filter((g) => g.tableId === tableId);
  const unassigned = snapshot.guests.filter(
    (g) => !g.tableId && g.attendance !== "declined",
  );
  async function run(action: () => Promise<unknown>) {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await execute(action);
      setMessage("桌位安排已保存，可在工作区撤销。");
    } catch (e) {
      setError(errorMessage(e, "安排失败"));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal
      title={table ? `${table.label} 桌详情` : "桌位已不存在"}
      onClose={() => {
        if (!busy) onClose();
      }}
    >
      {table ? (
        <>
          <p className="notice">
            完整名单 · 不受工作区筛选影响
            {table.locked
              ? " · 已锁定，请在桌位列表解锁后调整"
              : " · 按整组移动"}
          </p>
          <div className="table-detail-summary">
            <strong>
              {occupancy(snapshot, table.id)} / {table.capacity} 席
            </strong>
            <span>
              {groups.length} 组 · 剩余{" "}
              {Math.max(0, table.capacity - occupancy(snapshot, table.id))} 席
            </span>
            <button
              disabled={busy || table.locked}
              onClick={() => onEdit(table)}
            >
              编辑桌位
            </button>
          </div>
          {table.note && <p className="note">{table.note}</p>}
          {groups.length ? (
            <ul className="table-detail-list">
              {groups.map((g) => (
                <li key={g.id}>
                  <div>
                    <strong>{g.displayName}</strong>
                    <p className="muted">
                      {g.size} 人 · {attendanceLabels[g.attendance]} ·{" "}
                      {g.category || "未分组"}
                    </p>
                    {g.note && <p className="muted note">{g.note}</p>}
                  </div>
                  <label>
                    整组移至
                    <select
                      aria-label={`详情安排 ${g.displayName}`}
                      value={g.tableId ?? ""}
                      disabled={busy || table.locked}
                      onChange={(e) => {
                        const target = e.target.value || null;
                        void run(() =>
                          workspaceService.move(
                            snapshot.event.id,
                            [g.id],
                            target,
                          ),
                        );
                      }}
                    >
                      <option value="">未安排</option>
                      {snapshot.tables.map((t) => (
                        <option key={t.id} value={t.id} disabled={t.locked}>
                          {t.label} 桌{t.locked ? "（锁定）" : ""}
                        </option>
                      ))}
                    </select>
                  </label>
                </li>
              ))}
            </ul>
          ) : (
            <p className="muted">
              本桌暂无宾客，可从下方选择未安排的整组宾客。
            </p>
          )}
          <label>
            安排未安排宾客到本桌
            <select
              aria-label="选择未安排宾客入桌"
              value=""
              disabled={busy || table.locked || !unassigned.length}
              onChange={(e) => {
                const id = e.target.value;
                if (id)
                  void run(() =>
                    workspaceService.move(snapshot.event.id, [id], tableId),
                  );
              }}
            >
              <option value="">
                {unassigned.length
                  ? "选择一组宾客"
                  : "暂无计划出席的未安排宾客"}
              </option>
              {unassigned.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.displayName} · {g.size} 人 ·{" "}
                  {attendanceLabels[g.attendance]}
                </option>
              ))}
            </select>
          </label>
          {error && (
            <p role="alert" className="error">
              {error}
            </p>
          )}
          {message && (
            <p role="status" className="success">
              {message}
            </p>
          )}
          <footer>
            <button
              className="danger"
              disabled={busy || table.locked || !groups.length}
              onClick={() => {
                if (
                  window.confirm(
                    `将 ${table.label} 桌全部 ${groups.length} 组宾客迁回未安排区？名单与总人数保留。`,
                  )
                )
                  void run(() =>
                    workspaceService.releaseTable(snapshot.event.id, tableId),
                  );
              }}
            >
              全部迁回未安排
            </button>
            <button disabled={busy} onClick={onClose}>
              完成
            </button>
          </footer>
        </>
      ) : (
        <p>此桌可能已被其他标签页删除，请关闭详情后重新查看。</p>
      )}
    </Modal>
  );
}
