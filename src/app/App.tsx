import { OfflineStatus } from "../offline/OfflineStatus";
import { Suspense, lazy } from "react";
import { HashRouter, Link, Route, Routes, useParams } from "react-router-dom";
import { StorageGate } from "./StorageGate";
const Home = lazy(() =>
  import("../features/events/Home").then((m) => ({ default: m.Home })),
);
const Workspace = lazy(() =>
  import("../features/workspace/Workspace").then((m) => ({
    default: m.Workspace,
  })),
);
const ExportPage = lazy(() =>
  import("../features/export/ExportPage").then((m) => ({
    default: m.ExportPage,
  })),
);
function WorkspaceRoute() {
  const { eventId } = useParams();
  return <Workspace key={eventId} />;
}
export default function App() {
  return (
    <StorageGate>
      <HashRouter>
        <header className="topbar">
          <Link className="brand" to="/">
            智能排桌助手
          </Link>
          <Link to="/">本地活动</Link>
        </header>
        <main>
          <OfflineStatus />
          <Suspense fallback={<p role="status">正在加载页面…</p>}>
            <Routes>
              <Route path="/events/:eventId" element={<WorkspaceRoute />} />
              <Route path="/events/:eventId/export" element={<ExportPage />} />
              <Route path="*" element={<Home />} />
            </Routes>
          </Suspense>
        </main>
        <footer className="site-footer">
          智能排桌助手 V0.1 · 圆桌活动 · 数据仅保存在当前浏览器
        </footer>
      </HashRouter>
    </StorageGate>
  );
}
