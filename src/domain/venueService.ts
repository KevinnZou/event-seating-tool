import { fingerprint } from "./snapshots";
import { repository, type Repository } from "../db/repository";
import { WorkspaceService } from "./workspaceService";
import { materializeLayout } from "./geometry";
import {
  planLayout,
  defaultLayoutOptions,
  intersectsArea,
  AREA_CLEARANCE,
  type LayoutOptions,
} from "./layoutPlanner";
import {
  areaSchema,
  pointSchema,
  venueSchema,
  type Point,
  type VenueArea,
} from "./venueModels";
export class VenueService {
  readonly repo: Repository;
  constructor(repo: Repository = repository) {
    this.repo = repo;
  }
  private mutate(
    eventId: string,
    change: (s: ReturnType<typeof materializeLayout>) => void,
  ) {
    return this.repo.transaction(async () => {
      const s = materializeLayout(await this.repo.snapshot(eventId));
      change(s);
      await new WorkspaceService(this.repo).replace(s);
    });
  }
  resize(eventId: string, width: number, height: number) {
    return this.mutate(eventId, (s) => {
      s.event.venue = venueSchema.parse({ ...s.event.venue, width, height });
    });
  }
  position(eventId: string, kind: "table" | "area", id: string, point: Point) {
    const safe = pointSchema.parse(point);
    return this.mutate(eventId, (s) => {
      if (kind === "table") {
        const table = s.tables.find((t) => t.id === id);
        if (!table) throw new Error("桌位不属于当前活动");
        if (table.locked) throw new Error("请先解锁桌位");
        if (
          s.event.venue!.areas.some(
            (a) =>
              a.kind === "aisle" && intersectsArea(safe, a, AREA_CLEARANCE),
          )
        )
          throw new Error("桌位不能放在过道或过道缓冲区，请移到过道外");
        table.position = safe;
      } else {
        const area = s.event.venue!.areas.find((a) => a.id === id);
        if (!area) throw new Error("区域不属于当前活动");
        Object.assign(area, safe);
        s.event.venue = venueSchema.parse(s.event.venue);
      }
    });
  }
  saveArea(eventId: string, input: Omit<VenueArea, "id">, id?: string) {
    return this.mutate(eventId, (s) => {
      const areas = s.event.venue!.areas;
      const index = id ? areas.findIndex((a) => a.id === id) : -1;
      if (id && index < 0) throw new Error("区域不属于当前活动");
      const area = areaSchema.parse({
        ...input,
        id: id ?? crypto.randomUUID(),
      });
      if (index < 0) areas.push(area);
      else areas[index] = area;
      s.event.venue = venueSchema.parse(s.event.venue);
    });
  }
  deleteArea(eventId: string, id: string) {
    return this.mutate(eventId, (s) => {
      if (!s.event.venue!.areas.some((a) => a.id === id))
        throw new Error("区域不属于当前活动");
      s.event.venue!.areas = s.event.venue!.areas.filter((a) => a.id !== id);
    });
  }
  arrange(
    eventId: string,
    options: LayoutOptions = { ...defaultLayoutOptions, centralAisle: false },
    expected?: string,
  ) {
    return this.repo.transaction(async () => {
      const before = await this.repo.snapshot(eventId);
      if (expected && fingerprint(before) !== expected)
        throw new Error("预览后数据已变化，请重新打开整理预览");
      const next = planLayout(
        materializeLayout(before),
        options,
        crypto.randomUUID(),
      );
      await new WorkspaceService(this.repo).replace(next);
    });
  }
}
export const venueService = new VenueService();
