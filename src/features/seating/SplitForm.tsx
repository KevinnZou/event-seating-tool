import { errorMessage } from "../../lib/errors";
import { useState } from "react";
import { Modal } from "../../components/ui/Modal";
import type { GuestGroupEntity } from "../../domain/models";
import { workspaceService } from "../../domain/workspaceService";
export function SplitForm({
  eventId,
  guest,
  onClose,
  execute,
}: {
  eventId: string;
  guest: GuestGroupEntity;
  onClose: () => void;
  execute: (a: () => Promise<unknown>) => Promise<void>;
}) {
  const [parts, setParts] = useState([
    { name: `${guest.displayName}（甲组）`, size: 1 },
    { name: `${guest.displayName}（乙组）`, size: guest.size - 1 },
  ]);
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  return (
    <Modal title="拆分宾客组" onClose={onClose}>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          try {
            await execute(() =>
              workspaceService.split(eventId, guest.id, parts),
            );
            onClose();
          } catch (e) {
            setError(errorMessage(e, "拆分失败"));
          } finally {
            setBusy(false);
          }
        }}
      >
        <p>
          原组 {guest.size} 人，拆分后人数合计必须不变。新组保留来源关联与桌位。
        </p>
        {parts.map((p, i) => (
          <div className="form-grid" key={i}>
            <label>
              第{i + 1}组名称
              <input
                required
                maxLength={100}
                value={p.name}
                onChange={(e) =>
                  setParts(
                    parts.map((item, j) =>
                      j === i ? { ...item, name: e.target.value } : item,
                    ),
                  )
                }
              />
            </label>
            <label>
              第{i + 1}组人数
              <input
                type="number"
                min={1}
                max={999}
                required
                value={p.size}
                onChange={(e) =>
                  setParts(
                    parts.map((item, j) =>
                      j === i
                        ? { ...item, size: Number(e.target.value) }
                        : item,
                    ),
                  )
                }
              />
            </label>
          </div>
        ))}
        {error && (
          <p role="alert" className="error">
            {error}
          </p>
        )}
        <footer>
          <button type="button" onClick={onClose}>
            取消
          </button>
          <button className="primary" disabled={busy}>
            确认拆分
          </button>
        </footer>
      </form>
    </Modal>
  );
}
