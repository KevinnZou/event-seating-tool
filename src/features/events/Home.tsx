import { createVenueDemo } from "./venueDemoService";
import { errorMessage } from "../../lib/errors";
import { BackupManager } from "../export/BackupManager";
import { downloadBackup } from "../export/backupDownloads";
import { ClearAllDialog } from "./ClearAllDialog";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "../../db/database";
import { seatingService } from "../../domain/services";
import type { EventEntity } from "../../domain/models";
import { EventForm } from "./EventForm";
import { EventCard } from "./EventCard";
import { createDemo } from "./demoService";
import { Modal } from "../../components/ui/Modal";
export function Home() {
  const events = useLiveQuery(() =>
    db.events.orderBy("updatedAt").reverse().toArray(),
  );
  const navigate = useNavigate();
  const [edit, setEdit] = useState<EventEntity | "new" | null>(null);
  const [deleting, setDeleting] = useState<EventEntity | null>(null);
  const [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [backingUp, setBackingUp] = useState(false),
    [clearing, setClearing] = useState(false);
  async function run(action: () => Promise<unknown>) {
    setBusy(true);
    setError("");
    try {
      await action();
    } catch (e) {
      setError(errorMessage(e, "保存失败，请检查浏览器存储权限"));
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <div className="page-heading">
        <div>
          <h1>本地活动</h1>
          <p className="muted">无需登录 · 仅保存在本机 · 建议下载备份</p>
        </div>
        <div className="actions">
          <button onClick={() => setBackingUp(true)}>备份与恢复</button>
          <button className="primary" onClick={() => setEdit("new")}>
            新建活动
          </button>
        </div>
      </div>
      <p className="notice">
        活动数据仅保存在当前浏览器。清理站点数据、换设备或使用无痕模式可能丢失数据。请定期下载完整JSON备份。
      </p>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      {events === undefined ? (
        <p role="status">正在读取本地活动…</p>
      ) : events.length === 0 ? (
        <section className="empty">
          <h2>从一场活动开始</h2>
          <p>创建活动，逐组核对人数，为每位宾客安排一张圆桌。</p>
          <button onClick={() => setEdit("new")}>创建第一个活动</button>
        </section>
      ) : (
        events.map((event) => (
          <EventCard
            key={event.id}
            event={event}
            onEdit={() => setEdit(event)}
            onCopy={() =>
              void run(async () => {
                await seatingService.copyEvent(event.id);
              })
            }
            onDelete={() => {
              setConfirmation("");
              setDeleting(event);
            }}
          />
        ))
      )}
      <section className="demo-gallery" aria-label="虚构示例体验">
        <div className="demo-intro">
          <h2>先体验，再开始</h2>
          <p className="muted">每次创建独立的虚构活动，可自由修改。</p>
        </div>
        <article className="demo-card">
          <span className="eyebrow">名单与整组排桌</span>
          <h3>从一家四口开始</h3>
          <p>3 张圆桌，体验家庭组人数统计、换桌与撤销。</p>
          <button
            disabled={busy}
            onClick={() =>
              void run(async () => navigate(`/events/${await createDemo()}`))
            }
          >
            试用虚构演示
          </button>
        </article>
        <article className="demo-card">
          <span className="eyebrow">场地可视化</span>
          <h3>把整个宴会厅铺开</h3>
          <p>12 张圆桌，体验舞台与入口布局、整组安排和场地图导出。</p>
          <button
            disabled={busy}
            onClick={() =>
              void run(async () =>
                navigate(`/events/${await createVenueDemo()}?view=floor`),
              )
            }
          >
            试用场地平面图演示
          </button>
        </article>
        {busy && <p role="status">正在处理，请稍候…</p>}
      </section>
      <div className="data-management">
        <button
          className="link-button danger"
          onClick={() => setClearing(true)}
        >
          清空全部本地数据
        </button>
      </div>
      {backingUp && <BackupManager onClose={() => setBackingUp(false)} />}
      {clearing && <ClearAllDialog onClose={() => setClearing(false)} />}
      {edit && (
        <EventForm
          initial={edit === "new" ? undefined : edit}
          onClose={() => setEdit(null)}
          onSave={async (input, count) => {
            if (edit === "new")
              navigate(
                `/events/${await seatingService.createEvent(input, count)}`,
              );
            else await seatingService.updateEvent(edit.id, input);
          }}
        />
      )}
      {deleting && (
        <Modal title="删除活动" onClose={() => setDeleting(null)}>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void run(async () => {
                await seatingService.deleteEvent(deleting.id, confirmation);
                setDeleting(null);
              });
            }}
          >
            <p>
              将永久删除“{deleting.name}
              ”及全部桌位、宾客组。请先下载完整备份；删除后可从文件恢复。
            </p>
            <button
              type="button"
              disabled={busy}
              onClick={() => void run(() => downloadBackup(deleting.id))}
            >
              先下载该活动备份
            </button>
            <label>
              输入完整活动名称确认
              <input
                autoFocus
                value={confirmation}
                onChange={(e) => setConfirmation(e.target.value)}
              />
            </label>
            {error && (
              <p role="alert" className="error">
                {error}
              </p>
            )}
            <footer>
              <button type="button" onClick={() => setDeleting(null)}>
                取消
              </button>
              <button
                className="danger"
                disabled={busy || confirmation !== deleting.name}
              >
                确认删除活动
              </button>
            </footer>
          </form>
        </Modal>
      )}
    </>
  );
}
