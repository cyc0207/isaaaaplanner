import { Component } from 'react';
import { logError } from '../lib/errlog.js';

// 某一頁畫面壞掉時，不要整個網站變白：顯示一張卡片，錯誤記下來
export default class ErrorBoundary extends Component {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error, info) {
    logError('畫面', { message: error?.message || String(error), stack: `${error?.stack || ''}\n${info?.componentStack || ''}` }, { show: false });
  }

  componentDidUpdate(prev) {
    // 換到別頁就重來一次
    if (this.state.failed && prev.resetKey !== this.props.resetKey) this.setState({ failed: false });
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div className="page">
        <div className="card crash-card">
          <h2>這頁出了點狀況</h2>
          <p>已經幫你記下來了，資料都還在。可以重新整理，或先去別頁。</p>
          <div className="row gap wrap">
            <button className="btn primary" onClick={() => window.location.reload()}>重新整理</button>
            <a className="btn" href="/">回今天</a>
          </div>
        </div>
      </div>
    );
  }
}
