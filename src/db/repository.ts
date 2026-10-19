import { db, type SeatingDB } from "./database";
import type { Snapshot } from "../domain/models";
export class Repository {
  readonly database: SeatingDB;
  constructor(database: SeatingDB = db) {
    this.database = database;
  }
  async snapshot(eventId: string): Promise<Snapshot> {
    const event = await this.database.events.get(eventId);
    if (!event) throw new Error("本机无此活动");
    return {
      event,
      guests: await this.database.guests
        .where("eventId")
        .equals(eventId)
        .sortBy("orderIndex"),
      tables: await this.database.seatingTables
        .where("eventId")
        .equals(eventId)
        .sortBy("orderIndex"),
    };
  }
  transaction<T>(action: () => Promise<T>) {
    const d = this.database;
    return d.transaction(
      "rw",
      [d.events, d.guests, d.seatingTables, d.checkpoints],
      action,
    );
  }
}
export const repository = new Repository();
