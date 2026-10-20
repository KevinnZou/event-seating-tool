import { useState } from "react";
import { Modal } from "../../components/ui/Modal";
import type { Snapshot } from "../../domain/models";
import { fingerprint } from "../../domain/snapshots";
import {
  suggestSeating,
  suggestionService,
  type SeatingProposal,
  type SeatingRule,
} from "../../domain/suggestions";
import { errorMessage } from "../../lib/errors";
export function SuggestionDialog({
  snapshot,
  execute,
  onClose,
}: {
  snapshot: Snapshot;
  execute: (action: () => Promise<unknown>) => Promise<void>;
  onClose: () => void;
}) {
  const [rule, setRule] = useState<SeatingRule>("category"),
    [includeTentative, setIncludeTentative] = useState(true);
  const [preview, setPreview] = useState<{
      snapshot: Snapshot;
      proposal: SeatingProposal;
    } | null>(null),
    [page, setPage] = useState(0);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const stale = preview && fingerprint(snapshot) !== preview.proposal.base;
  const proposal = preview?.proposal;
  const people =
    proposal?.assignments.reduce(
      (sum, a) =>
        sum + preview!.snapshot.guests.find((g) => g.id === a.guestId)!.size,
      0,
    ) ?? 0;
  const remaining =
    proposal?.remaining.reduce(
      (sum, a) =>
        sum + preview!.snapshot.guests.find((g) => g.id === a.guestId)!.size,
      0,
    ) ?? 0;
  const rows = proposal ? [...proposal.assignments, ...proposal.remaining] : [];
  return (
    <Modal
      title="规则排桌建议"
      onClose={() => {
        if (!busy) onClose();
      }}
    >
      <p className="notice">
        仅安排全活动的未安排宾客，不受工作区筛选影响。不移动已有安排，不拆家庭，不使用锁定桌。先核对预览，再确认写入。
      </p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          setError("");
          try {
            setPreview({
              snapshot,
              proposal: suggestSeating(snapshot, { rule, includeTentative }),
            });
            setPage(0);
          } catch (error) {
            setError(errorMessage(error, "建议生成失败"));
          }
        }}
      >
        <label>
          排桌规则
          <select
            value={rule}
            disabled={busy}
            onChange={(e) => {
              setRule(e.target.value as SeatingRule);
              setPreview(null);
            }}
          >
            <option value="category">同类优先：优先已有相同分组的桌</option>
            <option value="compact">紧凑安排：优先利用较小余席</option>
            <option value="balanced">均衡占用：优先较低占用比例</option>
          </select>
        </label>
        <label className="check">
          <input
            type="checkbox"
            checked={includeTentative}
            disabled={busy}
            onChange={(e) => {
              setIncludeTentative(e.target.checked);
              setPreview(null);
            }}
          />
          包含待定宾客
        </label>
        <button disabled={busy}>生成建议预览</button>
      </form>
      {proposal && (
        <>
          <p className="success" role="status">
            建议安排 {proposal.assignments.length} 组 / {people} 人；仍未安排{" "}
            {proposal.remaining.length} 组 / {remaining} 人。
          </p>
          <p className="muted">
            大组优先的启发式方案，不保证全局最优。同类仅依据你填写的分组，不推断姓名关系。
          </p>
          {stale && (
            <p className="error" role="alert">
              预览后数据已变化，请重新生成建议；当前预览不能应用。
            </p>
          )}
          <div className="scroll">
            <table className="proposal-table">
              <thead>
                <tr>
                  <th>宾客组</th>
                  <th>建议桌</th>
                  <th>原因</th>
                </tr>
              </thead>
              <tbody>
                {rows.slice(page * 30, (page + 1) * 30).map((row) => {
                  const guest = preview!.snapshot.guests.find(
                    (g) => g.id === row.guestId,
                  )!;
                  return (
                    <tr key={row.guestId}>
                      <td>
                        {guest.displayName}（{guest.size}人）
                      </td>
                      <td>
                        {"tableId" in row
                          ? preview!.snapshot.tables.find(
                              (t) => t.id === row.tableId,
                            )?.label
                          : "仍未安排"}
                      </td>
                      <td>{row.reason}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {rows.length > 30 && (
            <div className="pagination">
              <button disabled={page === 0} onClick={() => setPage(page - 1)}>
                前30组
              </button>
              <span>
                第 {page + 1} / {Math.ceil(rows.length / 30)} 页，共{" "}
                {rows.length} 组
              </span>
              <button
                disabled={(page + 1) * 30 >= rows.length}
                onClick={() => setPage(page + 1)}
              >
                后30组
              </button>
            </div>
          )}
          {!rows.length && (
            <p className="muted">当前没有计划出席的未安排宾客。</p>
          )}
        </>
      )}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <footer>
        <button disabled={busy} onClick={onClose}>
          取消
        </button>
        <button
          className="primary"
          disabled={busy || !proposal?.assignments.length || Boolean(stale)}
          onClick={async () => {
            if (!proposal) return;
            setBusy(true);
            setError("");
            try {
              await execute(() =>
                suggestionService.apply(snapshot.event.id, proposal),
              );
              onClose();
            } catch (error) {
              setError(errorMessage(error, "建议应用失败，未改变现有安排"));
            } finally {
              setBusy(false);
            }
          }}
        >
          {busy ? "正在保存…" : "确认应用建议"}
        </button>
      </footer>
    </Modal>
  );
}
