import { useMemo, useState } from "react";
import type { Filters } from "../seating/selectors";
import { filterGuests } from "../seating/selectors";
import {
  attendanceLabels,
  type GuestGroupEntity,
  type Snapshot,
} from "../../domain/models";
import { seatingService } from "../../domain/services";
export function GuestsPanel({
  snapshot,
  onAdd,
  onImport,
  onEdit,
  run,
  busy,
  filters,
  selected,
  onSelect,
  onSplit,
}: {
  snapshot: Snapshot;
  onAdd: () => void;
  onImport: () => void;
  onEdit: (g: GuestGroupEntity) => void;
  run: (action: () => Promise<unknown>) => Promise<void>;
  busy: boolean;
  filters: Filters;
  selected: string[];
  onSelect: (ids: string[]) => void;
  onSplit: (g: GuestGroupEntity) => void;
}) {
  const guests = useMemo(
    () => filterGuests(snapshot, filters),
    [snapshot, filters],
  );
  const key = JSON.stringify(filters);
  const [pagination, setPagination] = useState({ key: "", page: 0 });
  const totalPages = Math.max(1, Math.ceil(guests.length / 50));
  const page =
    pagination.key === key ? Math.min(pagination.page, totalPages - 1) : 0;
  return (
    <section className="panel guest-management">
      <div className="section-heading">
        <h2>宾客组（{snapshot.guests.length}）</h2>
        <button className="primary" onClick={onAdd}>
          新增宾客组
        </button>
      </div>
      {filters.guestId && (
        <p className="notice">
          已精确定位一组宾客，使用“清除筛选”返回全部名单。
        </p>
      )}
      {snapshot.guests.length > 0 && guests.length === 0 && (
        <p className="notice">没有符合筛选的宾客，请调整或清除筛选。</p>
      )}
      {snapshot.guests.length === 0 ? (
        <div className="guest-empty-state">
          <div>
            <h3>
              {snapshot.tables.length
                ? "桌位已就绪，接下来添加名单"
                : "从宾客名单开始"}
            </h3>
            <p className="muted">
              已有名单可直接导入，也可以逐组添加一人、家庭或团队。家庭组按实际人数占席。
            </p>
          </div>
          <button disabled={busy} onClick={onImport}>
            导入已有名单
          </button>
        </div>
      ) : (
        <div className="scroll">
          <table className="guest-table">
            <thead>
              <tr>
                <th>
                  <label className="check">
                    <input
                      type="checkbox"
                      aria-label="选择筛选结果"
                      checked={
                        guests.length > 0 &&
                        guests.every((g) => selected.includes(g.id))
                      }
                      onChange={(e) =>
                        onSelect(
                          e.target.checked ? guests.map((g) => g.id) : [],
                        )
                      }
                    />
                    名称 / 分组
                  </label>
                </th>
                <th>人数</th>
                <th>桌位安排</th>
                <th>状态 / 操作</th>
              </tr>
            </thead>
            <tbody>
              {guests.slice(page * 50, (page + 1) * 50).map((g) => (
                <tr key={g.id} id={`guest-${g.id}`} tabIndex={-1}>
                  <td className="guest-name">
                    <label className="check">
                      <input
                        type="checkbox"
                        aria-label={`选择 ${g.displayName}`}
                        checked={selected.includes(g.id)}
                        onChange={(e) =>
                          onSelect(
                            e.target.checked
                              ? [...selected, g.id]
                              : selected.filter((id) => id !== g.id),
                          )
                        }
                      />
                      <strong>{g.displayName}</strong>
                    </label>
                    <p className="muted">{g.category || "未分组"}</p>
                    {g.note && <p className="muted note">{g.note}</p>}
                  </td>
                  <td className="guest-size" aria-label={`${g.size} 人`}>
                    {g.size}
                  </td>
                  <td>
                    <select
                      aria-label={`安排 ${g.displayName} 的桌位`}
                      value={g.tableId ?? ""}
                      disabled={
                        busy ||
                        g.attendance === "declined" ||
                        snapshot.tables.some(
                          (t) => t.id === g.tableId && t.locked,
                        )
                      }
                      onChange={(e) => {
                        const target = e.target.value || null;
                        void run(() =>
                          seatingService.moveGuestGroup(
                            snapshot.event.id,
                            g.id,
                            target,
                          ),
                        );
                      }}
                    >
                      <option value="">未安排</option>
                      {snapshot.tables.map((t) => (
                        <option key={t.id} value={t.id} disabled={t.locked}>
                          {t.label} 桌{t.locked ? "（锁定）" : ""}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <p className="muted">{attendanceLabels[g.attendance]}</p>
                    <div className="actions">
                      <button
                        className="link-button"
                        disabled={
                          busy ||
                          g.size < 2 ||
                          snapshot.tables.some(
                            (t) => t.id === g.tableId && t.locked,
                          )
                        }
                        onClick={() => onSplit(g)}
                      >
                        拆分
                      </button>
                      <button
                        className="link-button"
                        disabled={busy}
                        onClick={() => onEdit(g)}
                      >
                        编辑
                      </button>
                      <button
                        className="link-button danger"
                        disabled={busy}
                        onClick={() => {
                          if (
                            window.confirm(
                              `删除“${g.displayName}”（${g.size} 人）？录入总人数将减少 ${g.size} 人。`,
                            )
                          )
                            void run(() =>
                              seatingService.deleteGuest(
                                snapshot.event.id,
                                g.id,
                              ),
                            );
                        }}
                      >
                        删除
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {guests.length > 50 && (
        <div className="pagination">
          <button
            disabled={page === 0}
            onClick={() => setPagination({ key, page: page - 1 })}
          >
            上一页
          </button>
          <span>
            筛选结果 {guests.length} 组 · 第 {page + 1} / {totalPages}{" "}
            页（每页50组）
          </span>
          <button
            disabled={page + 1 >= totalPages}
            onClick={() => setPagination({ key, page: page + 1 })}
          >
            下一页
          </button>
        </div>
      )}
    </section>
  );
}
