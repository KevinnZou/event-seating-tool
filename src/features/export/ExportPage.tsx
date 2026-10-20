import { errorMessage } from "../../lib/errors";
import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "../../db/database";
import { repository } from "../../db/repository";
import { calculateEventStats, validateEvent } from "../../domain/calculations";
import { download } from "../../lib/download";
import {
  textReport,
  createCsv,
  guestRows,
  tableRows,
  createXlsx,
} from "./reports";
import { PrintableReport } from "./PrintableReport";
import { BackupManager } from "./BackupManager";
export function ExportPage() {
  const { eventId = "" } = useParams();
  const s = useLiveQuery(
    async () =>
      (await db.events.get(eventId)) ? repository.snapshot(eventId) : null,
    [eventId],
  );
  const [parity, setParity] = useState(false),
    [cards, setCards] = useState(false),
    [backingUp, setBackingUp] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  if (s === undefined) return <p role="status">正在读取名单…</p>;
  if (s === null)
    return (
      <>
        <h1>本机无此活动</h1>
        <Link to="/">返回本地活动</Link>
      </>
    );
  const stats = calculateEventStats(s),
    issues = validateEvent(s),
    blocked = issues.some((i) => i.severity === "error"),
    date = new Date().toISOString().slice(0, 10),
    base = `${s.event.name}_${date}`;
  async function run(a: () => Promise<unknown>) {
    setBusy(true);
    setError("");
    try {
      await a();
    } catch (e) {
      setError(errorMessage(e, "导出失败，请重试"));
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <div className="export-controls">
        <Link className="crumb" to={`/events/${eventId}`}>
          ← 返回排桌工作区
        </Link>
        <div className="page-heading">
          <div>
            <h1>导出交付</h1>
            <p className="muted">
              报表用于交接；完整JSON备份用于恢复。所有文件仅在浏览器生成。
            </p>
          </div>
          <button onClick={() => setBackingUp(true)}>完整备份与恢复</button>
        </div>
        <p className="notice">
          共录入 {stats.totalRecordedCount} 人 / 计划 {stats.plannedCount} 人 /
          已排 {stats.assignedCount} 人 / 未排 {stats.unassignedCount} 人 / 空席{" "}
          {stats.freeSeats}；待定 {stats.tentativeCount} 人，不参加{" "}
          {stats.declinedCount} 人。
        </p>
        {issues.length > 0 && (
          <p className={blocked ? "error" : "notice"}>
            导出检查：{issues.filter((i) => i.severity === "error").length}{" "}
            个错误、{issues.filter((i) => i.severity === "warning").length}{" "}
            个提醒。
            {blocked
              ? "请先修复数据错误。"
              : "未安排者和不参加者均会单独列出，不会被省略。"}
          </p>
        )}
        <p>
          <Link className="button" to={`/events/${eventId}/plan-export`}>
            场地图 SVG / PNG / 打印
          </Link>
        </p>
        <div className="export-buttons">
          <button
            disabled={busy || blocked}
            onClick={() =>
              download(
                textReport(s, parity),
                `${base}_名单.txt`,
                "text/plain;charset=utf-8",
              )
            }
          >
            下载文字名单
          </button>
          <button
            disabled={busy || blocked}
            onClick={() =>
              download(
                createCsv(guestRows(s)),
                `${base}_宾客明细.csv`,
                "text/csv;charset=utf-8",
              )
            }
          >
            下载宾客CSV
          </button>
          <button
            disabled={busy || blocked}
            onClick={() =>
              download(
                createCsv(tableRows(s)),
                `${base}_桌位汇总.csv`,
                "text/csv;charset=utf-8",
              )
            }
          >
            下载桌位CSV
          </button>
          <button
            disabled={busy || blocked}
            onClick={() =>
              download(
                createCsv(guestRows(s, true)),
                `${base}_未安排.csv`,
                "text/csv;charset=utf-8",
              )
            }
          >
            下载未安排CSV
          </button>
          <button
            disabled={busy || blocked}
            onClick={() =>
              void run(async () =>
                download(
                  await createXlsx(s),
                  `${base}_排桌交接.xlsx`,
                  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                ),
              )
            }
          >
            {busy ? "正在生成…" : "下载Excel工作簿"}
          </button>
          <button
            className="primary"
            disabled={busy || blocked}
            onClick={() => window.print()}
          >
            打印 / 保存PDF
          </button>
        </div>
        <div className="actions">
          <label className="check">
            <input
              type="checkbox"
              checked={parity}
              onChange={(e) => setParity(e.target.checked)}
            />
            奇偶桌分组（自定义桌单列）
          </label>
          <label className="check">
            <input
              type="checkbox"
              checked={cards}
              onChange={(e) => setCards(e.target.checked)}
            />
            桌卡版式
          </label>
        </div>
        <p className="muted">
          下方为A4打印预览。浏览器打印对话框中可选择“保存为PDF”，建议关闭浏览器页眉页脚。
        </p>
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
      </div>
      <PrintableReport snapshot={s} parity={parity} cards={cards} />
      {backingUp && (
        <BackupManager eventId={eventId} onClose={() => setBackingUp(false)} />
      )}
    </>
  );
}
