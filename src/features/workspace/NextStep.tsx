import { Link } from "react-router-dom";
import type { Snapshot } from "../../domain/models";
import { calculateEventStats } from "../../domain/calculations";
export function NextStep({
  snapshot,
  view,
  busy,
  onImport,
  onAddGuest,
  onAddTable,
  onArrange,
  onSuggest,
}: {
  snapshot: Snapshot;
  view: string;
  busy: boolean;
  onImport: () => void;
  onAddGuest: () => void;
  onAddTable: () => void;
  onArrange: () => void;
  onSuggest: () => void;
}) {
  const stats = calculateEventStats(snapshot);
  const empty = !snapshot.guests.length;
  const step =
    empty || !stats.plannedCount
      ? 0
      : !snapshot.tables.length || stats.unassignedCount > 0
        ? 1
        : 2;
  const lacksCapacity = stats.plannedCount > stats.capacity;
  const title = empty
    ? "先把宾客名单加进来"
    : !stats.plannedCount
      ? "当前没有计划出席的宾客"
      : !snapshot.tables.length
        ? "名单已录入，接下来添加圆桌"
        : lacksCapacity
          ? "圆桌容量还不够"
          : stats.unassignedCount > 0
            ? `还有 ${stats.unassignedCount} 人待安排`
            : "宾客已安排，核对后即可导出";
  const help = empty
    ? "可以粘贴或导入名单，也可以逐组添加。场地图稍后再调整。"
    : !stats.plannedCount
      ? "已有记录均为不参加，名单仍保留。可编辑出席状态或继续添加宾客。"
      : !snapshot.tables.length
        ? "先设置桌号和容量，再将宾客整组安排到桌。"
        : lacksCapacity
          ? `计划出席 ${stats.plannedCount} 人，总容量 ${stats.capacity} 席。请先新增圆桌或调整桌位容量。`
          : stats.unassignedCount > 0
            ? "可先生成一份排桌建议，预览后再应用；也能用菜单或拖动逐组安排。"
            : "请核对待定宾客、同名提醒和桌位，再导出名单或场地图。";
  return (
    <section className="next-step" aria-label="排桌流程与下一步">
      <ol className="workflow-steps" aria-label="排桌流程">
        {["录入名单", "安排桌位", "导出结果"].map((label, i) => (
          <li
            key={label}
            aria-current={step === i ? "step" : undefined}
            className={i < step ? "step-done" : ""}
          >
            <span>{i + 1}</span>
            {label}
          </li>
        ))}
      </ol>
      <div className="next-step-body">
        <div>
          <h2>{title}</h2>
          <p>{help}</p>
        </div>
        <div className="actions">
          {empty ? (
            <>
              <button className="primary" disabled={busy} onClick={onImport}>
                导入第一份名单
              </button>
              <button disabled={busy} onClick={onAddGuest}>
                逐组添加
              </button>
            </>
          ) : !stats.plannedCount ? (
            <button className="primary" disabled={busy} onClick={onAddGuest}>
              继续添加宾客
            </button>
          ) : !snapshot.tables.length ? (
            <button className="primary" disabled={busy} onClick={onAddTable}>
              添加第一张圆桌
            </button>
          ) : lacksCapacity ? (
            <button className="primary" disabled={busy} onClick={onAddTable}>
              增加一张圆桌
            </button>
          ) : stats.unassignedCount > 0 ? (
            <>
              <button className="primary" disabled={busy} onClick={onSuggest}>
                先生成排桌方案
              </button>
              {view !== "board" && (
                <button disabled={busy} onClick={onArrange}>
                  手动安排桌位
                </button>
              )}
            </>
          ) : (
            <Link
              className="button primary"
              to={`/events/${snapshot.event.id}/export`}
            >
              查看并导出名单
            </Link>
          )}
        </div>
      </div>
    </section>
  );
}
