import { Component, type ReactNode } from "react";
export class ErrorBoundary extends Component<
  { children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? (
      <main>
        <h1>应用未能启动</h1>
        <p role="alert">
          应用文件可能已更新或下载失败。请使用“修复页面加载”获取完整版本；该操作不会删除本机活动。请勿清理站点数据。
        </p>
        <div className="actions">
          <button onClick={() => location.reload()}>重新加载</button>
          <a
            className="button"
            href={
              new URL(`recover.html${location.hash}`, document.baseURI).href
            }
          >
            修复页面加载
          </a>
        </div>
      </main>
    ) : (
      this.props.children
    );
  }
}
