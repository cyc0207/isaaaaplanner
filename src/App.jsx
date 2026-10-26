import { useEffect, useState } from 'react';
import { Routes, Route, NavLink, Link, Navigate, useLocation } from 'react-router-dom';
import { onAuthStateChanged, signInWithPopup, signInWithRedirect, getRedirectResult } from 'firebase/auth';
import { auth, googleProvider } from './firebase.js';
import { DataProvider, useData } from './data.jsx';
import { getTodayOverride, clearTodayOverride, shortLabel } from './lib/date.js';
import TodayPage from './pages/TodayPage.jsx';
import WeekPage from './pages/WeekPage.jsx';
import MonthPage from './pages/MonthPage.jsx';
import MoneyPage from './pages/MoneyPage.jsx';
import ReconcilePage from './pages/ReconcilePage.jsx';
import MonthClosePage from './pages/MonthClosePage.jsx';
import SettingsPage from './pages/SettingsPage.jsx';
import FoodPage from './pages/FoodPage.jsx';
import TarotPage from './pages/TarotPage.jsx';
import OraclePage from './pages/OraclePage.jsx';
import InboxPage from './pages/InboxPage.jsx';
import EnglishPage from './pages/EnglishPage.jsx';
import StudyPage from './pages/StudyPage.jsx';
import { Icon } from './components/ui.jsx';
import ErrorBoundary from './components/ErrorBoundary.jsx';
import { onErrorShown } from './lib/errlog.js';
import { useNewVersion } from './lib/version.js';
import { inAppBrowser, isAndroid, chromeIntent } from './lib/inapp.js';

export default function App() {
  const [user, setUser] = useState(undefined);
  const [loginError, setLoginError] = useState('');

  useEffect(() => {
    getRedirectResult(auth).catch((e) => setLoginError(e.message));
    return onAuthStateChanged(auth, setUser);
  }, []);

  if (user === undefined) return <div className="splash">載入中…</div>;
  if (!user) return <Login error={loginError} setError={setLoginError} />;

  return (
    <DataProvider uid={user.uid} key={user.uid}>
      <Shell user={user} />
    </DataProvider>
  );
}

function Login({ error, setError }) {
  const app = inAppBrowser();
  const [copied, setCopied] = useState(false);
  const url = window.location.origin + '/';
  const login = async () => {
    setError('');
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (e) {
      if (e.code === 'auth/popup-blocked' || e.code === 'auth/operation-not-supported-in-this-environment') {
        await signInWithRedirect(auth, googleProvider);
      } else if (e.code !== 'auth/popup-closed-by-user' && e.code !== 'auth/cancelled-popup-request') {
        setError(e.message);
      }
    }
  };
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
    } catch {
      window.prompt('複製這個網址，貼到 Safari 或 Chrome：', url);
    }
  };
  return (
    <div className="login">
      <svg className="login-hat" viewBox="0 0 120 64" aria-hidden="true">
        <path d="M4 44c10 10 30 14 56 14s46-4 56-14c-8 2-18 4-28 4H32C22 48 12 46 4 44z" fill="#e8dcc6" stroke="#2a211d" strokeWidth="3" strokeLinejoin="round" />
        <path d="M32 48c-2-14 2-30 10-38 6 4 12 4 18 0 6 4 12 4 18 0 8 8 12 24 10 38z" fill="#e8dcc6" stroke="#2a211d" strokeWidth="3" strokeLinejoin="round" />
        <path d="M33 38h54v8H33z" fill="#4a3024" stroke="#2a211d" strokeWidth="2.5" />
        {[39, 47, 55, 63, 71, 79].map((x) => <circle key={x} cx={x + 1} cy="42" r="2.2" fill="#b9bcc2" stroke="#2a211d" strokeWidth="1" />)}
      </svg>
      <span className="howdy">Howdy, cowgirl</span>
      <h1>今天要做什麼？</h1>
      <p className="muted">打開就知道今天的三件事。</p>
      {app ? (
        <div className="inapp-box">
          <strong>現在是在 {app} 裡面打開的</strong>
          <p>Google 不讓 App 裡的瀏覽器登入。請改用 {isAndroid() ? 'Chrome' : 'Safari'} 打開：</p>
          {isAndroid() ? (
            <a className="btn primary big" href={chromeIntent(url)}>用 Chrome 打開</a>
          ) : (
            <ol>
              <li>按右下角或右上角的「⋯」</li>
              <li>選「用瀏覽器開啟」或「在 Safari 中開啟」</li>
            </ol>
          )}
          <button className="btn big" onClick={copy}>{copied ? '已複製，貼到瀏覽器網址列' : '複製網址'}</button>
        </div>
      ) : (
        <button className="btn primary big" onClick={login}>
          用 Google 登入
        </button>
      )}
      {error && <p className="error">{/missing initial state/i.test(error) ? '登入失敗：這個瀏覽器不能完成 Google 登入，請用 Safari 或 Chrome 打開網址再試一次。' : error}</p>}
    </div>
  );
}

function Shell({ user }) {
  const data = useData();
  const location = useLocation();
  const override = getTodayOverride();
  const [oops, setOops] = useState(null);
  const newErrors = data.errorLog.filter((e) => !e.seen).length;

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [location.pathname]);

  useEffect(() => onErrorShown(setOops), []);
  const problem = data.error || oops;
  const fresh = useNewVersion();

  return (
    <div className="app">
      {override && (
        <div className="test-banner">
          測試日期：{shortLabel(override)}
          <button
            className="link"
            onClick={() => {
              clearTodayOverride();
              window.location.search = '';
            }}
          >
            回到真正的今天
          </button>
        </div>
      )}
      {fresh && (
        <button className="update-banner" onClick={() => window.location.reload()}>
          網站有新版本，點這裡更新
        </button>
      )}
      {problem && (
        <div
          className="error-banner"
          role="alert"
          onClick={() => {
            data.clearError();
            setOops(null);
          }}
        >
          <span>{data.error || '出了點小狀況，已經記下來了。'}</span>
          <span className="small">{data.error ? '' : `（${oops}）`}點一下關閉</span>
        </div>
      )}
      <main className="main">
        {!data.loaded ? (
          <div className="splash">載入資料中…</div>
        ) : (
          <ErrorBoundary resetKey={location.pathname}>
            <Routes>
              <Route path="/" element={<TodayPage />} />
              <Route path="/week" element={<WeekPage />} />
              <Route path="/month" element={<MonthPage />} />
              <Route path="/money" element={<MoneyPage />} />
              <Route path="/money/reconcile" element={<ReconcilePage />} />
              <Route path="/close/:month" element={<MonthClosePage />} />
              <Route path="/settings" element={<SettingsPage user={user} />} />
              <Route path="/food" element={<FoodPage />} />
              <Route path="/tarot" element={<TarotPage />} />
              <Route path="/oracle" element={<OraclePage />} />
              <Route path="/inbox" element={<InboxPage />} />
              <Route path="/english" element={<EnglishPage />} />
              {/* 行事曆提醒的連結：直接打開今天的英文任務 */}
              <Route path="/mission" element={<Navigate to="/english?tab=mission" replace />} />
              <Route path="/study" element={<StudyPage />} />
              <Route path="*" element={<TodayPage />} />
            </Routes>
          </ErrorBoundary>
        )}
      </main>
      <nav className="tabbar">
        <NavLink to="/" end>
          <Icon name="today" />
          今天
        </NavLink>
        <NavLink to="/week">
          <Icon name="week" />週
        </NavLink>
        <NavLink to="/month">
          <Icon name="month" />月
        </NavLink>
        <NavLink to="/money">
          <Icon name="money" />
          記帳
        </NavLink>
        <NavLink to="/inbox">
          <Icon name="inbox" />
          收件匣
        </NavLink>
        <NavLink to="/study" className={location.pathname === '/english' ? 'active' : undefined}>
          <Icon name="english" />
          學習
        </NavLink>
      </nav>
      <Link to={newErrors ? '/settings#errors' : '/settings'} className="gear" aria-label={newErrors ? `設定（${newErrors} 個新錯誤）` : '設定'}>
        <Icon name="gear" />
        {newErrors > 0 && <span className="gear-badge">{newErrors > 9 ? '9+' : newErrors}</span>}
      </Link>
    </div>
  );
}
