import Dexie, { type EntityTable } from "dexie";
import type {
  EventEntity,
  GuestGroupEntity,
  TableEntity,
  LocalCheckpoint,
} from "../domain/models";
export class SeatingDB extends Dexie {
  localMeta!: EntityTable<{ key: string; value: string }, "key">;
  events!: EntityTable<EventEntity, "id">;
  guests!: EntityTable<GuestGroupEntity, "id">;
  seatingTables!: EntityTable<TableEntity, "id">;
  checkpoints!: EntityTable<LocalCheckpoint, "id">;
  constructor(name = "event-seating-tool-local-v1") {
    super(name);
    this.version(1).stores({
      events: "id, updatedAt",
      guests: "id, eventId, tableId, [eventId+tableId]",
      seatingTables: "id, eventId, [eventId+orderIndex]",
      checkpoints: "id, eventId, createdAt",
    });
    this.version(2).stores({
      events: "id, updatedAt",
      guests: "id, eventId, tableId, [eventId+tableId]",
      seatingTables: "id, eventId, [eventId+orderIndex]",
      checkpoints: "id, eventId, createdAt",
      localMeta: "key",
    });
    // V0.2 keeps existing stores/IDs and adds optional layout/version fields.
    // Version gating prevents an old V0.1 tab from stripping these fields on write.
    this.version(3).stores({
      events: "id, updatedAt",
      guests: "id, eventId, tableId, [eventId+tableId]",
      seatingTables: "id, eventId, [eventId+orderIndex]",
      checkpoints: "id, eventId, createdAt",
      localMeta: "key",
    });
  }
}
export const db = new SeatingDB();
