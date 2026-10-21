import { WorkspaceActions } from "./WorkspaceActions";
import { NextStep } from "./NextStep";
import { SuggestionDialog } from "../seating/SuggestionDialog";
import { VersionDialog } from "../versions/VersionDialog";
import { FloorPlan } from "../floorplan/FloorPlan";
import { TableDetails } from "./TableDetails";
import { errorMessage } from "../../lib/errors";
import { BackupManager } from "../export/BackupManager";
import { DataSafetyPanel } from "../export/DataSafetyPanel";
import { usePeerWarning } from "../../app/usePeerWarning";
import { ImportWizard } from "../import/ImportWizard";
import { ValidationCenter } from "./ValidationCenter";
import { historyService } from "../../domain/historyService";
import { workspaceService } from "../../domain/workspaceService";
import { GuestFilters } from "../seating/GuestFilters";
import { initialFilters } from "../seating/selectors";
import { BatchActions } from "../seating/BatchActions";
import { Board } from "../seating/Board";
import { SplitForm } from "../seating/SplitForm";
import { useState, useSyncExternalStore } from "react";
import {
  Link,
  useParams,
  useLocation,
  useSearchParams,
} from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "../../db/database";
import { repository } from "../../db/repository";
import { seatingService } from "../../domain/services";
import { calculateEventStats } from "../../domain/calculations";
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
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedView = searchParams.get("view");
  const view =
    requestedView === "floor" || requestedView === "board"
      ? requestedView
      : "list";
  function setView(next: string) {
    setSearchParams((previous) => {
      const params = new URLSearchParams(previous);
      if (next === "list") params.delete("view");
      else params.set("view", next);
      return params;
    });
  }
  const peerWarning = usePeerWarning(eventId);
  const [suggesting, setSuggesting] = useState(false),
    [versioning, setVersioning] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [backingUp, setBackingUp] = useState(false);
  const result = useLiveQuery(async () => {
    const event = await db.events.get(eventId);
    return event ? repository.snapshot(eventId) : null;
  }, [eventId]);
  const [table, setTable] = useState<TableEntity | "new" | null>(null);
  const [guest, setGuest] = useState<GuestGroupEntity | "new" | null>(null);
  const [edit, setEdit] = useState(false);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [filters, setFilters] = useState(initialFilters),
    [selected, setSelected] = useState<string[]>([]),
    [split, setSplit] = useState<GuestGroupEntity | null>(null);
  useSyncExternalStore(historyService.subscribe, historyService.getRevision);
  const execute = (action: () => Promise<unknown>) =>
    historyService.execute(eventId, action);
  async function run(action: () => Promise<unknown>, record = true) {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      if (record) await execute(action);
      else await action();
      setMessage("变更已保存到本机");
    } catch (e) {
      setError(errorMessage(e, "保存失败，请检查存储权限"));
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
  const starting =
    !result.guests.length && !result.tables.length && view === "list";
  const showTools =
    !starting ||
    historyService.canUndo(eventId) ||
    historyService.canRedo(eventId);
  const validSelected = selected.filter((id) =>
    result.guests.some((g) => g.id === id),
  );

  return (
    <>
      <Link className="crumb" to="/">
        ← 返回本地活动
      </Link>
      <div className="page-heading workspace-heading">
        <div>
          <h1>{result.event.name}</h1>
          <p className="muted">
            {eventTypes[result.event.type]} ·{" "}
            {result.event.date ?? "日期未设置"} · 按整组安排，超员默认阻止
          </p>
        </div>
        <div className="actions">
          <button onClick={() => setImporting(true)}>导入名单</button>
          <Link className="button" to={`/events/${eventId}/export`}>
            导出交付
          </Link>
          <WorkspaceActions
            onSuggest={() => setSuggesting(true)}
            onVersions={() => setVersioning(true)}
            onEdit={() => setEdit(true)}
            onAddTable={starting ? () => setTable("new") : undefined}
          />
        </div>
      </div>
      {peerWarning && (
        <p role="status" className="notice">
          另一个标签页也在查看此活动。请集中在一个标签页修改；导入与撤销会检测数据冲突。
        </p>
      )}
      {typeof location.state?.restoreReport === "string" && (
        <p role="status" className="success">
          {location.state.restoreReport}
        </p>
      )}
      <NextStep
        snapshot={result}
        view={view}
        busy={busy}
        onImport={() => setImporting(true)}
        onAddGuest={() => setGuest("new")}
        onAddTable={() => setTable("new")}
        onArrange={() => setView("board")}
        onSuggest={() => setSuggesting(true)}
      />
      <div
        className={`stats workspace-stats ${result.guests.length ? "" : "is-empty"}`}
      >
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
      {result.guests.length > 0 && (
        <p className="muted">
          录入 {stats.totalRecordedCount} 人 · 确认 {stats.confirmedCount} ·
          待定 {stats.tentativeCount} · 不参加 {stats.declinedCount} · 总容量{" "}
          {stats.capacity} 席 · 余席 {stats.freeSeats}
        </p>
      )}
      <p className="saved">
        {busy
          ? "正在保存…"
          : `已保存到本机 · ${new Date(result.event.updatedAt).toLocaleString("zh-CN")}`}
      </p>
      {(message || error) && (
        <div className={`workspace-feedback ${error ? "error" : "success"}`}>
          <p role={error ? "alert" : "status"}>{error || message}</p>
          <button
            type="button"
            aria-label="关闭操作反馈"
            onClick={() => {
              setError("");
              setMessage("");
            }}
          >
            关闭
          </button>
        </div>
      )}
      {showTools && (
        <div className="workspace-tools">
          <div
            className="actions"
            role="group"
            aria-label="工作区视图与历史操作"
          >
            <button
              aria-pressed={view === "list"}
              onClick={() => setView("list")}
            >
              名单与桌位
            </button>
            <button
              aria-pressed={view === "floor"}
              onClick={() => setView("floor")}
            >
              场地平面图
            </button>
            <button
              aria-pressed={view === "board"}
              onClick={() => setView("board")}
            >
              排桌工作台
            </button>
            <button
              disabled={busy || !historyService.canUndo(eventId)}
              onClick={() =>
                void run(() => historyService.undo(eventId), false)
              }
            >
              撤销
            </button>
            <button
              disabled={busy || !historyService.canRedo(eventId)}
              onClick={() =>
                void run(() => historyService.redo(eventId), false)
              }
            >
              重做
            </button>
          </div>
          <p className="muted view-purpose">
            {view === "list"
              ? "名单与桌位：录入、修改人数和桌号。"
              : view === "board"
                ? "排桌工作台：把宾客整组移到桌上，也可使用每组下方的菜单。"
                : "场地平面图：查看现场位置，安排宾客；切换“调整布局”再移动圆桌。"}
            <span>撤销最多30步，仅本次会话有效。</span>
          </p>
        </div>
      )}
      {view !== "floor" && result.guests.length > 0 && (
        <>
          <GuestFilters
            snapshot={result}
            value={filters}
            onChange={setFilters}
          />
          {validSelected.length > 0 && (
            <BatchActions
              snapshot={result}
              selected={validSelected}
              clear={() => setSelected([])}
              run={run}
              busy={busy}
            />
          )}
        </>
      )}
      {view === "floor" ? (
        <FloorPlan
          snapshot={result}
          busy={busy}
          run={run}
          execute={execute}
          onDetails={(t) => setDetailId(t.id)}
          onAddTable={() => setTable("new")}
          onAddGuest={() => setGuest("new")}
        />
      ) : view === "board" ? (
        <Board
          snapshot={result}
          filters={filters}
          run={run}
          busy={busy}
          onEdit={(t) => setDetailId(t.id)}
          onAddTable={() => setTable("new")}
          onAddGuest={() => setGuest("new")}
        />
      ) : !starting ? (
        <div className="workspace-grid">
          <TablesPanel
            snapshot={result}
            onAdd={() => setTable("new")}
            onEdit={setTable}
            onDetails={(t) => setDetailId(t.id)}
            run={run}
            busy={busy}
          />
          <GuestsPanel
            onImport={() => setImporting(true)}
            filters={filters}
            selected={selected}
            onSelect={setSelected}
            onSplit={setSplit}
            snapshot={result}
            onAdd={() => setGuest("new")}
            onEdit={setGuest}
            run={run}
            busy={busy}
          />
        </div>
      ) : null}
      {view !== "floor" && result.guests.length > 0 && (
        <details className="workspace-secondary">
          <summary>整桌对调</summary>
          <div className="swapbar">
            <label>
              对调桌位
              <select id="swap-a">
                <option value="">选择第一桌</option>
                {result.tables.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.label} 桌
                  </option>
                ))}
              </select>
            </label>
            <label>
              目标桌位
              <select id="swap-b">
                <option value="">选择第二桌</option>
                {result.tables.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.label} 桌
                  </option>
                ))}
              </select>
            </label>
            <button
              disabled={busy}
              onClick={() => {
                const a = (
                    document.getElementById("swap-a") as HTMLSelectElement
                  ).value,
                  b = (document.getElementById("swap-b") as HTMLSelectElement)
                    .value;
                if (
                  a &&
                  b &&
                  window.confirm("对调两桌全部宾客？桌号与容量不变。")
                )
                  void run(() => workspaceService.swap(eventId, a, b));
              }}
            >
              对调两桌宾客
            </button>
          </div>
        </details>
      )}
      {!starting && (
        <ValidationCenter
          snapshot={result}
          onLocate={(id) => {
            setView("list");
            const target = result.guests.find((g) => g.id === id);
            setFilters(
              target
                ? {
                    ...initialFilters,
                    query: target.displayName,
                    guestId: target.id,
                  }
                : initialFilters,
            );
            requestAnimationFrame(() =>
              requestAnimationFrame(() => {
                const element =
                  document.getElementById(`guest-${id}`) ??
                  document.getElementById(`table-${id}`);
                element?.scrollIntoView({
                  behavior: "smooth",
                  block: "center",
                });
                element?.focus();
              }),
            );
          }}
        />
      )}
      {suggesting && (
        <SuggestionDialog
          snapshot={result}
          execute={execute}
          onClose={() => setSuggesting(false)}
        />
      )}
      {versioning && (
        <VersionDialog snapshot={result} onClose={() => setVersioning(false)} />
      )}
      {importing && (
        <ImportWizard snapshot={result} onClose={() => setImporting(false)} />
      )}
      {!starting && (
        <DataSafetyPanel
          snapshot={result}
          onBackup={() => setBackingUp(true)}
        />
      )}
      {backingUp && (
        <BackupManager eventId={eventId} onClose={() => setBackingUp(false)} />
      )}
      {split && (
        <SplitForm
          eventId={eventId}
          guest={split}
          execute={execute}
          onClose={() => setSplit(null)}
        />
      )}
      {detailId && (
        <TableDetails
          snapshot={result}
          tableId={detailId}
          execute={execute}
          onClose={() => setDetailId(null)}
          onEdit={(t) => {
            setDetailId(null);
            setTable(t);
          }}
        />
      )}
      {table && (
        <TableForm
          execute={execute}
          eventId={eventId}
          initial={table === "new" ? undefined : table}
          capacity={result.event.defaultCapacity}
          onClose={() => setTable(null)}
        />
      )}{" "}
      {guest && (
        <GuestForm
          execute={execute}
          eventId={eventId}
          initial={guest === "new" ? undefined : guest}
          onClose={() => setGuest(null)}
        />
      )}{" "}
      {edit && (
        <EventForm
          initial={result.event}
          onClose={() => setEdit(false)}
          onSave={(input) =>
            execute(() => seatingService.updateEvent(eventId, input))
          }
        />
      )}
    </>
  );
}
