import { useState } from "react";
import {
  fields,
  fieldLabels,
  parseText,
  parseCsv,
  mapRows,
  guessMapping,
  type Mapping,
  type DraftRow,
} from "./parsers";
import { readWorkbook, readCsv, MAX_FILE } from "./files";
export function ImportSource({
  onPreview,
}: {
  onPreview: (rows: DraftRow[]) => void;
}) {
  const [text, setText] = useState(""),
    [sheets, setSheets] = useState<{ name: string; rows: string[][] }[]>([]),
    [sheet, setSheet] = useState(0),
    [header, setHeader] = useState(true),
    [mapping, setMapping] = useState<Mapping>({
      name: 0,
      size: 1,
      category: 2,
      table: 3,
      attendance: 4,
      note: 5,
    }),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const cells = sheets[sheet]?.rows ?? [];
  return (
    <>
      <label>
        粘贴文本
        <textarea
          className="import-text"
          placeholder={
            "虚构宾客甲\n虚构宾客乙一家(4)\n03号桌：虚构宾客丙、虚构宾客丁夫妻（2）"
          }
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setSheets([]);
          }}
        />
      </label>
      <p className="muted">
        一行一组；一家/夫妻请明确人数。复杂注释会保留并要求核对。
      </p>
      <label>
        或选择 CSV / XLSX（最多10MB）
        <input
          type="file"
          accept=".csv,.xlsx"
          disabled={busy}
          onChange={async (e) => {
            const input = e.target,
              file = input.files?.[0];
            if (!file) return;
            setError("");
            setBusy(true);
            try {
              if (file.size > MAX_FILE) throw new Error("文件上限10MB");
              const result = /\.xlsx$/i.test(file.name)
                ? await readWorkbook(file)
                : /\.csv$/i.test(file.name)
                  ? [{ name: "CSV", rows: parseCsv(await readCsv(file)) }]
                  : (() => {
                      throw new Error("仅支持.csv和.xlsx");
                    })();
              if (!result.length || !result[0].rows.length)
                throw new Error("文件没有内容");
              setSheets(result);
              setText("");
              setSheet(0);
              setMapping(guessMapping(result[0].rows[0]));
            } catch (e) {
              setError(e instanceof Error ? e.message : "文件读取失败");
            } finally {
              setBusy(false);
              input.value = "";
            }
          }}
        />
      </label>
      {sheets.length > 0 && (
        <>
          <label>
            工作表
            <select
              value={sheet}
              onChange={(e) => {
                const index = Number(e.target.value);
                setSheet(index);
                setMapping(guessMapping(sheets[index].rows[0] ?? []));
              }}
            >
              {sheets.map((s, i) => (
                <option key={i} value={i}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>
          <label className="check">
            <input
              type="checkbox"
              checked={header}
              onChange={(e) => setHeader(e.target.checked)}
            />
            第一行是表头
          </label>
          <div className="form-grid">
            {fields.map((f) => (
              <label key={f}>
                {fieldLabels[f]}列
                <select
                  value={mapping[f]}
                  onChange={(e) =>
                    setMapping({ ...mapping, [f]: Number(e.target.value) })
                  }
                >
                  <option value={-1}>不映射 / 手动核对</option>
                  {(cells[0] ?? []).map((v, i) => (
                    <option key={i} value={i}>
                      {i + 1}：{v || "空列"}
                    </option>
                  ))}
                </select>
              </label>
            ))}
          </div>
          <div className="scroll">
            <table>
              <tbody>
                {cells.slice(0, 4).map((r, i) => (
                  <tr key={i}>
                    {r.map((c, j) => (
                      <td key={j}>{c}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
      <button
        className="primary"
        disabled={busy || (!text.trim() && !sheets.length)}
        onClick={() => {
          try {
            const draft = sheets.length
              ? mapRows(cells, mapping, header)
              : parseText(text);
            if (!draft.length) throw new Error("没有可预览的记录");
            onPreview(draft);
          } catch (e) {
            setError(e instanceof Error ? e.message : "解析失败");
          }
        }}
      >
        {busy ? "正在读取文件…" : "生成预览"}
      </button>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
    </>
  );
}
