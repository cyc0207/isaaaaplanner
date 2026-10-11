import { useEffect, useState } from 'react';
import { Routes, Route, NavLink, Link, useLocation } from 'react-router-dom';
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
import { Icon } from './components/ui.jsx';

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
  return (
    <div className="login">
      <h1>今天要做什麼？</h1>
      <p className="muted">打開就知道今天的三件事。</p>
      <button className="btn primary big" onClick={login}>
        用 Google 登入
      </button>
      {error && <p className="error">{error}</p>}
    </div>
  );
}

function Shell({ user }) {
  const data = useData();
  const location = useLocation();
  const override = getTodayOverride();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [location.pathname]);

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
      {data.error && (
        <div className="error-banner" onClick={data.clearError}>
          發生錯誤：{data.error}（點一下關閉）
        </div>
      )}
      <main className="main">
        {!data.loaded ? (
          <div className="splash">載入資料中…</div>
        ) : (
          <Routes>
            <Route path="/" element={<TodayPage />} />
            <Route path="/week" element={<WeekPage />} />
            <Route path="/month" element={<MonthPage />} />
            <Route path="/money" element={<MoneyPage />} />
            <Route path="/money/reconcile" element={<ReconcilePage />} />
            <Route path="/close/:month" element={<MonthClosePage />} />
            <Route path="/settings" element={<SettingsPage user={user} />} />
            <Route path="*" element={<TodayPage />} />
          </Routes>
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
      </nav>
      <Link to="/settings" className="gear" aria-label="設定">
        <Icon name="gear" />
      </Link>
    </div>
  );
}
