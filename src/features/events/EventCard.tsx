import { Link } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";
import { repository } from "../../db/repository";
import { calculateEventStats } from "../../domain/calculations";
import { eventTypes, type EventEntity } from "../../domain/models";
export function EventCard({
  event,
  onEdit,
  onCopy,
  onDelete,
}: {
  event: EventEntity;
  onEdit: () => void;
  onCopy: () => void;
  onDelete: () => void;
}) {
  const s = useLiveQuery(
    () => repository.snapshot(event.id),
    [event.id, event.updatedAt],
  );
  const stats = s ? calculateEventStats(s) : null;
  return (
    <article className="event-row">
      <div>
        <h2>{event.name}</h2>
        <div className="event-meta">
          <span>{eventTypes[event.type]}</span>
          <span>{event.date ?? "日期未设置"}</span>
          <span>{stats?.plannedCount ?? "…"} 位计划出席</span>
          <span>{stats?.tableCount ?? "…"} 张桌位</span>
        </div>
        <div className="actions">
          <button className="link-button" onClick={onEdit}>
            编辑活动
          </button>
          <button className="link-button" onClick={onCopy}>
            复制
          </button>
          <button className="link-button danger" onClick={onDelete}>
            删除
          </button>
          <span className="muted">
            修改于 {new Date(event.updatedAt).toLocaleString("zh-CN")}
          </span>
        </div>
      </div>
      <Link className="button primary" to={`/events/${event.id}`}>
        进入活动
      </Link>
    </article>
  );
}
