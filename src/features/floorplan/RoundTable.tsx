import type { PointerEvent } from "react";
import { useDroppable } from "@dnd-kit/core";
import type { Snapshot } from "../../domain/models";
import { occupancy } from "../../domain/calculations";
import { layoutOf, TABLE_RADIUS } from "../../domain/geometry";
import type { Point } from "../../domain/venueModels";
import { ROSTER_COORDINATE_SCALE } from "./planPresentation";
type PositionedTable = ReturnType<typeof layoutOf>["tables"][number];
export function RoundTable({
  table,
  showRoster,
  snapshot,
  position,
  selected,
  layoutMode,
  busy,
  onSelect,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onCancel,
  onNudge,
}: {
  table: PositionedTable;
  showRoster: boolean;
  snapshot: Snapshot;
  position: Point;
  selected: boolean;
  layoutMode: boolean;
  busy: boolean;
  onSelect: () => void;
  onPointerDown: (e: PointerEvent<HTMLButtonElement>) => void;
  onPointerMove: (e: PointerEvent<HTMLButtonElement>) => void;
  onPointerUp: (e: PointerEvent<HTMLButtonElement>) => void;
  onCancel: () => void;
  onNudge: (x: number, y: number) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: table.id,
    disabled: layoutMode || busy || table.locked,
  });
  const used = occupancy(snapshot, table.id);
  const groups = snapshot.guests.filter((guest) => guest.tableId === table.id);
  const factor = showRoster ? ROSTER_COORDINATE_SCALE : 1;
  return (
    <div
      ref={setNodeRef}
      className={`plan-table ${showRoster ? "plan-table-with-roster" : ""} ${selected ? "plan-selected" : ""} ${isOver ? "plan-drop" : ""} ${table.locked ? "plan-locked" : ""}`}
      style={{
        left: position.x * factor - (showRoster ? 108 : TABLE_RADIUS),
        top: position.y * factor - (showRoster ? 122 : TABLE_RADIUS),
      }}
    >
      <button
        aria-label={`平面图 ${table.label} 桌，${used}/${table.capacity}席${table.locked ? "，已锁定" : ""}`}
        aria-pressed={selected}
        disabled={busy}
        onClick={onSelect}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onCancel}
        onKeyDown={(event) => {
          if (!layoutMode || table.locked) return;
          const delta = (
            {
              ArrowLeft: [-10, 0],
              ArrowRight: [10, 0],
              ArrowUp: [0, -10],
              ArrowDown: [0, 10],
            } as Record<string, number[]>
          )[event.key];
          if (delta) {
            event.preventDefault();
            onNudge(delta[0], delta[1]);
          }
        }}
        style={{
          touchAction: layoutMode ? "none" : "auto",
          cursor: layoutMode && !table.locked ? "grab" : "pointer",
        }}
      >
        <strong>{table.label}</strong>
        <span>
          {used} / {table.capacity}
        </span>
        <small>
          {table.locked
            ? "已锁定"
            : used === table.capacity
              ? "满桌"
              : `余 ${table.capacity - used} 席`}
        </small>
      </button>
      {showRoster && (
        <div
          className="plan-inline-roster"
          role="region"
          aria-label={`${table.label}桌宾客名单`}
          tabIndex={0}
        >
          {groups.length ? (
            <ul>
              {groups.map((guest) => (
                <li key={guest.id}>
                  <span className="plan-guest-name">
                    {guest.displayName}
                    {guest.attendance === "tentative" && <small>待定</small>}
                  </span>
                  <span className="plan-guest-size">×{guest.size}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="muted">暂无宾客</p>
          )}
        </div>
      )}
    </div>
  );
}
