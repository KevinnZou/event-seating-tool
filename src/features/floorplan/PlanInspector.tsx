import type { FormEvent } from "react";
import type { Snapshot, TableEntity } from "../../domain/models";
import { attendanceLabels } from "../../domain/models";
import { layoutOf } from "../../domain/geometry";
import { venueService } from "../../domain/venueService";
import { workspaceService } from "../../domain/workspaceService";
import type { PlanSelection } from "./PlanCanvas";
import type { VenueArea } from "../../domain/venueModels";
export function PlanInspector({
  snapshot,
  selection,
  run,
  busy,
  onDetails,
  onEditArea,
}: {
  snapshot: Snapshot;
  selection: PlanSelection | null;
  run: (action: () => Promise<unknown>) => Promise<void>;
  busy: boolean;
  onDetails: (table: TableEntity) => void;
  onEditArea: (area: VenueArea) => void;
}) {
  const { venue, tables } = layoutOf(snapshot);
  const item =
    selection?.kind === "table"
      ? tables.find((t) => t.id === selection.id)
      : venue.areas.find((a) => a.id === selection?.id);
  if (!item || !selection)
    return (
      <aside className="panel plan-inspector">
        <h3>选择一张圆桌</h3>
        <p className="muted">
          点击圆桌查看完整名单；切换“调整布局”后可拖动，或填写坐标精确定位。调整位置不会改动人数。
        </p>
      </aside>
    );
  const table =
    selection.kind === "table" ? tables.find((t) => t.id === item.id)! : null;
  const point = table
    ? table.position
    : venue.areas.find((a) => a.id === item.id)!;
  const groups = snapshot.guests.filter((g) => g.tableId === table?.id);
  const pending = snapshot.guests.filter(
    (g) => !g.tableId && g.attendance !== "declined",
  );
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const value = { x: Number(form.get("x")), y: Number(form.get("y")) };
    void run(() =>
      venueService.position(
        snapshot.event.id,
        selection!.kind,
        item!.id,
        value,
      ),
    );
  }
  return (
    <aside className="panel plan-inspector">
      <div className="section-heading">
        <h3>{table ? `${table.label} 桌` : item.label}</h3>
        <span className="muted">
          {table?.locked
            ? "已锁定"
            : table
              ? `${groups.length} 组`
              : "场地区域"}
        </span>
      </div>
      <form
        key={`${selection.kind}:${item.id}:${point.x}:${point.y}`}
        onSubmit={submit}
      >
        <div className="form-grid">
          <label>
            X 坐标
            <input
              name="x"
              aria-label="选中项X坐标"
              type="number"
              min={0}
              max={venue.width}
              required
              defaultValue={point.x}
              disabled={busy || table?.locked}
            />
          </label>
          <label>
            Y 坐标
            <input
              name="y"
              aria-label="选中项Y坐标"
              type="number"
              min={0}
              max={venue.height}
              required
              defaultValue={point.y}
              disabled={busy || table?.locked}
            />
          </label>
        </div>
        <button disabled={busy || table?.locked}>保存位置</button>
      </form>
      {table ? (
        <>
          <button disabled={busy} onClick={() => onDetails(table)}>
            桌位详情与编辑
          </button>
          <label>
            未安排宾客入本桌
            <select
              aria-label="平面图选择宾客入桌"
              value=""
              disabled={busy || table.locked || !pending.length}
              onChange={(e) => {
                const id = e.target.value;
                if (id)
                  void run(() =>
                    workspaceService.move(snapshot.event.id, [id], table.id),
                  );
              }}
            >
              <option value="">选择整组宾客</option>
              {pending.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.displayName}（{g.size}人）
                </option>
              ))}
            </select>
          </label>
          {groups.length ? (
            <ul className="plan-roster">
              {groups.map((g) => (
                <li key={g.id}>
                  <strong>{g.displayName}</strong>
                  <small>
                    {g.size}人 · {attendanceLabels[g.attendance]}
                  </small>
                  <select
                    aria-label={`平面图移动 ${g.displayName}`}
                    value={g.tableId!}
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
                        {t.label} 桌
                      </option>
                    ))}
                  </select>
                </li>
              ))}
            </ul>
          ) : (
            <p className="muted">本桌暂无宾客。</p>
          )}
        </>
      ) : (
        <div className="actions">
          <button onClick={() => onEditArea(item as VenueArea)} disabled={busy}>
            编辑区域
          </button>
          <button
            className="danger"
            disabled={busy}
            onClick={() => {
              if (window.confirm(`删除区域“${item.label}”？宾客和桌位不变。`))
                void run(() =>
                  venueService.deleteArea(snapshot.event.id, item.id),
                );
            }}
          >
            删除区域
          </button>
        </div>
      )}
    </aside>
  );
}
