import { useEffect, useRef, useId, useState, type ReactNode } from "react";
export function Modal({
  title,
  children,
  onClose,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const [previous] = useState(() => document.activeElement);
  useEffect(() => {
    const dialog = ref.current;
    dialog?.showModal();
    // React autoFocus runs before a closed dialog becomes interactive.
    dialog
      ?.querySelector<HTMLElement>(
        "input:not([disabled]), textarea:not([disabled])",
      )
      ?.focus();
    return () => {
      dialog?.close();
      if (previous instanceof HTMLElement && previous.isConnected)
        previous.focus();
    };
  }, [previous]);
  return (
    <dialog
      ref={ref}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onKeyDown={(event) => {
        if (event.key !== "Tab") return;
        const controls = Array.from(
          event.currentTarget.querySelectorAll<HTMLElement>(
            'a[href], button, input:not([type="hidden"]), textarea, select, [tabindex]',
          ),
        ).filter(
          (element) =>
            element.tabIndex >= 0 &&
            !element.matches(":disabled") &&
            element.getClientRects().length > 0,
        );
        const first = controls[0],
          last = controls.at(-1);
        if (
          first &&
          last &&
          ((event.shiftKey && document.activeElement === first) ||
            (!event.shiftKey && document.activeElement === last))
        ) {
          event.preventDefault();
          (event.shiftKey ? last : first).focus();
        }
      }}
      aria-labelledby={titleId}
    >
      <header className="section-heading">
        <h2 id={titleId}>{title}</h2>
        <button type="button" onClick={onClose} aria-label="关闭">
          关闭
        </button>
      </header>
      {children}
    </dialog>
  );
}
