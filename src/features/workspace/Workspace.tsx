import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "../../db/database";
import { repository } from "../../db/repository";
import { seatingService } from "../../domain/services";
import { calculateEventStats, validateEvent } from "../../domain/calculations";
import {
  eventTypes,
  type GuestGroupEntity,
  type TableEntity,
} from "../../domain/models";
import { EventForm } from "../events/EventForm";
import { GuestForm } from "./GuestForm";
import { TableForm } from "./TableForm";
import { TablesPanel } from "./TablesPanel";
import { GuestsPanel } from "./GuestsPanel";
export function Workspace() {
  const { eventId = "" } = useParams();
  const result = useLiveQuery(async () => {
    const event = await db.events.get(eventId);
    return event ? repository.snapshot(eventId) : null;
  }, [eventId]);
  const [table, setTable] = useState<TableEntity | "new" | null>(null);
  const [guest, setGuest] = useState<GuestGroupEntity | "new" | null>(null);
  const [edit, setEdit] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  async function run(action: () => Promise<unknown>) {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await action();
      setMessage("变更已保存到本机");
    } catch (e) {
      setError(e instanceof Error ? e.message : "保存失败，请检查存储权限");
    } finally {
      setBusy(false);
    }
  }
  if (result === undefined) return <p role="status">正在读取本地数据…</p>;
  if (result === null)
    return (
      <>
        <h1>本机无此活动</h1>
        <p>此链接只指向当前浏览器中的活动。</p>
        <Link to="/">返回本地活动</Link>
      </>
    );
  const stats = calculateEventStats(result);
  const issues = validateEvent(result);
  return (
    <>
      <Link className="crumb" to="/">
        ← 返回本地活动
      </Link>
      <div className="page-heading">
        <div>
          <h1>{result.event.name}</h1>
          <p className="muted">
            {eventTypes[result.event.type]} ·{" "}
            {result.event.date ?? "日期未设置"} · 按整组安排，超员默认阻止
          </p>
        </div>
        <button onClick={() => setEdit(true)}>编辑活动</button>
      </div>
      <div className="stats">
        {[
          ["计划出席", stats.plannedCount],
          ["桌位数量", stats.tableCount],
          ["已安排人数", stats.assignedCount],
          ["未安排人数", stats.unassignedCount],
        ].map(([label, value]) => (
          <div className="stat" key={label}>
            <strong data-testid={`stat-${label}`}>{value}</strong>
            <span>{label}</span>
          </div>
        ))}
      </div>
      <p className="muted">
        录入 {stats.totalRecordedCount} 人 · 确认 {stats.confirmedCount} · 待定{" "}
        {stats.tentativeCount} · 不参加 {stats.declinedCount} · 总容量{" "}
        {stats.capacity} 席 · 余席 {stats.freeSeats}
      </p>
      <p className="saved">
        {busy
          ? "正在保存…"
          : `已保存到本机 · ${new Date(result.event.updatedAt).toLocaleString("zh-CN")}`}
      </p>
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
      <div className="workspace-grid">
        <TablesPanel
          snapshot={result}
          onAdd={() => setTable("new")}
          onEdit={setTable}
          run={run}
          busy={busy}
        />
        <GuestsPanel
          snapshot={result}
          onAdd={() => setGuest("new")}
          onEdit={setGuest}
          run={run}
          busy={busy}
        />
      </div>
      <section className="panel issues">
        <h2>基础数据检查</h2>
        <p className="muted">
          按人数统计；同名只提醒，绝不合并。完整校验中心将在 M3 提供。
        </p>
        {issues.length ? (
          <ul>
            {issues.map((issue, i) => (
              <li key={`${issue.code}-${i}`}>
                {issue.severity === "error" ? "错误" : "提醒"}：{issue.message}
              </li>
            ))}
          </ul>
        ) : (
          <p>暂无数据问题</p>
        )}
      </section>
      <p className="notice" style={{ marginTop: 20 }}>
        仅保存在当前浏览器。M1 暂无文件备份，请使用虚构数据试用。
      </p>
      {table && (
        <TableForm
          eventId={eventId}
          initial={table === "new" ? undefined : table}
          capacity={result.event.defaultCapacity}
          onClose={() => setTable(null)}
        />
      )}{" "}
      {guest && (
        <GuestForm
          eventId={eventId}
          initial={guest === "new" ? undefined : guest}
          onClose={() => setGuest(null)}
        />
      )}{" "}
      {edit && (
        <EventForm
          initial={result.event}
          onClose={() => setEdit(false)}
          onSave={(input) => seatingService.updateEvent(eventId, input)}
        />
      )}
    </>
  );
}
