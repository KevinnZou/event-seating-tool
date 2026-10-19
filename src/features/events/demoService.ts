import { seatingService } from "../../domain/services";
import { demoGuests } from "../../tests/fixtures/demo";
export async function createDemo() {
  return seatingService.repo.transaction(async () => {
    const id = await seatingService.createEvent({
      name: "虚构演示婚宴",
      type: "wedding",
      date: "2026-11-08",
      defaultCapacity: 10,
    });
    for (const [label, capacity] of [
      ["01", 15],
      ["03", 10],
      ["66", 10],
    ] as const)
      await seatingService.saveTable(id, { label, capacity, locked: false });
    for (const guest of demoGuests) await seatingService.saveGuest(id, guest);
    return id;
  });
}
