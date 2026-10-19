import type { Snapshot } from "../../domain/models";
import { demoGuests } from "./demo";
const time = "2026-10-19T00:00:00.000Z";
export function fixture(): Snapshot {
  const eventId = crypto.randomUUID();
  const tables = ["01", "03", "66"].map((label, i) => ({
    id: crypto.randomUUID(),
    eventId,
    label,
    capacity: i === 0 ? 15 : 10,
    orderIndex: i,
    locked: false,
    createdAt: time,
    updatedAt: time,
  }));
  return {
    event: {
      id: eventId,
      name: "虚构测试婚宴",
      type: "wedding",
      defaultCapacity: 10,
      overCapacityPolicy: "block",
      schemaVersion: 1,
      createdAt: time,
      updatedAt: time,
    },
    tables,
    guests: demoGuests.map((g, i) => ({
      ...g,
      id: crypto.randomUUID(),
      eventId,
      tableId: i === 0 ? tables[1].id : null,
      orderIndex: i,
      createdAt: time,
      updatedAt: time,
    })),
  };
}
