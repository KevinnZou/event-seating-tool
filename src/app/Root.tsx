import { Suspense, lazy } from "react";
import { ErrorBoundary } from "./ErrorBoundary";
const App = lazy(() => import("./App"));
export function Root() {
  return (
    <ErrorBoundary>
      <Suspense fallback={<main role="status">正在读取本地数据…</main>}>
        <App />
      </Suspense>
    </ErrorBoundary>
  );
}
