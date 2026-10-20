import { useSyncExternalStore } from "react";
import { activateOfflineUpdate, offlineStore } from "./client";
export function OfflineStatus() {
  const state = useSyncExternalStore(
    offlineStore.subscribe,
    offlineStore.getSnapshot,
  );
  if (state.status === "disabled") return null;
  return (
    <aside className="offline-status" aria-label="离线可用状态">
      <p role="status">
        {state.status === "ready"
          ? state.online
            ? "离线资源已就绪 · 断网后可重新打开并继续排桌"
            : "当前离线 · 本机保存、导入和导出仍可使用"
          : state.status === "preparing"
            ? "正在准备离线资源，请暂时保持联网…"
            : state.status === "unsupported"
              ? "当前环境不支持离线资源缓存，请联网打开；名单仍只保存在本机。"
              : "离线资源准备失败，请保持联网后重试；不影响已保存的本机名单。"}
      </p>
      {state.waiting && (
        <button
          onClick={() => {
            if (
              window.confirm(
                "新版本已就绪。请先下载JSON备份；刷新会结束本次撤销历史，已保存的名单不会删除。现在刷新？",
              )
            )
              activateOfflineUpdate();
          }}
        >
          新版本就绪，备份后刷新
        </button>
      )}
      <small>离线缓存仅含应用静态资源，不能代替名单的JSON备份。</small>
    </aside>
  );
}
