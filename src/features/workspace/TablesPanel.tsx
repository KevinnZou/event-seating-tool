import { workspaceService } from "../../domain/workspaceService";
import { occupancy } from "../../domain/calculations";
import { seatingService } from "../../domain/services";
import type { Snapshot, TableEntity } from "../../domain/models";
export function TablesPanel({
  snapshot,
  onEdit,
  onAdd,
  onDetails,
  run,
  busy,
}: {
  snapshot: Snapshot;
  onEdit: (table: TableEntity) => void;
  onAdd: () => void;
  onDetails: (table: TableEntity) => void;
  run: (action: () => Promise<unknown>) => Promise<void>;
  busy: boolean;
}) {
  return (
    <section className="panel table-management">
      <div className="section-heading">
        <h2>桌位（{snapshot.tables.length}）</h2>
        <button onClick={onAdd}>新增桌位</button>
      </div>
      {snapshot.tables.length === 0 ? (
        <p className="muted">暂无桌位。添加桌号和容量后即可安排宾客。</p>
      ) : (
        <div
          className="scroll table-management-scroll"
          tabIndex={0}
          aria-label="桌位列表，可滚动查看"
        >
          <table>
            <thead>
              <tr>
                <th>桌号</th>
                <th>占用 / 容量</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {snapshot.tables.map((t) => (
                <tr key={t.id} id={`table-${t.id}`} tabIndex={-1}>
                  <td>
                    <button
                      className="link-button table-label"
                      aria-label={`查看 ${t.label} 桌详情`}
                      onClick={() => onDetails(t)}
                    >
                      {t.label}
                    </button>
                    {t.locked && <p className="muted">已锁定</p>}
                  </td>
                  <td>
                    {occupancy(snapshot, t.id)} / {t.capacity}
                    <p className="muted note">{t.note}</p>
                  </td>
                  <td>
                    <div className="actions">
                      <button
                        className="link-button"
                        aria-label={`${t.label}桌上移`}
                        disabled={
                          busy || t.locked || snapshot.tables[0].id === t.id
                        }
                        onClick={() =>
                          void run(() =>
                            workspaceService.reorder(
                              snapshot.event.id,
                              t.id,
                              -1,
                            ),
                          )
                        }
                      >
                        上移
                      </button>
                      <button
                        className="link-button"
                        aria-label={`${t.label}桌下移`}
                        disabled={
                          busy ||
                          t.locked ||
                          snapshot.tables.at(-1)?.id === t.id
                        }
                        onClick={() =>
                          void run(() =>
                            workspaceService.reorder(
                              snapshot.event.id,
                              t.id,
                              1,
                            ),
                          )
                        }
                      >
                        下移
                      </button>
                      <button
                        className="link-button"
                        disabled={t.locked || busy}
                        onClick={() => onEdit(t)}
                      >
                        编辑
                      </button>
                      <button
                        className="link-button"
                        disabled={busy}
                        onClick={() =>
                          void run(() =>
                            seatingService.saveTable(
                              snapshot.event.id,
                              { ...t, locked: !t.locked },
                              t.id,
                            ),
                          )
                        }
                      >
                        {t.locked ? "解锁" : "锁定"}
                      </button>
                      <button
                        className="link-button danger"
                        disabled={t.locked || busy}
                        onClick={() => {
                          if (
                            window.confirm(
                              `删除 ${t.label} 桌？该桌所有宾客组将完整迁回未安排区，人数不变。`,
                            )
                          )
                            void run(() =>
                              seatingService.deleteTable(
                                snapshot.event.id,
                                t.id,
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
      {snapshot.tables.length > 6 && (
        <p className="muted table-scroll-hint">
          全部 {snapshot.tables.length} 张桌位均已列出，可在列表内滚动查看。
        </p>
      )}
    </section>
  );
}
