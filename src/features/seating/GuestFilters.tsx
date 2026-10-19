import type { Snapshot } from "../../domain/models";
import { attendanceLabels } from "../../domain/models";
import type { Filters } from "./selectors";
export function GuestFilters({
  snapshot,
  value,
  onChange,
}: {
  snapshot: Snapshot;
  value: Filters;
  onChange: (f: Filters) => void;
}) {
  const set = (key: keyof Filters, v: string) =>
    onChange({ ...value, [key]: v });
  return (
    <div className="filterbar">
      <label>
        搜索宾客
        <input
          placeholder="姓名、拼音或分组"
          value={value.query}
          onChange={(e) => set("query", e.target.value)}
        />
      </label>
      <label>
        出席筛选
        <select
          value={value.attendance}
          onChange={(e) => set("attendance", e.target.value)}
        >
          <option value="">全部状态</option>
          {Object.entries(attendanceLabels).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
      </label>
      <label>
        分组筛选
        <select
          value={value.category}
          onChange={(e) => set("category", e.target.value)}
        >
          <option value="">全部分组</option>
          {[
            ...new Set(snapshot.guests.map((g) => g.category).filter(Boolean)),
          ].map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
      </label>
      <label>
        桌位筛选
        <select
          value={value.table}
          onChange={(e) => set("table", e.target.value)}
        >
          <option value="">全部桌位</option>
          <option value="unassigned">未安排</option>
          {snapshot.tables.map((t) => (
            <option key={t.id} value={t.id}>
              {t.label} 桌
            </option>
          ))}
        </select>
      </label>
      <label>
        名单排序
        <select
          value={value.sort}
          onChange={(e) => set("sort", e.target.value)}
        >
          <option value="order">录入顺序</option>
          <option value="name">姓名拼音</option>
          <option value="category">分组</option>
          <option value="table">桌号自然排序</option>
        </select>
      </label>
    </div>
  );
}
