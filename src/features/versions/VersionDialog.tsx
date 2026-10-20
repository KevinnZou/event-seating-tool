import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { Modal } from "../../components/ui/Modal";
import { db } from "../../db/database";
import type { Snapshot } from "../../domain/models";
import {
  compareSnapshots,
  versionService,
  type VersionChange,
} from "../../domain/versions";
import { parseSnapshot } from "../../domain/snapshots";
import { calculateEventStats } from "../../domain/calculations";
import { historyService } from "../../domain/historyService";
import { errorMessage } from "../../lib/errors";
export function VersionDialog({
  snapshot,
  onClose,
}: {
  snapshot: Snapshot;
  onClose: () => void;
}) {
  const versions = useLiveQuery(
    () =>
      db.checkpoints
        .where("eventId")
        .equals(snapshot.event.id)
        .reverse()
        .sortBy("createdAt"),
    [snapshot.event.id],
  )?.filter((cp) => cp.name);
  const [name, setName] = useState(""),
    [left, setLeft] = useState(""),
    [right, setRight] = useState("current"),
    [page, setPage] = useState(0);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [message, setMessage] = useState("");
  async function run(action: () => Promise<unknown>, success: string) {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await action();
      setMessage(success);
    } catch (error) {
      setError(errorMessage(error, "方案操作失败"));
    } finally {
      setBusy(false);
    }
  }
  const source = (key: string) =>
    key === "current"
      ? snapshot
      : parseSnapshot(versions?.find((cp) => cp.id === key)?.snapshot);
  let changes: VersionChange[] = [],
    compareError = "",
    summary = "";
  if (left && right && versions) {
    try {
      const a = source(left),
        b = source(right);
      changes = compareSnapshots(a, b);
      const x = calculateEventStats(a),
        y = calculateEventStats(b);
      summary = `计划人数 ${x.plannedCount} → ${y.plannedCount}；已安排 ${x.assignedCount} → ${y.assignedCount}；宾客组 ${x.groupCount} → ${y.groupCount}`;
    } catch {
      compareError = "所选方案已不存在或无效，请重新选择。";
    }
  }
  return (
    <Modal
      title="命名方案与差异"
      onClose={() => {
        if (!busy) onClose();
      }}
    >
      <p className="notice">
        方案包含当前活动的名单、桌位、场地与设置，保存在本机。完整JSON备份默认包含方案；方案不是外部备份。
      </p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void run(async () => {
            const id = await versionService.save(snapshot.event.id, name);
            setLeft(id);
            setRight("current");
            setName("");
            setPage(0);
          }, "命名方案已保存");
        }}
      >
        <label>
          新方案名称
          <input
            required
            maxLength={80}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="例如：酒店确认稿"
          />
        </label>
        <button className="primary" disabled={busy || !name.trim()}>
          保存当前为命名方案
        </button>
      </form>
      <div className="version-list">
        {versions?.map((version) => (
          <div className="version-row" key={`${version.id}:${version.name}`}>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const value = String(new FormData(e.currentTarget).get("name"));
                void run(
                  () =>
                    versionService.rename(snapshot.event.id, version.id, value),
                  "方案名称已更新",
                );
              }}
            >
              <label>
                方案名称
                <input
                  name="name"
                  aria-label={`重命名方案 ${version.name}`}
                  defaultValue={version.name}
                  required
                  maxLength={80}
                />
              </label>
              <button disabled={busy}>重命名</button>
            </form>
            <small className="muted">
              {new Date(version.createdAt).toLocaleString("zh-CN")}
            </small>
            <div className="actions">
              <button
                disabled={busy}
                onClick={() => {
                  if (
                    window.confirm(
                      `恢复“${version.name}”将覆盖当前活动的名单、桌位、场地与设置。会先保存当前状态检查点，请同时下载JSON备份。确认恢复？`,
                    )
                  )
                    void run(async () => {
                      await versionService.restore(
                        snapshot.event.id,
                        version.id,
                      );
                      historyService.clear(snapshot.event.id);
                    }, "方案已恢复，恢复前状态已保存在检查点");
                }}
              >
                恢复此命名方案
              </button>
              <button
                className="danger"
                disabled={busy}
                onClick={() => {
                  if (
                    window.confirm(
                      `删除命名方案“${version.name}”？当前活动数据保持不变。`,
                    )
                  )
                    void run(async () => {
                      await versionService.delete(
                        snapshot.event.id,
                        version.id,
                      );
                      if (left === version.id) setLeft("");
                      if (right === version.id) setRight("current");
                    }, "命名方案已删除");
                }}
              >
                删除方案
              </button>
            </div>
          </div>
        ))}
      </div>
      {versions?.length === 0 && (
        <p className="muted">暂无命名方案，先保存当前状态即可比较后续变化。</p>
      )}
      <h3>比较两个状态</h3>
      <div className="form-grid">
        {(
          [
            [left, setLeft, "比较起点"],
            [right, setRight, "比较终点"],
          ] as const
        ).map(([value, change, label]) => (
          <label key={label}>
            {label}
            <select
              value={value}
              onChange={(e) => {
                change(e.target.value);
                setPage(0);
              }}
            >
              <option value="">请选择</option>
              <option value="current">当前活动</option>
              {versions?.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name} · {new Date(v.createdAt).toLocaleTimeString("zh-CN")}
                </option>
              ))}
            </select>
          </label>
        ))}
      </div>
      {summary && (
        <p className="notice">
          {summary}。共 {changes.length} 项变化。
        </p>
      )}
      {compareError && (
        <p role="alert" className="error">
          {compareError}
        </p>
      )}
      {changes.length > 0 && (
        <div className="scroll">
          <table className="version-diff">
            <thead>
              <tr>
                <th>变化</th>
                <th>对象</th>
                <th>起点</th>
                <th>终点</th>
              </tr>
            </thead>
            <tbody>
              {changes.slice(page * 30, (page + 1) * 30).map((change, i) => (
                <tr key={i}>
                  <td>{change.kind}</td>
                  <td>{change.label}</td>
                  <td>{change.before}</td>
                  <td>{change.after}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {left && right && !changes.length && !compareError && (
        <p className="muted">两个状态没有业务差异。</p>
      )}
      {changes.length > 30 && (
        <div className="pagination">
          <button disabled={!page} onClick={() => setPage(page - 1)}>
            上一页差异
          </button>
          <span>
            {page + 1} / {Math.ceil(changes.length / 30)}
          </span>
          <button
            disabled={(page + 1) * 30 >= changes.length}
            onClick={() => setPage(page + 1)}
          >
            下一页差异
          </button>
        </div>
      )}
      {message && (
        <p className="success" role="status">
          {message}
        </p>
      )}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <footer>
        <button disabled={busy} onClick={onClose}>
          完成
        </button>
      </footer>
    </Modal>
  );
}
