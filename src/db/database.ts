import Dexie, { type EntityTable } from "dexie";
import type {
  EventEntity,
  GuestGroupEntity,
  TableEntity,
  LocalCheckpoint,
} from "../domain/models";
export class SeatingDB extends Dexie {
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
  }
}
export const db = new SeatingDB();
