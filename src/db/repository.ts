import { db, type SeatingDB } from "./database";
import type { Snapshot } from "../domain/models";
export class Repository {
  readonly database: SeatingDB;
  constructor(database: SeatingDB = db) {
    this.database = database;
  }
  async snapshot(eventId: string): Promise<Snapshot> {
    const d = this.database;
    return d.transaction(
      "r",
      [d.events, d.guests, d.seatingTables],
      async () => {
        const event = await d.events.get(eventId);
        if (!event) throw new Error("本机无此活动");
        return {
          event,
          guests: await d.guests
            .where("eventId")
            .equals(eventId)
            .sortBy("orderIndex"),
          tables: await d.seatingTables
            .where("eventId")
            .equals(eventId)
            .sortBy("orderIndex"),
        };
      },
    );
  }

  transaction<T>(action: () => Promise<T>) {
    const d = this.database;
    return d.transaction(
      "rw",
      [d.events, d.guests, d.seatingTables, d.checkpoints, d.localMeta],
      action,
    );
  }
}
export const repository = new Repository();
