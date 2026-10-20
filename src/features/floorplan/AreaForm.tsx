import { useState, type FormEvent } from "react";
import { Modal } from "../../components/ui/Modal";
import { areaLabels, type VenueArea } from "../../domain/venueModels";
import { venueService } from "../../domain/venueService";
import { errorMessage } from "../../lib/errors";
export function AreaForm({
  eventId,
  initial,
  execute,
  onClose,
}: {
  eventId: string;
  initial?: VenueArea;
  execute: (action: () => Promise<unknown>) => Promise<void>;
  onClose: () => void;
}) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const input = {
      kind: String(form.get("kind")) as VenueArea["kind"],
      label: String(form.get("label")),
      x: Number(form.get("x")),
      y: Number(form.get("y")),
      width: Number(form.get("width")),
      height: Number(form.get("height")),
    };
    setBusy(true);
    try {
      await execute(() => venueService.saveArea(eventId, input, initial?.id));
      onClose();
    } catch (error) {
      setError(errorMessage(error, "区域保存失败"));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal
      title={initial ? "编辑场地区域" : "新增场地区域"}
      onClose={() => {
        if (!busy) onClose();
      }}
    >
      <form onSubmit={submit}>
        <label>
          区域类型
          <select name="kind" defaultValue={initial?.kind ?? "stage"}>
            {Object.entries(areaLabels).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label>
          区域名称
          <input
            name="label"
            required
            maxLength={60}
            defaultValue={initial?.label ?? "舞台"}
          />
        </label>
        <div className="form-grid">
          {(
            [
              ["x", "区域X坐标", 40],
              ["y", "区域Y坐标", 40],
              ["width", "区域宽度", 240],
              ["height", "区域高度", 80],
            ] as const
          ).map(([key, label, fallback]) => (
            <label key={key}>
              {label}
              <input
                name={key}
                type="number"
                min={key === "x" || key === "y" ? 0 : 40}
                max={key === "x" || key === "y" ? 12000 : 2000}
                required
                defaultValue={initial?.[key] ?? fallback}
              />
            </label>
          ))}
        </div>
        <p className="muted">
          画布坐标用于布局示意，不表示真实米数。区域必须完整位于画布内。
        </p>
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        <footer>
          <button type="button" disabled={busy} onClick={onClose}>
            取消
          </button>
          <button className="primary" disabled={busy}>
            保存区域
          </button>
        </footer>
      </form>
    </Modal>
  );
}
