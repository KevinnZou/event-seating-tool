import { useEffect, useState, type ReactNode } from "react";
import { db } from "../db/database";
import { OfflineStatus } from "../offline/OfflineStatus";
import { LoadingStatus } from "./LoadingStatus";
type Status = "loading" | "ready" | "blocked" | "outdated" | "error";
export function StorageGate({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<Status>("loading");
  useEffect(() => {
    let active = true;
    let obsolete = false;
    const blocked = () => {
      if (active) setStatus("blocked");
    };
    const outdated = () => {
      obsolete = true;
      db.close();
      if (active) setStatus("outdated");
    };
    db.on("blocked", blocked);
    db.on("versionchange", outdated);
    async function open() {
      try {
        if (!globalThis.indexedDB) throw new Error("IndexedDB unavailable");
        await db.open();
        if (active && !obsolete) setStatus("ready");
      } catch (error) {
        if (active)
          setStatus(
            obsolete || (error as { name?: string }).name === "VersionError"
              ? "outdated"
              : "error",
          );
      }
    }
    void open();
    return () => {
      active = false;
      db.on.blocked.unsubscribe(blocked);
      db.on.versionchange.unsubscribe(outdated);
    };
  }, []);
  if (status === "ready") return children;
  if (status === "loading") return <LoadingStatus text="正在检查本地存储…" />;
  return (
    <main>
      <OfflineStatus />
      <h1>
        {status === "blocked"
          ? "正在等待其他标签页释放数据"
          : status === "outdated"
            ? "此标签页的应用版本需要更新"
            : "无法加载本地数据"}
      </h1>
      <p role="alert" className="error">
        {status === "blocked"
          ? "其他标签页仍占用旧版数据库。请先保存未提交内容，再关闭其他本工具标签页；释放后此页会自动继续。不要清理站点数据。"
          : status === "outdated"
            ? "另一个标签页已升级本地数据。为保护活动，此旧版页面已停止读写。请更新应用后重新打开。"
            : "浏览器存储不可用、被禁用或空间不足。请检查权限后重新加载，请勿清理已有站点数据。"}
      </p>
      <div className="actions">
        <button onClick={() => location.reload()}>重新加载</button>
        <a
          className="button"
          href={new URL(`recover.html${location.hash}`, document.baseURI).href}
        >
          修复页面加载
        </a>
      </div>
    </main>
  );
}
