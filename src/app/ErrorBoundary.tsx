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
        <h1>无法加载本地数据</h1>
        <p role="alert">
          应用文件加载失败，或本地存储暂时不可用。可重新加载；反复失败时使用“修复页面加载”。请勿清理站点数据。
        </p>
        <div className="actions">
          <button onClick={() => location.reload()}>重新加载</button>
          <a
            className="button"
            href={new URL("recover.html", document.baseURI).href}
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
