import { errorMessage } from "../../lib/errors";
import { useState, type FormEvent } from "react";
import { Modal } from "../../components/ui/Modal";
import { seatingService } from "../../domain/services";
import {
  attendanceLabels,
  type GuestGroupEntity,
  type GuestInput,
} from "../../domain/models";
export function GuestForm({
  eventId,
  initial,
  onClose,
  execute,
}: {
  eventId: string;
  initial?: GuestGroupEntity;
  onClose: () => void;
  execute: (a: () => Promise<unknown>) => Promise<void>;
}) {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const attendance = String(f.get("attendance")) as GuestInput["attendance"];
    if (
      initial?.tableId &&
      attendance === "declined" &&
      !window.confirm("将标记为不参加并迁回未安排区，保留宾客记录。确认继续？")
    )
      return;
    setBusy(true);
    try {
      await execute(() =>
        seatingService.saveGuest(
          eventId,
          {
            displayName: String(f.get("displayName")),
            size: Number(f.get("size")),
            kind: String(f.get("kind")) as GuestInput["kind"],
            category: String(f.get("category")),
            attendance,
            note: String(f.get("note")),
          },
          initial?.id,
          true,
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
    <Modal title={initial ? "编辑宾客组" : "新增宾客组"} onClose={onClose}>
      <form onSubmit={submit}>
        <label>
          名称 / 家庭或团队
          <input
            name="displayName"
            required
            autoFocus
            maxLength={100}
            defaultValue={initial?.displayName}
          />
        </label>
        <div className="form-grid">
          <label>
            人数
            <input
              name="size"
              type="number"
              min="1"
              max="999"
              required
              defaultValue={initial?.size ?? 1}
            />
          </label>
          <label>
            组类型
            <select name="kind" defaultValue={initial?.kind ?? "other"}>
              {Object.entries({
                person: "个人",
                couple: "夫妻",
                family: "家庭",
                team: "团队",
                other: "其他",
              }).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </label>
          <label>
            关系 / 分组
            <input
              name="category"
              maxLength={100}
              defaultValue={initial?.category}
            />
          </label>
          <label>
            出席状态
            <select
              name="attendance"
              defaultValue={initial?.attendance ?? "confirmed"}
            >
              {Object.entries(attendanceLabels).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </label>
        </div>
        <label>
          备注
          <textarea name="note" maxLength={2000} defaultValue={initial?.note} />
        </label>
        <p className="muted">
          人数以填写值为准，系统不会根据“一家”等名称自动推断。
        </p>
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
            保存宾客组
          </button>
        </footer>
      </form>
    </Modal>
  );
}
