import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { Link, useParams } from "react-router-dom";
import { db } from "../../db/database";
import { repository } from "../../db/repository";
import { download } from "../../lib/download";
import { errorMessage } from "../../lib/errors";
import { planPng, planSvg } from "./planExport";
export function PlanDelivery() {
  const { eventId = "" } = useParams();
  const s = useLiveQuery(
    async () =>
      (await db.events.get(eventId)) ? repository.snapshot(eventId) : null,
    [eventId],
  );
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  if (s === undefined) return <p role="status">正在读取场地图…</p>;
  if (!s)
    return (
      <>
        <h1>本机无此活动</h1>
        <Link to="/">返回本地活动</Link>
      </>
    );
  let image: ReturnType<typeof planSvg>;
  try {
    image = planSvg(s);
  } catch {
    return <p role="alert">活动数据无效，请返回工作区校验后导出。</p>;
  }
  const filename = `${s.event.name}_${new Date().toISOString().slice(0, 10)}_场地平面图`;
  return (
    <div className="plan-delivery">
      <div className="plan-delivery-controls">
        <Link className="crumb" to={`/events/${eventId}?view=floor`}>
          ← 返回排桌工作区
        </Link>
        <div className="page-heading">
          <div>
            <h1>场地图交付</h1>
            <p className="muted">
              场地区域、桌号、占用与容量；不含宾客姓名。名单请另附报表。
            </p>
          </div>
        </div>
        <div className="actions">
          <button
            onClick={() =>
              download(
                image.svg,
                `${filename}.svg`,
                "image/svg+xml;charset=utf-8",
              )
            }
          >
            下载SVG场地图
          </button>
          <button
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              setError("");
              try {
                download(await planPng(s), `${filename}.png`, "image/png");
              } catch (error) {
                setError(errorMessage(error, "图像导出失败"));
              } finally {
                setBusy(false);
              }
            }}
          >
            {busy ? "正在生成图像…" : "下载PNG场地图"}
          </button>
          <button className="primary" onClick={() => window.print()}>
            打印场地图 / PDF
          </button>
          <Link className="button" to={`/events/${eventId}/export`}>
            完整名单报表
          </Link>
        </div>
        <p className="muted">
          打印选择横向、适合页面，关闭页眉页脚。坐标为布局示意，不代表实测比例。PNG最长边4096像素，SVG保持矢量清晰度。
        </p>
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
      </div>
      <img
        className="plan-delivery-image"
        src={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(image.svg)}`}
        alt={`${s.event.name}场地圆桌分配图`}
        width={image.width}
        height={image.height}
      />
    </div>
  );
}
