import { LayoutDialog } from "./LayoutDialog";
import { tableChoices } from "../seating/tableChoices";
import { Link, useSearchParams } from "react-router-dom";
import { ROSTER_COORDINATE_SCALE } from "./planPresentation";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useDraggable,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import type {
  GuestGroupEntity,
  Snapshot,
  TableEntity,
} from "../../domain/models";
import type { VenueArea } from "../../domain/venueModels";
import { layoutOf, layoutWarnings } from "../../domain/geometry";
import { venueService } from "../../domain/venueService";
import { workspaceService } from "../../domain/workspaceService";
import { searchText } from "../seating/selectors";
import { PlanCanvas, type PlanSelection } from "./PlanCanvas";
import { PlanInspector } from "./PlanInspector";
import { AreaForm } from "./AreaForm";
function PendingGroup({
  guest,
  disabled,
  onSelect,
  selected,
}: {
  guest: GuestGroupEntity;
  disabled: boolean;
  onSelect: () => void;
  selected: boolean;
}) {
  const { setNodeRef, listeners, attributes, transform } = useDraggable({
    id: guest.id,
    disabled,
  });
  return (
    <button
      className="plan-pending-group"
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      disabled={disabled}
      onClick={onSelect}
      aria-expanded={selected}
      aria-label={`平面图拖动 ${guest.displayName}`}
      style={
        transform
          ? {
              transform: `translate(${transform.x}px, ${transform.y}px)`,
              zIndex: 20,
            }
          : undefined
      }
    >
      <strong>{guest.displayName}</strong>
      <span>{guest.size} 人</span>
    </button>
  );
}
export function FloorPlan({
  snapshot,
  busy,
  run,
  execute,
  onDetails,
  onAddTable,
  onAddGuest,
}: {
  snapshot: Snapshot;
  busy: boolean;
  run: (action: () => Promise<unknown>) => Promise<void>;
  execute: (action: () => Promise<unknown>) => Promise<void>;
  onDetails: (table: TableEntity) => void;
  onAddTable: () => void;
  onAddGuest: () => void;
}) {
  const [params, setParams] = useSearchParams();
  const showRoster = params.get("roster") === "1";
  const rosterCheckbox = useRef<HTMLInputElement>(null);
  // Native click feedback stays immediate while URL navigation commits.
  // Sync Back/Forward without replacing the focused checkbox.
  useLayoutEffect(() => {
    if (rosterCheckbox.current) rosterCheckbox.current.checked = showRoster;
  }, [showRoster]);
  const [organizing, setOrganizing] = useState(false);
  const [snap, setSnap] = useState(true);
  const [selection, setSelection] = useState<PlanSelection | null>(null),
    [layoutMode, setLayoutMode] = useState(false),
    [zoom, setZoom] = useState(1),
    [query, setQuery] = useState("");
  const [pendingOpen, setPendingOpen] = useState(
    () => !window.matchMedia("(max-width: 650px)").matches,
  );
  const [chosenGuestId, setChosenGuestId] = useState("");
  const [targetTableId, setTargetTableId] = useState("");
  const chosenGuest = snapshot.guests.find(
    (g) => g.id === chosenGuestId && !g.tableId && g.attendance !== "declined",
  );
  const choices = chosenGuest ? tableChoices(snapshot, chosenGuest) : [];
  const [activeGuest, setActiveGuest] = useState<GuestGroupEntity | null>(null);
  const [area, setArea] = useState<VenueArea | "new" | "aisle" | null>(null);
  const [width, setWidth] = useState(800);
  const container = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const observer = new ResizeObserver((entries) =>
      setWidth(entries[0].contentRect.width),
    );
    if (container.current) observer.observe(container.current);
    return () => observer.disconnect();
  }, []);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
  );
  const { venue } = layoutOf(snapshot),
    fit = Math.min(
      1,
      Math.max(
        0.1,
        (width - 16) /
          (venue.width * (showRoster ? ROSTER_COORDINATE_SCALE : 1)),
      ),
    ),
    baseScale = Math.max(showRoster ? 0.8 : 0.45, fit),
    scale = baseScale * zoom;
  const pending = snapshot.guests.filter(
    (g) => !g.tableId && g.attendance !== "declined",
  );
  const shown = pending.filter((g) =>
    searchText(g.displayName + " " + (g.category ?? "")).includes(
      query.trim().toLowerCase(),
    ),
  );
  const warnings = layoutWarnings(snapshot);
  return (
    <section className="floorplan-feature" aria-label="场地平面图工作区">
      <div className="plan-heading">
        <div>
          <span className="eyebrow">VENUE / 圆桌布局</span>
          <h2>场地平面图</h2>
          <p className="muted">
            圆桌位置与宾客安排分别调整；一组宾客始终占用其完整人数。
          </p>
        </div>
        <div className="actions">
          <Link
            className="button primary"
            to={`/events/${snapshot.event.id}/plan-export`}
          >
            导出场地图
          </Link>
          <button onClick={onAddTable}>新增桌位</button>
          <button onClick={onAddGuest}>新增宾客组</button>
        </div>
      </div>
      <div className="plan-toolbar">
        <div className="actions">
          <button
            aria-pressed={!layoutMode}
            onClick={() => setLayoutMode(false)}
          >
            安排宾客
          </button>
          <button aria-pressed={layoutMode} onClick={() => setLayoutMode(true)}>
            调整布局
          </button>
          <button
            disabled={busy || !snapshot.tables.length}
            onClick={() => setOrganizing(true)}
          >
            一键整理
          </button>
          <details className="plan-edit-tools" open={layoutMode}>
            <summary>舞台、过道与吸附</summary>
            <div className="actions">
              <button disabled={busy} onClick={() => setArea("aisle")}>
                添加过道
              </button>
              <label className="check plan-snap">
                <input
                  type="checkbox"
                  checked={snap}
                  onChange={(e) => setSnap(e.target.checked)}
                />
                吸附网格（20）
              </label>
              <button onClick={() => setArea("new")} disabled={busy}>
                添加舞台 / 入口
              </button>
            </div>
          </details>
        </div>
        <div className="actions">
          <button
            aria-label="缩小场地图"
            disabled={zoom <= 0.3}
            onClick={() => setZoom(Math.max(0.3, zoom - 0.2))}
          >
            −
          </button>
          <span>{Math.round(scale * 100)}%</span>
          <button
            aria-label="放大场地图"
            disabled={zoom >= 3}
            onClick={() => setZoom(Math.min(3, zoom + 0.2))}
          >
            ＋
          </button>
          <label className="check plan-roster-toggle">
            <input
              type="checkbox"
              ref={rosterCheckbox}
              defaultChecked={showRoster}
              onChange={(event) => {
                const enabled = event.target.checked;
                setParams(
                  (current) => {
                    const next = new URLSearchParams(current);
                    if (enabled) next.set("roster", "1");
                    else next.delete("roster");
                    return next;
                  },
                  { replace: true },
                );
                setZoom(1);
              }}
            />
            显示宾客名单
          </label>
          <button onClick={() => setZoom(fit / baseScale)}>适应画布</button>
        </div>
      </div>
      <p className="plan-mode-hint">
        {layoutMode
          ? "拖动圆桌或区域调整位置。选中圆桌后可用方向键每次移动10，或在详情填写坐标；锁定桌不可移动，过道及缓冲区禁止放桌。"
          : "点击未安排宾客选择目标桌，或将整组拖入圆桌。点击圆桌查看名单和换桌菜单。"}
      </p>
      {showRoster && (
        <p className="muted">
          名单视图已放大显示间距，实际桌位不变。可滚动画布或缩放查看各桌；每桌名单较多时可在名单内滚动。
        </p>
      )}
      <DndContext
        sensors={sensors}
        onDragStart={({ active }) =>
          setActiveGuest(
            snapshot.guests.find((g) => g.id === active.id) ?? null,
          )
        }
        onDragCancel={() => setActiveGuest(null)}
        onDragEnd={({ active, over }) => {
          setActiveGuest(null);
          if (over && !layoutMode)
            void run(() =>
              workspaceService.move(
                snapshot.event.id,
                [String(active.id)],
                String(over.id),
              ),
            );
        }}
      >
        <div className="plan-layout">
          <aside className="panel plan-pending">
            <details
              open={pendingOpen}
              onToggle={(e) => setPendingOpen(e.currentTarget.open)}
            >
              <summary>
                <h3>
                  未安排{" "}
                  <span>{pending.reduce((sum, g) => sum + g.size, 0)} 人</span>
                </h3>
              </summary>
              <label>
                查找未安排宾客
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="姓名、拼音或分组"
                />
              </label>
              <p className="muted">
                显示 {Math.min(50, shown.length)} / {shown.length} 组
                {shown.length > 50 ? "，请搜索缩小范围" : ""}
              </p>
              <div className="plan-pending-list">
                {shown.slice(0, 50).map((guest) => (
                  <PendingGroup
                    key={guest.id}
                    guest={guest}
                    disabled={busy || layoutMode}
                    selected={chosenGuestId === guest.id}
                    onSelect={() => {
                      setChosenGuestId(
                        chosenGuestId === guest.id ? "" : guest.id,
                      );
                      setTargetTableId("");
                    }}
                  />
                ))}
                {!shown.length && (
                  <p className="muted">暂无符合条件的未安排宾客。</p>
                )}
              </div>
              {chosenGuest && !layoutMode && (
                <form
                  className="plan-quick-seat"
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (
                      targetTableId &&
                      choices.some((c) => c.id === targetTableId && !c.disabled)
                    )
                      void run(() =>
                        workspaceService.move(
                          snapshot.event.id,
                          [chosenGuest.id],
                          targetTableId,
                        ),
                      );
                  }}
                >
                  <strong>
                    {chosenGuest.displayName} · {chosenGuest.size} 人
                  </strong>
                  <label>
                    目标圆桌
                    <select
                      aria-label="为选中宾客选择圆桌"
                      value={targetTableId}
                      disabled={busy}
                      onChange={(e) => setTargetTableId(e.target.value)}
                    >
                      <option value="">选择可容纳整组的桌</option>
                      {choices.map((c) => (
                        <option key={c.id} value={c.id} disabled={c.disabled}>
                          {c.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  {choices.every((c) => c.disabled) && (
                    <p className="muted">
                      暂无可容纳本组的未锁定桌，请新增桌位或调整容量。
                    </p>
                  )}
                  <button
                    className="primary"
                    disabled={
                      busy ||
                      !choices.some(
                        (c) => c.id === targetTableId && !c.disabled,
                      )
                    }
                  >
                    确认安排整组
                  </button>
                </form>
              )}
            </details>
          </aside>
          <div ref={container} className="plan-center">
            <PlanCanvas
              snapshot={snapshot}
              selection={selection}
              onSelect={setSelection}
              layoutMode={layoutMode}
              busy={busy}
              scale={scale}
              showRoster={showRoster}
              snapStep={snap ? 20 : 0}
              onPosition={(selected, point) =>
                run(() =>
                  venueService.position(
                    snapshot.event.id,
                    selected.kind,
                    selected.id,
                    point,
                  ),
                )
              }
            />
            {selection && (
              <button
                className="plan-inspector-shortcut"
                onClick={() => {
                  const inspector = document.getElementById("plan-inspector");
                  inspector?.scrollIntoView({
                    block: "nearest",
                    behavior: window.matchMedia(
                      "(prefers-reduced-motion: reduce)",
                    ).matches
                      ? "instant"
                      : "smooth",
                  });
                  inspector?.focus({ preventScroll: true });
                }}
              >
                查看选中项详情与名单 ↓
              </button>
            )}
          </div>
          <PlanInspector
            snapshot={snapshot}
            selection={selection}
            run={run}
            busy={busy}
            onDetails={onDetails}
            onEditArea={setArea}
          />
        </div>
        <DragOverlay dropAnimation={null}>
          {activeGuest && (
            <div className="plan-drag-ghost">
              {activeGuest.displayName} · {activeGuest.size} 人
            </div>
          )}
        </DragOverlay>
      </DndContext>
      {warnings.length > 0 && (
        <details className="notice">
          <summary>布局提醒 {warnings.length} 项：有桌位或区域重叠</summary>
          <ul>
            {warnings.map((warning, i) => (
              <li key={i}>{warning}</li>
            ))}
          </ul>
        </details>
      )}
      <details className="panel plan-settings">
        <summary>画布尺寸与自动整理</summary>
        <form
          key={`${venue.width}:${venue.height}`}
          onSubmit={(e) => {
            e.preventDefault();
            const form = new FormData(e.currentTarget),
              w = Number(form.get("width")),
              h = Number(form.get("height"));
            void run(() => venueService.resize(snapshot.event.id, w, h));
          }}
        >
          <div className="form-grid">
            <label>
              画布宽度
              <input
                name="width"
                type="number"
                min={400}
                max={12000}
                required
                defaultValue={venue.width}
              />
            </label>
            <label>
              画布高度
              <input
                name="height"
                type="number"
                min={400}
                max={12000}
                required
                defaultValue={venue.height}
              />
            </label>
          </div>
          <button disabled={busy}>保存画布尺寸</button>
        </form>
        <button
          disabled={busy || !snapshot.tables.length}
          onClick={() => setOrganizing(true)}
        >
          自动整理未锁定桌
        </button>
      </details>
      {organizing && (
        <LayoutDialog
          snapshot={snapshot}
          execute={execute}
          onClose={() => setOrganizing(false)}
        />
      )}
      {area && (
        <AreaForm
          eventId={snapshot.event.id}
          initial={typeof area === "string" ? undefined : area}
          defaultArea={
            area === "aisle"
              ? {
                  kind: "aisle",
                  label: "中央过道",
                  x: Math.round((venue.width - 120) / 2),
                  y: 0,
                  width: 120,
                  height: venue.height,
                }
              : undefined
          }
          execute={execute}
          onClose={() => setArea(null)}
        />
      )}
    </section>
  );
}
