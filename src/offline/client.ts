type OfflineState = {
  status: "disabled" | "preparing" | "ready" | "error" | "unsupported";
  waiting: boolean;
  online: boolean;
};
let state: OfflineState = { status: "disabled", waiting: false, online: true };
const listeners = new Set<() => void>();
let registration: ServiceWorkerRegistration | undefined;
let started = false;
let requestedUpdate = false;
function update(partial: Partial<OfflineState>) {
  state = { ...state, ...partial };
  listeners.forEach((listener) => listener());
}
export const offlineStore = {
  getSnapshot: () => state,
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
};
export async function initializeOffline() {
  if (!import.meta.env.PROD || started) return;
  started = true;
  update({ status: "preparing", online: navigator.onLine });
  if (!("serviceWorker" in navigator) || !window.isSecureContext) {
    update({ status: "unsupported" });
    return;
  }
  window.addEventListener("online", () => update({ online: true }));
  window.addEventListener("offline", () => update({ online: false }));
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (requestedUpdate) window.location.reload();
  });
  try {
    registration = await navigator.serviceWorker.register(
      new URL("sw.js", document.baseURI),
      { updateViaCache: "none" },
    );
    const watch = () => {
      const worker = registration?.installing;
      worker?.addEventListener("statechange", () => {
        if (worker.state === "installed")
          update({ waiting: Boolean(registration?.waiting) });
        if (worker.state === "redundant" && state.status !== "ready")
          update({ status: "error" });
      });
    };
    registration.addEventListener("updatefound", watch);
    watch();
    if (registration.waiting) update({ waiting: true });
    await navigator.serviceWorker.ready;
    update({ status: "ready", waiting: Boolean(registration.waiting) });
  } catch {
    update({ status: "error" });
  }
}
export function activateOfflineUpdate() {
  if (!registration?.waiting) return;
  requestedUpdate = true;
  registration.waiting.postMessage({ type: "ACTIVATE_UPDATE" });
}
