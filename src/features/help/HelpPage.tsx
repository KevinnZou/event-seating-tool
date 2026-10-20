import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { download } from "../../lib/download";
import { errorMessage } from "../../lib/errors";
import { feedbackText } from "./feedback";
export function HelpPage() {
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    setError("");
    const form = new FormData(event.currentTarget);
    try {
      download(
        feedbackText({
          category: form.get("category"),
          description: form.get("description"),
          steps: form.get("steps"),
          privacyConfirmed: form.get("privacy") === "on",
        }),
        "智能排桌助手_匿名反馈草稿.txt",
        "text/plain;charset=utf-8",
      );
      setMessage(
        "反馈草稿已触发下载，未向任何人发送。请检查内容后自行决定是否分享。",
      );
    } catch (error) {
      setError(errorMessage(error, "草稿生成失败，请检查填写内容"));
    }
  }
  return (
    <>
      <Link className="crumb" to="/">
        ← 返回本地活动
      </Link>
      <div className="page-heading">
        <div>
          <h1>使用帮助与隐私</h1>
          <p className="muted">无需账号 · 名单只在本机 · 支持中文圆桌活动</p>
        </div>
      </div>
      <div className="help-grid">
        <section className="panel">
          <h2>从创建到交付</h2>
          <ol className="help-steps">
            <li>创建活动，选择婚礼、宴会或年会，设置默认容量与初始桌数。</li>
            <li>
              逐组录入，或使用“导入名单”下载模板、粘贴文本、导入CSV/Excel。预览中先修复错误，同名也会保留独立记录。
            </li>
            <li>
              以人数核对家庭和团队，在名单或排桌工作台通过桌位菜单移动整组。详情可查看完整整桌名单；锁定桌先解锁。
            </li>
            <li>
              处理校验中心的漏排和待确认提醒，导出文字、表格或打印名单/桌卡。打印对话框可保存PDF。
            </li>
            <li>
              下载完整JSON备份并确认文件能打开。报表只用于交接，无法恢复活动。
            </li>
          </ol>
        </section>
        <section className="panel">
          <h2>数据保存与迁移</h2>
          <p>
            活动、桌位、名单和检查点只保存在当前浏览器的IndexedDB。清理站点数据会删除它们；无痕窗口关闭、换浏览器或换设备也可能无法找回。
          </p>
          <p>
            请用JSON文件迁移：在首页选择“备份与恢复”，默认恢复为新活动。覆盖恢复需要明确确认，覆盖前自动创建检查点。
          </p>
          <p>
            本站不上传名单，不调用AI、不使用第三方埋点、远程字体或广告。活动链接只有本机ID，发给别人不会分享名单；需要交接时由你选择下载文件并分享。
          </p>
        </section>
        <section className="panel">
          <h2>离线与浏览器</h2>
          <p>
            Chrome和Safari的现代浏览器引擎为测试目标，手机可通过菜单操作，无需拖拽。设备、系统或浏览器隐私策略仍可能限制本地存储。
          </p>
          <p>
            生产版首次联网打开后，看到“离线资源已就绪”即可尝试断网重开。开发服务器不提供离线缓存。静态资源缓存与本机数据库都不能代替JSON备份。
          </p>
          <p>
            新版本会等待你确认再刷新，刷新只会结束本次撤销历史。存储失败时请先检查权限与空间，不要通过清理站点数据来排查有名单的浏览器。
          </p>
        </section>
        <section className="panel">
          <h2>键盘与人数规则</h2>
          <p>
            Tab切换控件，Enter激活按钮，方向键选择菜单，Esc关闭对话框。页面首个键盘入口可跳到主要内容。Safari未启用全键盘访问时可用Option+Tab遍历链接和按钮。
          </p>
          <p>
            计划出席=确认+待定；不参加保留记录但不占席。家庭4人始终按4席计算，拆分需要用户逐份确认且总人数守恒。超员默认阻止，同名不自动合并。
          </p>
          <p>
            撤销最多30步，仅在当前页面会话有效。导入和恢复前有本地检查点；清空全部本地数据会同时删除检查点。
          </p>
        </section>
      </div>
      <section className="panel feedback-panel">
        <h2>匿名反馈草稿</h2>
        <p className="muted">
          使用虚构数据描述问题，不填写真实姓名、电话、名单或备份内容。此处仅生成本地文件，不自动发送、不附加活动数据。
        </p>
        <form onSubmit={submit}>
          <label>
            反馈类型
            <select name="category">
              <option>功能问题</option>
              <option>操作体验</option>
              <option>兼容性</option>
              <option>功能建议</option>
            </select>
          </label>
          <label>
            问题或建议
            <textarea name="description" required maxLength={2000} rows={3} />
          </label>
          <label>
            使用虚构数据的复现步骤（可选）
            <textarea name="steps" maxLength={2000} rows={3} />
          </label>
          <label className="check">
            <input name="privacy" type="checkbox" required />
            我已确认不含真实名单、联系方式或其他私人信息
          </label>
          <button className="primary">下载匿名反馈草稿</button>
        </form>
        {message && (
          <p className="success" role="status">
            {message}
          </p>
        )}
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
      </section>
    </>
  );
}
