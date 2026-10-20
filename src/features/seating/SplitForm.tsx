import { splitSizes } from "../../domain/snapshots";
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
  const sizes = parts.map((p) => p.size);
  const total = sizes.reduce((sum, size) => sum + size, 0);
  const valid =
    splitSizes(guest.size, sizes) && parts.every((p) => p.name.trim());
  return (
    <Modal
      title="拆分宾客组"
      onClose={() => {
        if (!busy) onClose();
      }}
    >
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          if (!valid) {
            setError("请填写每组名称和正整数人数，合计须与原组相同");
            return;
          }
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
        <p className={valid ? "success" : "notice"} role="status">
          已分配 {total} / {guest.size} 人 ·{" "}
          {total === guest.size
            ? "人数合计一致"
            : total < guest.size
              ? `还差 ${guest.size - total} 人`
              : `超出 ${total - guest.size} 人`}
        </p>
        <fieldset disabled={busy} className="split-parts">
          {parts.map((p, i) => (
            <section key={i} className="split-part">
              <div className="section-heading">
                <h3>第{i + 1}组</h3>
                <button
                  type="button"
                  disabled={parts.length <= 2}
                  aria-label={`移除第${i + 1}组`}
                  onClick={() => setParts(parts.filter((_, j) => j !== i))}
                >
                  移除此组
                </button>
              </div>
              <div className="form-grid">
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
            </section>
          ))}
          <button
            type="button"
            disabled={parts.length >= guest.size}
            onClick={() =>
              setParts([
                ...parts,
                {
                  name: `${guest.displayName}（第${parts.length + 1}组）`,
                  size: 1,
                },
              ])
            }
          >
            增加一组
          </button>
        </fieldset>
        <p className="muted">
          增减组数不会自动改动其他份额，请逐组核对。拆分后可在工作区一步撤销。
        </p>
        {error && (
          <p role="alert" className="error">
            {error}
          </p>
        )}
        <footer>
          <button type="button" disabled={busy} onClick={onClose}>
            取消
          </button>
          <button className="primary" disabled={busy || !valid}>
            确认拆分
          </button>
        </footer>
      </form>
    </Modal>
  );
}
