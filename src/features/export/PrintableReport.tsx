import type { Snapshot } from "../../domain/models";
import { attendanceLabels } from "../../domain/models";
import { occupancy, calculateEventStats } from "../../domain/calculations";
export function PrintableReport({
  snapshot: s,
  parity,
  cards,
}: {
  snapshot: Snapshot;
  parity: boolean;
  cards: boolean;
}) {
  const stats = calculateEventStats(s);
  const sections = parity
    ? [
        {
          name: "奇数桌",
          tables: s.tables.filter(
            (t) => /^\d+$/.test(t.label) && Number(t.label) % 2 === 1,
          ),
        },
        {
          name: "偶数桌",
          tables: s.tables.filter(
            (t) => /^\d+$/.test(t.label) && Number(t.label) % 2 === 0,
          ),
        },
        {
          name: "自定义桌",
          tables: s.tables.filter((t) => !/^\d+$/.test(t.label)),
        },
      ]
    : [{ name: "桌位安排", tables: s.tables }];
  const unassigned = s.guests.filter(
      (g) => !g.tableId && g.attendance !== "declined",
    ),
    declined = s.guests.filter((g) => g.attendance === "declined");
  return (
    <div className={`print-report ${cards ? "print-cards" : ""}`}>
      <header>
        <h1>{s.event.name}</h1>
        <p>
          {s.event.date ?? "日期未设置"} · 录入 {stats.totalRecordedCount} 人 ·
          计划 {stats.plannedCount} 人 · 已排 {stats.assignedCount} 人 · 未排{" "}
          {stats.unassignedCount} 人 · 余席 {stats.freeSeats}
        </p>
        <p>
          待定 {stats.tentativeCount} 人；不参加 {stats.declinedCount}{" "}
          人（不占席）。以本次导出时间的本地名单为准。
        </p>
      </header>
      {sections.map((section) => (
        <section key={section.name}>
          <h2>{section.name}</h2>
          <div
            className={
              cards ? "print-card-grid" : parity ? "print-parity-list" : ""
            }
          >
            {section.tables.map((t) => (
              <table className="print-table" key={t.id}>
                <thead>
                  <tr>
                    <th colSpan={4}>
                      <h3>
                        {t.label} 号桌 · {occupancy(s, t.id)} / {t.capacity} 席
                        {t.locked ? " · 已锁定" : ""}
                      </h3>
                      {t.note && <p>{t.note}</p>}
                    </th>
                  </tr>
                  <tr>
                    <th>名称 / 分组</th>
                    <th>人数</th>
                    <th>状态</th>
                    <th>备注</th>
                  </tr>
                </thead>
                <tbody>
                  {s.guests.filter((g) => g.tableId === t.id).length ? (
                    s.guests
                      .filter((g) => g.tableId === t.id)
                      .map((g) => (
                        <tr key={g.id}>
                          <td>
                            {g.displayName}
                            {g.category && (
                              <p className="muted">{g.category}</p>
                            )}
                          </td>
                          <td>{g.size}</td>
                          <td>{attendanceLabels[g.attendance]}</td>
                          <td>{g.note}</td>
                        </tr>
                      ))
                  ) : (
                    <tr>
                      <td colSpan={4}>暂无宾客</td>
                    </tr>
                  )}
                </tbody>
              </table>
            ))}
          </div>
        </section>
      ))}
      {[
        { name: "未安排（计划出席）", groups: unassigned },
        { name: "不参加（保留记录）", groups: declined },
      ].map((section) => (
        <section key={section.name}>
          <table className="print-table">
            <thead>
              <tr>
                <th colSpan={4}>
                  <h2>
                    {section.name} ·{" "}
                    {section.groups.reduce((n, g) => n + g.size, 0)} 人
                  </h2>
                </th>
              </tr>
              <tr>
                <th>名称 / 分组</th>
                <th>人数</th>
                <th>状态</th>
                <th>备注</th>
              </tr>
            </thead>
            <tbody>
              {section.groups.length ? (
                section.groups.map((g) => (
                  <tr key={g.id}>
                    <td>
                      {g.displayName}
                      {g.category && <p className="muted">{g.category}</p>}
                    </td>
                    <td>{g.size}</td>
                    <td>{attendanceLabels[g.attendance]}</td>
                    <td>{g.note}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={4}>无</td>
                </tr>
              )}
            </tbody>
          </table>
        </section>
      ))}
    </div>
  );
}
