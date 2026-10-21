import { useEffect, useState } from "react";
import { OfflineStatus } from "../offline/OfflineStatus";
export function LoadingStatus({ text }: { text: string }) {
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    const timer = window.setTimeout(() => setSlow(true), 10000);
    return () => window.clearTimeout(timer);
  }, []);
  return (
    <main>
      <OfflineStatus />
      <p role="status">{text}</p>
      {slow && (
        <div className="notice">
          <h2>加载时间较长</h2>
          <p>
            请检查网络，并关闭其他正在使用本工具的旧版标签页。已有活动数据不会因刷新而删除。
          </p>
          <a
            className="button"
            href={
              new URL(`recover.html${location.hash}`, document.baseURI).href
            }
          >
            修复页面加载
          </a>
        </div>
      )}
    </main>
  );
}
