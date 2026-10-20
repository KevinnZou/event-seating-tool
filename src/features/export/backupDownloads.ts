import { download } from "../../lib/download";
import { backupService } from "./backupService";
export async function downloadBackup(
  eventId?: string,
  includeCheckpoints = true,
) {
  const b = await backupService.export(eventId, includeCheckpoints);
  const content = JSON.stringify(b, null, 2);
  if (new Blob([content]).size > 10 * 1024 * 1024)
    throw new Error(
      "完整备份超过10MB，请按活动备份，或取消包含历史检查点仅备份当前数据",
    );
  download(
    content,
    `${eventId ? b.events[0].name : "全部活动"}_${new Date().toISOString().slice(0, 10)}_${includeCheckpoints ? "完整备份" : "当前数据备份"}.json`,
    "application/json",
  );
  await backupService.markDownloaded(b);
}
