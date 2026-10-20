import { repository, type Repository } from "../db/repository";
import { WorkspaceService } from "./workspaceService";
import { parseSnapshot } from "./snapshots";
export class CheckpointService {
  readonly repo: Repository;
  constructor(repo = repository) {
    this.repo = repo;
  }
  create(
    eventId: string,
    reason: "import" | "bulk-edit" | "manual" = "manual",
  ) {
    return this.repo.transaction(async () => {
      const snapshot = await this.repo.snapshot(eventId),
        id = crypto.randomUUID();
      await this.repo.database.checkpoints.add({
        id,
        eventId,
        createdAt: new Date().toISOString(),
        reason,
        snapshot,
      });
      return id;
    });
  }
  delete(eventId: string, id: string) {
    return this.repo.transaction(async () => {
      const cp = await this.repo.database.checkpoints.get(id);
      if (!cp || cp.eventId !== eventId)
        throw new Error("检查点不属于当前活动");
      await this.repo.database.checkpoints.delete(id);
    });
  }
  restore(eventId: string, id: string) {
    return this.repo.transaction(async () => {
      const checkpoint = await this.repo.database.checkpoints.get(id);
      if (!checkpoint || checkpoint.eventId !== eventId)
        throw new Error("检查点不属于当前活动");
      const target = parseSnapshot(checkpoint.snapshot);
      if (target.event.id !== eventId) throw new Error("检查点关联无效");
      await this.create(eventId, "bulk-edit");
      await new WorkspaceService(this.repo).replace(target);
    });
  }
}
export const checkpointService = new CheckpointService();
