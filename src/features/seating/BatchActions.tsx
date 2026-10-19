import { useState } from "react";
import type { Snapshot } from "../../domain/models";
import { workspaceService } from "../../domain/workspaceService";
export function BatchActions({
  snapshot,
  selected,
  clear,
  run,
  busy,
}: {
  snapshot: Snapshot;
  selected: string[];
  clear: () => void;
  run: (a: () => Promise<unknown>) => Promise<void>;
  busy: boolean;
}) {
  const [target, setTarget] = useState("");
  return (
    <div className="batchbar">
      <span>
        已选 {selected.length} 组 /{" "}
        {snapshot.guests
          .filter((g) => selected.includes(g.id))
          .reduce((n, g) => n + g.size, 0)}{" "}
        人
      </span>
      <select
        aria-label="批量目标桌"
        value={target}
        onChange={(e) => setTarget(e.target.value)}
      >
        <option value="">未安排区</option>
        {snapshot.tables.map((t) => (
          <option key={t.id} value={t.id} disabled={t.locked}>
            {t.label} 桌{t.locked ? "（锁定）" : ""}
          </option>
        ))}
      </select>
      <button
        disabled={busy || !selected.length}
        onClick={() =>
          void run(() =>
            workspaceService.move(snapshot.event.id, selected, target || null),
          )
        }
      >
        移动所选
      </button>
      <select
        aria-label="批量出席状态"
        value=""
        disabled={busy || !selected.length}
        onChange={(e) => {
          const status = e.target.value;
          if (
            status &&
            window.confirm("修改所选组出席状态？不参加会解除桌位，保留记录。")
          )
            void run(() =>
              workspaceService.batchAttendance(
                snapshot.event.id,
                selected,
                status as "confirmed" | "tentative" | "declined",
              ),
            );
        }}
      >
        <option value="">标记状态…</option>
        <option value="confirmed">确认</option>
        <option value="tentative">待定</option>
        <option value="declined">不参加</option>
      </select>
      <button
        className="danger"
        disabled={busy || !selected.length}
        onClick={() => {
          if (
            window.confirm(
              `删除所选 ${selected.length} 组？总人数将减少，可在本页撤销。`,
            )
          )
            void run(async () => {
              await workspaceService.batchDelete(snapshot.event.id, selected);
              clear();
            });
        }}
      >
        删除所选
      </button>
      <button disabled={!selected.length} onClick={clear}>
        取消选择
      </button>
    </div>
  );
}
