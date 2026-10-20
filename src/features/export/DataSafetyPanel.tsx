import { useEffect, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "../../db/database";
import type { Snapshot } from "../../domain/models";
import { checkpointService } from "../../domain/checkpointService";
import { historyService } from "../../domain/historyService";
export function DataSafetyPanel({
  snapshot,
  onBackup,
}: {
  snapshot: Snapshot;
  onBackup: () => void;
}) {
  const [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  const id = snapshot.event.id;
  const last = useLiveQuery(() => db.localMeta.get(`backup:${id}`), [id]);
  const checkpoints = useLiveQuery(
    () =>
      db.checkpoints.where("eventId").equals(id).reverse().sortBy("createdAt"),
    [id],
  );
  const needsBackup = !last || last.value < snapshot.event.updatedAt;
  useEffect(() => {
    if (!needsBackup || !snapshot.guests.length) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    addEventListener("beforeunload", handler);
    return () => removeEventListener("beforeunload", handler);
  }, [needsBackup, snapshot.guests.length]);
  async function run(a: () => Promise<unknown>, success: string) {
    setBusy(true);
    setError("");
    try {
      await a();
      if (success) setMessage(success);
    } catch (e) {
      setError(e instanceof Error ? e.message : "操作失败");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="panel safety-panel">
      <div className="section-heading">
        <h2>数据安全与检查点</h2>
        <button className={needsBackup ? "primary" : ""} onClick={onBackup}>
          完整备份与恢复
        </button>
      </div>
      <p className={needsBackup ? "notice" : "muted"}>
        {needsBackup
          ? "当前变更尚未触发外部备份下载，建议现在下载。"
          : "最近下载时间覆盖当前活动版本。"}{" "}
        本机检查点与IndexedDB均可能随站点数据清理而丢失。
      </p>
      <p className="muted">
        最近触发下载：
        {last ? new Date(last.value).toLocaleString("zh-CN") : "尚无"}
        。请自行核对文件是否已保存。
      </p>
      <div className="actions">
        <button
          disabled={busy}
          onClick={() =>
            void run(() => checkpointService.create(id), "检查点已保存到本机")
          }
        >
          保存本地检查点
        </button>
        <button
          disabled={busy || !navigator.storage?.persist}
          onClick={() =>
            void run(async () => {
              const granted = await navigator.storage.persist();
              setMessage(
                granted
                  ? "浏览器已同意持久保存，仍请下载外部备份。"
                  : "浏览器未同意持久保存，请定期下载外部备份。",
              );
            }, "")
          }
        >
          申请浏览器持久保存
        </button>
      </div>
      {checkpoints?.length ? (
        <details>
          <summary>本活动检查点（{checkpoints.length}）</summary>
          <ul>
            {checkpoints.map((cp) => (
              <li key={cp.id}>
                {new Date(cp.createdAt).toLocaleString("zh-CN")} ·{" "}
                {cp.reason === "import"
                  ? "导入前"
                  : cp.reason === "manual"
                    ? "手动保存"
                    : "变更前"}{" "}
                <button
                  className="link-button"
                  disabled={busy}
                  onClick={() => {
                    if (
                      window.confirm(
                        "恢复此检查点将覆盖当前活动内容，恢复前会先保存当前状态的检查点。建议同时下载JSON备份。确认继续？",
                      )
                    )
                      void run(async () => {
                        await checkpointService.restore(id, cp.id);
                        historyService.clear(id);
                      }, "检查点已恢复，恢复前状态也已保存");
                  }}
                >
                  恢复此检查点
                </button>
              </li>
            ))}
          </ul>
        </details>
      ) : (
        <p className="muted">暂无检查点。导入和覆盖恢复前会自动保存。</p>
      )}
      {message && (
        <p role="status" className="success">
          {message}
        </p>
      )}
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
    </section>
  );
}
