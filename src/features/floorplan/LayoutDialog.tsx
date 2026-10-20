import { useState } from "react";
import { Modal } from "../../components/ui/Modal";
import type { Snapshot } from "../../domain/models";
import {
  defaultLayoutOptions,
  planLayout,
  type LayoutOptions,
} from "../../domain/layoutPlanner";
import { layoutOf } from "../../domain/geometry";
import { fingerprint } from "../../domain/snapshots";
import { venueService } from "../../domain/venueService";
import { errorMessage } from "../../lib/errors";
export function LayoutDialog({
  snapshot,
  execute,
  onClose,
}: {
  snapshot: Snapshot;
  execute: (action: () => Promise<unknown>) => Promise<unknown>;
  onClose: () => void;
}) {
  const [options, setOptions] = useState<LayoutOptions>(defaultLayoutOptions);
  const [aisleId] = useState(() => crypto.randomUUID());
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  let preview: Snapshot | null = null,
    problem = "";
  try {
    preview = planLayout(snapshot, options, aisleId);
  } catch (e) {
    problem = errorMessage(e, "无法按当前设置整理");
  }
  const before = layoutOf(snapshot),
    after = preview ? layoutOf(preview) : null;
  const moved =
    after?.tables.filter((t) => {
      const old = before.tables.find((b) => b.id === t.id)!;
      return old.position.x !== t.position.x || old.position.y !== t.position.y;
    }).length ?? 0;
  return (
    <Modal
      title="整理桌位布局"
      onClose={() => {
        if (!busy) onClose();
      }}
    >
      <p className="muted">
        按行对齐、避开所有区域并保留缓冲。只调整未锁定桌的位置，宾客安排不变，可撤销。
      </p>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          if (!preview || busy) return;
          setBusy(true);
          setError("");
          try {
            await execute(() =>
              venueService.arrange(
                snapshot.event.id,
                options,
                fingerprint(snapshot),
              ),
            );
            onClose();
          } catch (e) {
            setError(errorMessage(e, "整理失败，未改变布局"));
          } finally {
            setBusy(false);
          }
        }}
      >
        <div className="form-grid">
          {(
            [
              ["columns", "每行最多桌数", 1, 30],
              ["columnGap", "列间净距", 0, 1000],
              ["rowGap", "行间净距", 0, 1000],
              ["aisleWidth", "中央过道宽度", 80, 1000],
            ] as const
          ).map(([key, label, min, max]) => (
            <label key={key}>
              {label}
              <input
                type="number"
                min={min}
                max={max}
                required
                value={options[key]}
                onChange={(e) =>
                  setOptions({ ...options, [key]: Number(e.target.value) })
                }
                disabled={
                  busy ||
                  (key === "aisleWidth" &&
                    (!options.centralAisle ||
                      before.venue.areas.some((a) => a.kind === "aisle")))
                }
              />
            </label>
          ))}
        </div>
        <label className="check">
          <input
            type="checkbox"
            checked={options.centralAisle}
            disabled={busy}
            onChange={(e) =>
              setOptions({ ...options, centralAisle: e.target.checked })
            }
          />
          预留中央过道（尚无过道时创建）
        </label>
        <p className="muted">
          已有过道始终避让，不会被覆盖或删除。尺寸均为画布单位，桌径96，区域额外留24缓冲；不代表实际米数。设置用于本次整理，保存的是最终位置与过道。
        </p>
        {problem && (
          <p role="alert" className="error">
            {problem}
          </p>
        )}
        {after && (
          <>
            <svg
              className="layout-mini-preview"
              viewBox={`0 0 ${after.venue.width} ${after.venue.height}`}
              role="img"
              aria-label="自动整理布局预览"
            >
              {after.venue.areas.map((a) => (
                <g key={a.id}>
                  <rect
                    x={a.x}
                    y={a.y}
                    width={a.width}
                    height={a.height}
                    fill={a.kind === "aisle" ? "#f3dfb3" : "#dce8df"}
                  />
                  <text x={a.x + 4} y={a.y + 20} fontSize="18">
                    {a.label}
                  </text>
                </g>
              ))}
              {after.tables.map((t) => (
                <g key={t.id}>
                  <circle
                    cx={t.position.x}
                    cy={t.position.y}
                    r="48"
                    fill={t.locked ? "#eee9df" : "#fff"}
                    stroke="#14665f"
                    strokeWidth="3"
                  />
                  <text
                    x={t.position.x}
                    y={t.position.y + 7}
                    textAnchor="middle"
                    fontSize="22"
                  >
                    {t.label}
                  </text>
                </g>
              ))}
            </svg>
            <p role="status">
              预览：调整 {moved} 张桌；
              {after.tables.filter((t) => t.locked).length} 张锁定桌保留。
              {after.venue.areas.length > before.venue.areas.length
                ? "确认后新增中央过道。"
                : "区域保持。"}
            </p>
          </>
        )}
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        <footer>
          <button type="button" disabled={busy} onClick={onClose}>
            取消
          </button>
          <button
            className="primary"
            disabled={busy || !preview || !snapshot.tables.length}
          >
            确认整理布局
          </button>
        </footer>
      </form>
    </Modal>
  );
}
