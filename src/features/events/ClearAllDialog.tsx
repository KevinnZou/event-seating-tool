import { errorMessage } from "../../lib/errors";
import { useState } from "react";
import { Modal } from "../../components/ui/Modal";
import { backupService } from "../export/backupService";
import { downloadBackup } from "../export/backupDownloads";
import { historyService } from "../../domain/historyService";
export function ClearAllDialog({ onClose }: { onClose: () => void }) {
  const [confirm, setConfirm] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  return (
    <Modal title="清空全部本地数据" onClose={onClose}>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError("");
          try {
            await backupService.clearAll(confirm);
            historyService.reset();
            onClose();
          } catch (e) {
            setError(errorMessage(e, "清空失败"));
          } finally {
            setBusy(false);
          }
        }}
      >
        <p className="error">
          这会永久删除当前浏览器中的所有活动、名单、桌位与检查点。请先下载完整备份。其他浏览器不会受影响。
        </p>
        <button
          type="button"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            try {
              await downloadBackup();
            } catch (e) {
              setError(errorMessage(e, "下载失败"));
            } finally {
              setBusy(false);
            }
          }}
        >
          先下载全部活动完整备份
        </button>
        <label>
          输入“清空全部本地数据”确认
          <input value={confirm} onChange={(e) => setConfirm(e.target.value)} />
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
          <button
            className="danger"
            disabled={busy || confirm !== "清空全部本地数据"}
          >
            确认清空全部本地数据
          </button>
        </footer>
      </form>
    </Modal>
  );
}
