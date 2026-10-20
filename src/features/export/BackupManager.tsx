import { errorMessage } from "../../lib/errors";
import { historyService } from "../../domain/historyService";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "../../db/database";
import { Modal } from "../../components/ui/Modal";
import { downloadBackup } from "./backupDownloads";
import { decodeBackup, type Backup } from "./backup";
import { backupService } from "./backupService";
export function BackupManager({
  eventId,
  onClose,
}: {
  eventId?: string;
  onClose: () => void;
}) {
  const [backup, setBackup] = useState<Backup | null>(null),
    [mode, setMode] = useState<"new" | "overwrite">("new"),
    [confirm, setConfirm] = useState(""),
    [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  const navigate = useNavigate();
  const [includeCheckpoints, setIncludeCheckpoints] = useState(true);
  const last = useLiveQuery(
    () => db.localMeta.get(eventId ? `backup:${eventId}` : "lastBackup"),
    [eventId],
  );
  async function run(a: () => Promise<unknown>) {
    setBusy(true);
    setError("");
    try {
      await a();
    } catch (e) {
      setError(errorMessage(e, "备份操作失败，未完成写入"));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal title="完整备份与恢复" onClose={onClose}>
      <div className="import-wizard">
        <p>
          JSON包含活动、桌位、宾客、安排、活动设置及本地检查点。请将文件存到安全位置；仅保存在本机的检查点不能替代外部备份。
        </p>
        <p className="muted">
          最近触发下载：
          {last ? new Date(last.value).toLocaleString("zh-CN") : "尚无"}
          （不代表浏览器已确认文件保存）
        </p>
        <label className="check">
          <input
            type="checkbox"
            checked={includeCheckpoints}
            onChange={(e) => setIncludeCheckpoints(e.target.checked)}
          />
          下载时包含历史检查点（取消后仅备份全部当前数据，检查点仍留在本机）
        </label>
        <div className="actions">
          <button
            className="primary"
            disabled={busy}
            onClick={() =>
              void run(async () => {
                await downloadBackup(eventId, includeCheckpoints);
                setMessage("已触发完整备份下载，请核对下载文件。");
              })
            }
          >
            下载{eventId ? "本活动" : "全部活动"}完整备份
          </button>
          {eventId && (
            <button
              disabled={busy}
              onClick={() =>
                void run(async () => {
                  await downloadBackup(undefined, includeCheckpoints);
                  setMessage("已触发全部活动备份下载。");
                })
              }
            >
              下载全部活动备份
            </button>
          )}
        </div>
        <hr />
        <label>
          选择 JSON 备份（最多10MB）
          <input
            type="file"
            accept=".json,application/json"
            disabled={busy}
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (!file) return;
              setBackup(null);
              setMessage("");
              void run(async () => {
                if (file.size > 10 * 1024 * 1024)
                  throw new Error("备份文件上限10MB");
                setBackup(decodeBackup(await file.text()));
              });
            }}
          />
        </label>
        {backup && (
          <>
            <p className="notice">
              已验证：{backup.events.length} 场活动 /{" "}
              {backup.guestGroups.length} 组 / {backup.tables.length} 桌 /{" "}
              {backup.checkpoints.length} 个检查点。导出时间{" "}
              {new Date(backup.exportedAt).toLocaleString("zh-CN")}。
            </p>
            <label>
              恢复方式
              <select
                value={mode}
                onChange={(e) => {
                  setMode(e.target.value as "new" | "overwrite");
                  setConfirm("");
                }}
              >
                <option value="new">导入为新活动（推荐，不覆盖）</option>
                <option value="overwrite">按ID覆盖备份中的活动</option>
              </select>
            </label>
            {mode === "overwrite" && (
              <>
                <p className="error">
                  将覆盖相同ID的活动，其他活动保留。请先下载当前全部备份；覆盖前也会自动保存本地检查点。
                </p>
                <button
                  disabled={busy}
                  onClick={() => void run(() => downloadBackup())}
                >
                  先下载当前全部备份
                </button>
                <label>
                  输入“覆盖所选活动”确认
                  <input
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                  />
                </label>
              </>
            )}
            <button
              className="primary"
              disabled={
                busy || (mode === "overwrite" && confirm !== "覆盖所选活动")
              }
              onClick={() =>
                void run(async () => {
                  const report = await backupService.restore(
                    backup,
                    mode,
                    confirm,
                  );
                  historyService.reset();
                  setBackup(null);
                  setMessage(
                    `恢复成功：${report.events} 场活动、${report.groups} 组、${report.tables} 桌；计划 ${report.planned} 人，已排 ${report.assigned} 人。`,
                  );
                  if (report.firstEventId)
                    navigate(`/events/${report.firstEventId}`, {
                      state: {
                        restoreReport: `恢复成功：${report.events} 场活动、${report.groups} 组、${report.tables} 桌；计划 ${report.planned} 人，已排 ${report.assigned} 人。`,
                      },
                    });
                })
              }
            >
              确认恢复
            </button>
          </>
        )}
        {message && (
          <p role="status" className="notice">
            {message}
          </p>
        )}
        {error && (
          <p role="alert" className="error">
            {error}
          </p>
        )}
        <button onClick={onClose}>关闭备份与恢复</button>
      </div>
    </Modal>
  );
}
