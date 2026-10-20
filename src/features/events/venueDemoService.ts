import { repository, type Repository } from "../../db/repository";
import { SeatingService } from "../../domain/services";
import { VenueService } from "../../domain/venueService";
// Deliberately invented labels and groups. No private source data is used.
export function createVenueDemo(repo: Repository = repository) {
  return repo.transaction(async () => {
    const crud = new SeatingService(repo),
      venue = new VenueService(repo);
    const id = await crud.createEvent({
      name: "虚构场地图演示",
      type: "banquet",
      defaultCapacity: 10,
    });
    const labels = [
      "01",
      "03",
      "05",
      "08",
      "10",
      "12",
      "16",
      "20",
      "22",
      "28",
      "36",
      "66",
    ];
    for (const label of labels)
      await crud.saveTable(id, { label, capacity: 10, locked: false });
    await venue.resize(id, 1200, 900);
    const tables = (await repo.snapshot(id)).tables;
    for (let i = 0; i < tables.length; i++) {
      const table = tables[i];
      await venue.position(id, "table", table.id, {
        x: 210 + (i % 4) * 250,
        y: 240 + Math.floor(i / 4) * 190,
      });
      for (const [index, size] of [4, 3, 3].entries()) {
        await crud.saveGuest(id, {
          displayName: `虚构${table.label}桌第${index + 1}组`,
          size,
          kind: "team",
          category: i < 6 ? "虚构A组" : "虚构B组",
          attendance: "confirmed",
          note: "全体人物均虚构",
        });
        const guest = (await repo.snapshot(id)).guests.at(-1)!;
        await crud.moveGuestGroup(id, guest.id, table.id);
      }
    }
    await venue.saveArea(id, {
      kind: "stage",
      label: "舞台",
      x: 400,
      y: 40,
      width: 400,
      height: 90,
    });
    await venue.saveArea(id, {
      kind: "entrance",
      label: "入口",
      x: 70,
      y: 790,
      width: 150,
      height: 60,
    });
    await venue.saveArea(id, {
      kind: "zone",
      label: "接待区",
      x: 840,
      y: 790,
      width: 220,
      height: 60,
    });
    for (let i = 0; i < 2; i++)
      await crud.saveGuest(id, {
        displayName: "虚构同名来宾",
        size: 1,
        kind: "person",
        attendance: i ? "tentative" : "confirmed",
      });
    await crud.saveGuest(id, {
      displayName: "虚构不参加组",
      size: 1,
      kind: "person",
      attendance: "declined",
    });
    return id;
  });
}
