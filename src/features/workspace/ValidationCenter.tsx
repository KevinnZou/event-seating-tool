import { useState } from "react";
import type { Snapshot } from "../../domain/models";
import { validateEvent } from "../../domain/calculations";
export function ValidationCenter({
  snapshot,
  onLocate,
}: {
  snapshot: Snapshot;
  onLocate: (id: string) => void;
}) {
  const [limit, setLimit] = useState(30),
    [onlyErrors, setOnlyErrors] = useState(false);
  const issues = validateEvent(snapshot),
    items = issues.filter((i) => !onlyErrors || i.severity === "error");
  return (
    <details
      className="panel issues"
      open={issues.some((i) => i.severity === "error")}
    >
      <summary className="review-summary">
        <h2>校验中心</h2>
        <span>
          错误 {issues.filter((i) => i.severity === "error").length} 项 · 提醒{" "}
          {issues.filter((i) => i.severity === "warning").length} 项
        </span>
      </summary>
      <div className="section-heading">
        <label className="check">
          <input
            type="checkbox"
            checked={onlyErrors}
            onChange={(e) => setOnlyErrors(e.target.checked)}
          />
          仅看错误
        </label>
      </div>
      <p className="muted">
        错误 {issues.filter((i) => i.severity === "error").length} 项 · 提醒{" "}
        {issues.filter((i) => i.severity === "warning").length}{" "}
        项。同名只提醒、不自动合并。
      </p>
      {items.length ? (
        <>
          <ul>
            {items.slice(0, limit).map((issue, i) => (
              <li key={`${issue.code}-${i}`}>
                {issue.severity === "error" ? "错误" : "提醒"}：{issue.message}{" "}
                {issue.entityId && (
                  <button
                    className="link-button"
                    onClick={() => onLocate(issue.entityId!)}
                  >
                    定位处理
                  </button>
                )}
              </li>
            ))}
          </ul>
          {items.length > limit && (
            <button onClick={() => setLimit(limit + 50)}>再显示50项</button>
          )}
        </>
      ) : (
        <p>暂无{onlyErrors ? "错误" : "数据问题"}</p>
      )}
    </details>
  );
}
