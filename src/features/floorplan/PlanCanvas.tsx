import { snapPoint } from "../../domain/layoutPlanner";
import { useRef, useState, type PointerEvent } from "react";
import { useDroppable } from "@dnd-kit/core";
import type { Snapshot } from "../../domain/models";
import { occupancy } from "../../domain/calculations";
import { clampPoint, layoutOf, TABLE_RADIUS } from "../../domain/geometry";
import type { Point } from "../../domain/venueModels";
export type PlanSelection = { kind: "table" | "area"; id: string };
type PositionedTable = ReturnType<typeof layoutOf>["tables"][number];
function RoundTable({
  table,
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
  return (
    <div
      ref={setNodeRef}
      className={`plan-table ${selected ? "plan-selected" : ""} ${isOver ? "plan-drop" : ""} ${table.locked ? "plan-locked" : ""}`}
      style={{
        left: position.x - TABLE_RADIUS,
        top: position.y - TABLE_RADIUS,
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
    </div>
  );
}
export function PlanCanvas({
  snapshot,
  selection,
  onSelect,
  layoutMode,
  busy,
  scale,
  snapStep = 0,
  onPosition,
}: {
  snapshot: Snapshot;
  selection: PlanSelection | null;
  onSelect: (value: PlanSelection) => void;
  layoutMode: boolean;
  busy: boolean;
  scale: number;
  snapStep?: number;
  onPosition: (selection: PlanSelection, point: Point) => Promise<void>;
}) {
  const { venue, tables } = layoutOf(snapshot);
  const drag = useRef<{
    selection: PlanSelection;
    origin: Point;
    start: Point;
    width: number;
    height: number;
  } | null>(null);
  const [preview, setPreview] = useState<{
    selection: PlanSelection;
    point: Point;
  } | null>(null);
  function start(
    event: PointerEvent<HTMLButtonElement>,
    selected: PlanSelection,
    origin: Point,
    width = 0,
    height = 0,
    locked = false,
  ) {
    onSelect(selected);
    if (!layoutMode || busy || locked || event.button !== 0) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = {
      selection: selected,
      origin,
      start: { x: event.clientX, y: event.clientY },
      width,
      height,
    };
  }
  function coordinates(event: PointerEvent<HTMLButtonElement>) {
    const d = drag.current!;
    const raw = {
      x: d.origin.x + (event.clientX - d.start.x) / scale,
      y: d.origin.y + (event.clientY - d.start.y) / scale,
    };
    if (d.selection.kind === "table")
      return snapStep
        ? snapPoint(raw, venue.width, venue.height, snapStep)
        : clampPoint(raw, venue.width, venue.height);
    return {
      x: Math.round(
        Math.max(
          0,
          Math.min(
            venue.width - d.width,
            snapStep ? Math.round(raw.x / snapStep) * snapStep : raw.x,
          ),
        ),
      ),
      y: Math.round(
        Math.max(
          0,
          Math.min(
            venue.height - d.height,
            snapStep ? Math.round(raw.y / snapStep) * snapStep : raw.y,
          ),
        ),
      ),
    };
  }
  function move(event: PointerEvent<HTMLButtonElement>) {
    if (
      drag.current &&
      Math.hypot(
        event.clientX - drag.current.start.x,
        event.clientY - drag.current.start.y,
      ) >= 3
    )
      setPreview({
        selection: drag.current.selection,
        point: coordinates(event),
      });
  }
  function end(event: PointerEvent<HTMLButtonElement>) {
    if (!drag.current) return;
    const d = drag.current,
      point = coordinates(event);
    drag.current = null;
    setPreview(null);
    if (event.currentTarget.hasPointerCapture(event.pointerId))
      event.currentTarget.releasePointerCapture(event.pointerId);
    if (
      Math.hypot(event.clientX - d.start.x, event.clientY - d.start.y) >= 3 &&
      (point.x !== d.origin.x || point.y !== d.origin.y)
    )
      void onPosition(d.selection, point);
  }
  function cancel() {
    drag.current = null;
    setPreview(null);
  }
  function position(item: PlanSelection, origin: Point) {
    return preview?.selection.id === item.id &&
      preview.selection.kind === item.kind
      ? preview.point
      : origin;
  }
  return (
    <div className="plan-scroll" aria-label="场地画布，可滚动查看" tabIndex={0}>
      <div
        className="plan-scaled-frame"
        style={{ width: venue.width * scale, height: venue.height * scale }}
      >
        <div
          className="plan-world"
          style={{
            width: venue.width,
            height: venue.height,
            transform: `scale(${scale})`,
          }}
        >
          <div className="plan-room-label">
            场地平面图{" "}
            <span>
              {venue.width} × {venue.height} · 画布坐标
            </span>
          </div>
          {venue.areas.map((area) => {
            const selected: PlanSelection = { kind: "area", id: area.id },
              point = position(selected, area);
            return (
              <button
                key={area.id}
                className={`plan-area plan-area-${area.kind} ${selection?.id === area.id ? "plan-area-selected" : ""}`}
                style={{
                  left: point.x,
                  top: point.y,
                  width: area.width,
                  height: area.height,
                  touchAction: layoutMode ? "none" : "auto",
                }}
                aria-label={`区域 ${area.label}`}
                disabled={busy}
                onClick={() => onSelect(selected)}
                onPointerDown={(e) =>
                  start(e, selected, area, area.width, area.height)
                }
                onPointerMove={move}
                onPointerUp={end}
                onPointerCancel={cancel}
              >
                {area.label}
              </button>
            );
          })}
          {tables.map((table) => {
            const selected: PlanSelection = { kind: "table", id: table.id };
            return (
              <RoundTable
                key={table.id}
                table={table}
                snapshot={snapshot}
                position={position(selected, table.position)}
                selected={selection?.id === table.id}
                layoutMode={layoutMode}
                busy={busy}
                onSelect={() => onSelect(selected)}
                onPointerDown={(e) =>
                  start(e, selected, table.position, 0, 0, table.locked)
                }
                onPointerMove={move}
                onPointerUp={end}
                onCancel={cancel}
                onNudge={(x, y) =>
                  void onPosition(
                    selected,
                    clampPoint(
                      { x: table.position.x + x, y: table.position.y + y },
                      venue.width,
                      venue.height,
                    ),
                  )
                }
              />
            );
          })}
          {!tables.length && (
            <p className="plan-empty">先新增桌位，再安排宾客和调整场地布局。</p>
          )}
        </div>
      </div>
    </div>
  );
}
