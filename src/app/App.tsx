import { OfflineStatus } from "../offline/OfflineStatus";
import { Suspense, lazy } from "react";
import { HashRouter, Link, Route, Routes, useParams } from "react-router-dom";
import { StorageGate } from "./StorageGate";
const PlanDelivery = lazy(() =>
  import("../features/floorplan/PlanDelivery").then((m) => ({
    default: m.PlanDelivery,
  })),
);
const HelpPage = lazy(() =>
  import("../features/help/HelpPage").then((m) => ({ default: m.HelpPage })),
);
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
        <a
          className="skip-link"
          href="#main-content"
          onClick={(e) => {
            e.preventDefault();
            document.getElementById("main-content")?.focus();
          }}
        >
          跳到主要内容
        </a>
        <header className="topbar">
          <Link className="brand" to="/">
            智能排桌助手
          </Link>
          <nav aria-label="主要导航">
            <Link to="/">本地活动</Link>
            <Link to="/help">帮助与隐私</Link>
          </nav>
        </header>
        <main id="main-content" tabIndex={-1}>
          <OfflineStatus />
          <Suspense fallback={<p role="status">正在加载页面…</p>}>
            <Routes>
              <Route
                path="/events/:eventId/plan-export"
                element={<PlanDelivery />}
              />
              <Route path="/help" element={<HelpPage />} />
              <Route path="/events/:eventId" element={<WorkspaceRoute />} />
              <Route path="/events/:eventId/export" element={<ExportPage />} />
              <Route path="*" element={<Home />} />
            </Routes>
          </Suspense>
        </main>
        <footer className="site-footer">
          智能排桌助手 V0.2 · 圆桌活动 · 数据仅保存在当前浏览器
        </footer>
      </HashRouter>
    </StorageGate>
  );
}
