import { LoadingStatus } from "./LoadingStatus";
import { Suspense, lazy } from "react";
import { ErrorBoundary } from "./ErrorBoundary";
const App = lazy(() => import("./App"));
export function Root() {
  return (
    <ErrorBoundary>
      <Suspense fallback={<LoadingStatus text="正在读取本地数据…" />}>
        <App />
      </Suspense>
    </ErrorBoundary>
  );
}
