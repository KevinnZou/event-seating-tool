import { useEffect, useState, type ReactNode } from "react";
import { db } from "../db/database";
export function StorageGate({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<"loading" | "ready" | "error">(
    "loading",
  );
  useEffect(() => {
    let active = true;
    async function open() {
      try {
        if (!globalThis.indexedDB) throw new Error("IndexedDB unavailable");
        await db.open();
        if (active) setStatus("ready");
      } catch {
        if (active) setStatus("error");
      }
    }
    void open();
    return () => {
      active = false;
    };
  }, []);
  if (status === "error")
    return (
      <main>
        <h1>无法加载本地数据</h1>
        <p role="alert" className="error">
          浏览器存储不可用、被禁用或空间不足。请检查权限后重新加载，请勿清理已有站点数据。
        </p>
        <button onClick={() => location.reload()}>重新加载</button>
      </main>
    );
  if (status === "loading") return <main role="status">正在检查本地存储…</main>;
  return children;
}
