import { occupancy } from "../../domain/calculations";
import type { GuestGroupEntity, Snapshot } from "../../domain/models";

/** Presentation guidance only: the service rechecks current capacity in its transaction. */
export function tableChoices(snapshot: Snapshot, guest: GuestGroupEntity) {
  return snapshot.tables.map((table) => {
    const current = guest.tableId === table.id;
    const remaining = table.capacity - occupancy(snapshot, table.id);
    const reason = current
      ? "当前桌"
      : table.locked
        ? "已锁定"
        : guest.size > remaining
          ? `差 ${guest.size - remaining} 席`
          : "";
    return {
      id: table.id,
      disabled: !current && (table.locked || guest.size > remaining),
      label: `${table.label} 桌 · 余 ${remaining} 席${reason ? ` · ${reason}` : ""}`,
    };
  });
}
