import {
  attendanceLabels,
  type GuestGroupEntity,
  type Snapshot,
} from "../../domain/models";
import { seatingService } from "../../domain/services";
export function GuestsPanel({
  snapshot,
  onAdd,
  onEdit,
  run,
  busy,
}: {
  snapshot: Snapshot;
  onAdd: () => void;
  onEdit: (g: GuestGroupEntity) => void;
  run: (action: () => Promise<unknown>) => Promise<void>;
  busy: boolean;
}) {
  return (
    <section className="panel">
      <div className="section-heading">
        <h2>宾客组（{snapshot.guests.length}）</h2>
        <button className="primary" onClick={onAdd}>
          新增宾客组
        </button>
      </div>
      {snapshot.guests.length === 0 ? (
        <p className="muted">
          暂无宾客。添加一人、家庭或团队，按整组安排桌位。
        </p>
      ) : (
        <div className="scroll">
          <table className="guest-table">
            <thead>
              <tr>
                <th>名称 / 分组</th>
                <th>人数</th>
                <th>桌位安排</th>
                <th>状态 / 操作</th>
              </tr>
            </thead>
            <tbody>
              {snapshot.guests.map((g) => (
                <tr key={g.id}>
                  <td className="guest-name">
                    <strong>{g.displayName}</strong>
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
                      onChange={(e) =>
                        void run(() =>
                          seatingService.moveGuestGroup(
                            snapshot.event.id,
                            g.id,
                            e.target.value || null,
                          ),
                        )
                      }
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
    </section>
  );
}
