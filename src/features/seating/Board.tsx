import { useState } from "react";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import type {
  Snapshot,
  GuestGroupEntity,
  TableEntity,
} from "../../domain/models";
import { occupancy } from "../../domain/calculations";
import { workspaceService } from "../../domain/workspaceService";
import { filterGuests, type Filters } from "./selectors";
function Group({
  g,
  snapshot,
  busy,
  run,
}: {
  g: GuestGroupEntity;
  snapshot: Snapshot;
  busy: boolean;
  run: (a: () => Promise<unknown>) => Promise<void>;
}) {
  const locked = snapshot.tables.some((t) => t.id === g.tableId && t.locked);
  const { attributes, listeners, setNodeRef, transform } = useDraggable({
    id: g.id,
    disabled: busy || locked || g.attendance === "declined",
  });
  return (
    <div className="board-group" id={`board-${g.id}`}>
      <button
        ref={setNodeRef}
        {...attributes}
        {...listeners}
        disabled={busy || locked}
        className="drag-handle"
        style={
          transform
            ? {
                transform: `translate(${transform.x}px, ${transform.y}px)`,
                zIndex: 10,
              }
            : undefined
        }
        aria-label={`拖动 ${g.displayName}`}
      >
        ⠿ <strong>{g.displayName}</strong> <span>{g.size} 人</span>
      </button>
      <select
        aria-label={`工作台安排 ${g.displayName}`}
        value={g.tableId ?? ""}
        disabled={busy || locked || g.attendance === "declined"}
        onChange={(e) => {
          const target = e.target.value || null;
          void run(() =>
            workspaceService.move(snapshot.event.id, [g.id], target),
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
    </div>
  );
}
function Zone({
  table,
  snapshot,
  groups,
  busy,
  run,
  onEdit,
}: {
  table: TableEntity | null;
  snapshot: Snapshot;
  groups: GuestGroupEntity[];
  busy: boolean;
  run: (a: () => Promise<unknown>) => Promise<void>;
  onEdit: (t: TableEntity) => void;
}) {
  const { isOver, setNodeRef } = useDroppable({
    id: table?.id ?? "unassigned",
    disabled: table?.locked,
  });
  return (
    <section
      ref={setNodeRef}
      className={`panel board-zone ${isOver ? "drop-over" : ""}`}
    >
      <div className="section-heading">
        <div>
          <h2>{table ? `${table.label} 桌` : "未安排区"}</h2>
          <p className="muted">
            {table
              ? `${occupancy(snapshot, table.id)} / ${table.capacity} 席${table.locked ? " · 已锁定" : ""}`
              : `${groups.reduce((n, g) => n + g.size, 0)} 人 · 整组移动`}
          </p>
        </div>
        {table && (
          <button disabled={table.locked || busy} onClick={() => onEdit(table)}>
            详情 / 编辑
          </button>
        )}
      </div>
      {groups.length ? (
        groups.map((g) => (
          <Group key={g.id} g={g} snapshot={snapshot} run={run} busy={busy} />
        ))
      ) : (
        <p className="muted">
          {table
            ? "尚无符合筛选的宾客，可拖入或用菜单安排"
            : "暂无符合筛选的未安排宾客"}
        </p>
      )}
    </section>
  );
}
export function Board({
  snapshot,
  filters,
  run,
  busy,
  onEdit,
}: {
  snapshot: Snapshot;
  filters: Filters;
  run: (a: () => Promise<unknown>) => Promise<void>;
  busy: boolean;
  onEdit: (t: TableEntity) => void;
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor),
  );
  const [parity, setParity] = useState("");
  const guests = filterGuests(snapshot, filters);
  return (
    <DndContext
      sensors={sensors}
      onDragEnd={({ active, over }) => {
        if (over)
          void run(() =>
            workspaceService.move(
              snapshot.event.id,
              [String(active.id)],
              over.id === "unassigned" ? null : String(over.id),
            ),
          );
      }}
    >
      <div className="board-toolbar">
        <p className="muted">
          拖动整组宾客，或使用每组的桌位菜单。锁定桌需先解锁。
        </p>
        <label>
          桌位显示
          <select value={parity} onChange={(e) => setParity(e.target.value)}>
            <option value="">全部桌位</option>
            <option value="odd">奇数桌及自定义桌</option>
            <option value="even">偶数桌及自定义桌</option>
          </select>
        </label>
      </div>
      <div className="seating-board">
        <aside>
          <Zone
            table={null}
            groups={guests.filter(
              (g) => !g.tableId && g.attendance !== "declined",
            )}
            snapshot={snapshot}
            run={run}
            busy={busy}
            onEdit={onEdit}
          />
        </aside>
        <div className="table-grid">
          {snapshot.tables
            .filter(
              (t) =>
                !parity ||
                !/^\d+$/.test(t.label) ||
                Number(t.label) % 2 === (parity === "odd" ? 1 : 0),
            )
            .map((t) => (
              <Zone
                key={t.id}
                table={t}
                groups={guests.filter((g) => g.tableId === t.id)}
                snapshot={snapshot}
                run={run}
                busy={busy}
                onEdit={onEdit}
              />
            ))}
        </div>
      </div>
    </DndContext>
  );
}
