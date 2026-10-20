import { errorMessage } from "../../lib/errors";
import { useState, type FormEvent } from "react";
import { Modal } from "../../components/ui/Modal";
import { seatingService } from "../../domain/services";
import type { TableEntity } from "../../domain/models";
export function TableForm({
  eventId,
  initial,
  capacity,
  onClose,
  execute,
}: {
  eventId: string;
  initial?: TableEntity;
  capacity: number;
  onClose: () => void;
  execute: (a: () => Promise<unknown>) => Promise<void>;
}) {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setBusy(true);
    try {
      await execute(() =>
        seatingService.saveTable(
          eventId,
          {
            label: String(f.get("label")),
            capacity: Number(f.get("capacity")),
            locked: initial?.locked ?? false,
            note: String(f.get("note")),
          },
          initial?.id,
        ),
      );
      onClose();
    } catch (e) {
      setError(errorMessage(e, "保存失败"));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal title={initial ? "编辑桌位" : "新增桌位"} onClose={onClose}>
      <form onSubmit={submit}>
        <label>
          展示桌号
          <input
            name="label"
            autoFocus
            required
            maxLength={40}
            defaultValue={initial?.label}
            placeholder="例如：01、03、66、主桌"
          />
        </label>
        <label>
          容量
          <input
            name="capacity"
            type="number"
            min="1"
            max="999"
            required
            defaultValue={initial?.capacity ?? capacity}
          />
        </label>
        <p className="muted">
          建议 1–30 人，特殊圆桌最多 999 人。01 与 1 视为同号。
        </p>
        <label>
          桌位备注
          <textarea name="note" maxLength={2000} defaultValue={initial?.note} />
        </label>
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
            保存桌位
          </button>
        </footer>
      </form>
    </Modal>
  );
}
