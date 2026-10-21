import { useEffect, useRef } from "react";
export function WorkspaceActions({
  onSuggest,
  onVersions,
  onEdit,
  onAddTable,
}: {
  onSuggest: () => void;
  onVersions: () => void;
  onEdit: () => void;
  onAddTable?: () => void;
}) {
  const ref = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    const outside = (event: PointerEvent) => {
      if (
        event.target instanceof Node &&
        !ref.current?.contains(event.target) &&
        ref.current
      )
        ref.current.open = false;
    };
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, []);
  function choose(action: () => void) {
    if (ref.current) {
      ref.current.open = false;
      ref.current.querySelector("summary")?.focus();
    }
    action();
  }
  return (
    <details
      ref={ref}
      className="workspace-more"
      onKeyDown={(event) => {
        if (event.key === "Escape" && ref.current?.open) {
          event.preventDefault();
          ref.current.open = false;
          ref.current.querySelector("summary")?.focus();
        }
      }}
    >
      <summary>更多操作</summary>
      <div className="actions">
        {onAddTable && (
          <button onClick={() => choose(onAddTable)}>先设置桌位</button>
        )}
        <button onClick={() => choose(onSuggest)}>规则排桌建议</button>
        <button onClick={() => choose(onVersions)}>命名方案与差异</button>
        <button onClick={() => choose(onEdit)}>编辑活动</button>
      </div>
    </details>
  );
}
