import { useState, type FormEvent } from "react";
import { Modal } from "../../components/ui/Modal";
import { eventTypes, type EventInput } from "../../domain/models";
export function EventForm({
  initial,
  onSave,
  onClose,
}: {
  initial?: EventInput;
  onSave: (input: EventInput, count: number) => Promise<unknown>;
  onClose: () => void;
}) {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setBusy(true);
    try {
      await onSave(
        {
          name: String(f.get("name")),
          type: String(f.get("type")) as EventInput["type"],
          date: String(f.get("date")) || undefined,
          defaultCapacity: Number(f.get("capacity")),
        },
        Number(f.get("count") ?? 0),
      );
      onClose();
    } catch {
      setError("保存失败，请检查名称、人数范围或浏览器存储权限。");
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal title={initial ? "编辑活动" : "新建活动"} onClose={onClose}>
      <form onSubmit={submit}>
        <label>
          活动名称
          <input
            name="name"
            required
            maxLength={100}
            autoFocus
            defaultValue={initial?.name}
            placeholder="例如：秋日婚宴"
          />
        </label>
        <div className="form-grid">
          <label>
            活动类型
            <select name="type" defaultValue={initial?.type ?? "wedding"}>
              {Object.entries(eventTypes).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </label>
          <label>
            日期（可选）
            <input name="date" type="date" defaultValue={initial?.date} />
          </label>
          <label>
            默认每桌容量
            <input
              name="capacity"
              type="number"
              min="1"
              max="999"
              required
              defaultValue={initial?.defaultCapacity ?? 10}
            />
          </label>
          {!initial && (
            <label>
              初始桌数
              <input
                name="count"
                type="number"
                min="0"
                max="100"
                required
                defaultValue={0}
              />
            </label>
          )}
        </div>
        <p className="muted">圆桌活动 · 建议每桌 1–30 人 · 超员默认阻止</p>
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
            {busy ? "正在保存…" : "保存活动"}
          </button>
        </footer>
      </form>
    </Modal>
  );
}
