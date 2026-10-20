import { download } from "../../lib/download";
import { backupService } from "./backupService";
export async function downloadBackup(eventId?: string) {
  const b = await backupService.export(eventId);
  const content = JSON.stringify(b, null, 2);
  if (new Blob([content]).size > 10 * 1024 * 1024)
    throw new Error("完整备份超过10MB，请按活动分别备份");
  download(
    content,
    `${eventId ? b.events[0].name : "全部活动"}_${new Date().toISOString().slice(0, 10)}_完整备份.json`,
    "application/json",
  );
  await backupService.markDownloaded(b);
}
