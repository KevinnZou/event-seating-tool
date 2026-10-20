import { useState } from "react";
import type { Snapshot } from "../../domain/models";
import { fields, fieldLabels, rowErrors, type DraftRow } from "./parsers";
export function PreviewRows({
  rows,
  page,
  setPage,
  editRow,
  snapshot,
  mode,
}: {
  rows: DraftRow[];
  snapshot: Snapshot;
  mode: "append" | "replace";
  page: number;
  setPage: (p: number) => void;
  editRow: (id: string, patch: Partial<DraftRow>) => void;
}) {
  const [choosing, setChoosing] = useState<string | null>(null);
  return (
    <>
      <div className="scroll preview-table">
        <table>
          <thead>
            <tr>
              <th>选入 / 原文</th>
              {fields.map((f) => (
                <th key={f}>{fieldLabels[f]}</th>
              ))}
              <th>新增 / 指定更新</th>
              <th>核对</th>
            </tr>
          </thead>
          <tbody>
            {rows.slice(page * 30, (page + 1) * 30).map((r) => (
              <tr key={r.id}>
                <td>
                  <label className="check">
                    <input
                      type="checkbox"
                      aria-label={`导入第${r.line}行`}
                      checked={r.included}
                      onChange={(e) =>
                        editRow(r.id, { included: e.target.checked })
                      }
                    />
                    第{r.line}行
                  </label>
                  <details>
                    <summary>原文</summary>
                    <p>{r.raw}</p>
                  </details>
                </td>
                {fields.map((f) => (
                  <td key={f}>
                    {f === "attendance" ? (
                      <select
                        aria-label={`第${r.line}行状态`}
                        value={r.attendance}
                        onChange={(e) =>
                          editRow(r.id, {
                            attendance: e.target.value,
                          })
                        }
                      >
                        {!["confirmed", "tentative", "declined"].includes(
                          r.attendance,
                        ) && (
                          <option value={r.attendance}>
                            无效：{r.attendance || "空"}
                          </option>
                        )}
                        <option value="confirmed">确认</option>
                        <option value="tentative">待定</option>
                        <option value="declined">不参加</option>
                      </select>
                    ) : (
                      <input
                        aria-label={`第${r.line}行${fieldLabels[f]}`}
                        value={f === "name" ? r.name : r[f]}
                        onChange={(e) => editRow(r.id, { [f]: e.target.value })}
                      />
                    )}
                  </td>
                ))}
                <td>
                  {r.targetId || choosing === r.id ? (
                    <>
                      <select
                        aria-label={`第${r.line}行更新目标`}
                        disabled={mode === "replace"}
                        value={r.targetId ?? ""}
                        onChange={(e) =>
                          editRow(r.id, {
                            targetId: e.target.value || undefined,
                          })
                        }
                      >
                        <option value="">新增独立记录</option>
                        {snapshot.guests.map((g) => (
                          <option key={g.id} value={g.id}>
                            {g.displayName} · {g.size}人 ·{" "}
                            {g.category || "未分组"} · {g.id.slice(0, 8)}
                          </option>
                        ))}
                      </select>
                    </>
                  ) : (
                    <>
                      <p>新增独立记录</p>
                      <button
                        disabled={mode === "replace"}
                        onClick={() => setChoosing(r.id)}
                      >
                        指定更新
                      </button>
                    </>
                  )}
                  {r.targetId && (
                    <p className="muted">
                      明确更新：原
                      {snapshot.guests.find((g) => g.id === r.targetId)?.size}人
                      → {r.size}
                      人。本行所有字段（含空桌号与备注）将替换原值，ID保留。
                    </p>
                  )}
                </td>
                <td>
                  {rowErrors(r).join("；") || "可导入"}
                  {r.review && (
                    <button onClick={() => editRow(r.id, { review: false })}>
                      已核对注释
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="actions">
        <button disabled={page === 0} onClick={() => setPage(page - 1)}>
          上一页
        </button>
        <span>
          第{page + 1} / {Math.max(1, Math.ceil(rows.length / 30))}页
        </span>
        <button
          disabled={(page + 1) * 30 >= rows.length}
          onClick={() => setPage(page + 1)}
        >
          下一页
        </button>
      </div>
    </>
  );
}
