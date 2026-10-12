import { createContext, useContext, useEffect, useMemo, useState, useCallback } from 'react';
import {
  collection, doc, onSnapshot, setDoc, updateDoc, deleteDoc, addDoc, getDoc, writeBatch, serverTimestamp,
} from 'firebase/firestore';
import { db } from './firebase.js';
import { seedDocs, v2SeedDocs } from './lib/seed.js';
import { inboxDeadlines } from './lib/inbox.js';
import { today, monthKey } from './lib/date.js';

const COLLECTIONS = [
  'tasks', 'deadlines', 'recurring', 'recurringDone', 'expenses', 'accounts', 'fixedItems', 'fixedPaid',
  'habitLog', 'englishLog', 'energyLog', 'reconcileLog', 'monthClose', 'allocations', 'settings',
  // 第二版
  'meals', 'weightLog', 'budgetChanges', 'inbox',
  'tarotLog', 'placeReviews',
  // Gmail 收進來的信、英文卡片
  'mail', 'englishItems', 'englishJournal',
  // 學習計畫：大目標、月目標、每週目標
  'studyGoals',
];

const DataContext = createContext(null);

export function useData() {
  return useContext(DataContext);
}

async function seedIfNeeded(uid) {
  const meta = await getDoc(doc(db, 'users', uid, 'settings', 'meta'));
  if (meta.exists()) {
    // 第一版的使用者：補上第二版的初始資料（常吃清單範例）
    if ((meta.data().version || 1) >= 2) return;
    const b = writeBatch(db);
    v2SeedDocs().forEach(({ path, data }) => b.set(doc(db, 'users', uid, ...path.split('/')), data));
    b.set(doc(db, 'users', uid, 'settings', 'meta'), { version: 2 }, { merge: true });
    await b.commit();
    return;
  }
  const batch = writeBatch(db);
  const now = Date.now();
  [...seedDocs(today()), ...v2SeedDocs()].forEach(({ path, data }, i) => {
    const extra = path.startsWith('tasks/') ? { createdAt: serverTimestamp(), createdAtMs: now + i } : {};
    batch.set(doc(db, 'users', uid, ...path.split('/')), { ...data, ...extra });
  });
  await batch.commit();
}

export function DataProvider({ uid, children }) {
  const [raw, setRaw] = useState({});
  const [error, setError] = useState(null);

  useEffect(() => {
    setRaw({});
    seedIfNeeded(uid).catch((e) => setError(e.message));
    const unsubs = COLLECTIONS.map((name) =>
      onSnapshot(
        collection(db, 'users', uid, name),
        (snap) => setRaw((r) => ({ ...r, [name]: snap.docs.map((d) => ({ id: d.id, ...d.data() })) })),
        (e) => setError(e.message),
      ),
    );
    return () => unsubs.forEach((u) => u());
  }, [uid]);

  const report = useCallback((e) => {
    console.error(e);
    setError(e.message || String(e));
  }, []);

  const api = useMemo(() => {
    const ref = (path) => doc(db, 'users', uid, ...path.split('/'));
    const col = (name) => collection(db, 'users', uid, name);
    // 不等伺服器回應：本機快取會立刻更新畫面，離線時之後再同步
    return {
      set: (path, data, merge = true) => setDoc(ref(path), data, { merge }).catch(report),
      update: (path, data) => updateDoc(ref(path), data).catch(report),
      remove: (path) => deleteDoc(ref(path)).catch(report),
      add: (name, data) => {
        const d = doc(col(name));
        setDoc(d, { ...data, createdAt: serverTimestamp(), createdAtMs: Date.now() }).catch(report);
        return d.id;
      },
      batch: (ops) => {
        const b = writeBatch(db);
        const ids = [];
        for (const op of ops) {
          if (op.add) {
            const d = op.id ? doc(col(op.add), op.id) : doc(col(op.add));
            ids.push(d.id);
            b.set(d, { ...op.data, createdAt: serverTimestamp(), createdAtMs: Date.now() });
          } else if (op.set) b.set(ref(op.set), op.data, { merge: op.merge ?? true });
          else if (op.remove) b.delete(ref(op.remove));
        }
        b.commit().catch(report);
        return ids;
      },
      addDocRaw: (name, data) => addDoc(col(name), data).catch(report),
    };
  }, [uid, report]);

  const value = useMemo(() => {
    const loaded = COLLECTIONS.every((c) => raw[c]);
    const settings = Object.fromEntries((raw.settings || []).map((s) => [s.id, s]));
    const byId = (name) => Object.fromEntries((raw[name] || []).map((d) => [d.id, d]));
    const accounts = (raw.accounts || []).slice().sort((a, b) => (a.order ?? 99) - (b.order ?? 99) || a.name.localeCompare(b.name));
    const monthClose = byId('monthClose');
    return {
      uid,
      loaded,
      error,
      clearError: () => setError(null),
      api,
      tasks: raw.tasks || [],
      // 行事曆用的期限包含收件匣的截止日；匯入匯出只用自己新增的 ownDeadlines
      deadlines: [...(raw.deadlines || []), ...inboxDeadlines(raw.inbox || [])],
      ownDeadlines: raw.deadlines || [],
      recurring: raw.recurring || [],
      recurringDone: new Set((raw.recurringDone || []).map((d) => d.id)),
      expenses: raw.expenses || [],
      accounts,
      accountsById: Object.fromEntries(accounts.map((a) => [a.id, a])),
      defaultAccount: (accounts.find((a) => a.isDefault) || accounts[0])?.id,
      fixedItems: raw.fixedItems || [],
      fixedPaid: new Set((raw.fixedPaid || []).map((d) => d.id)),
      fixedPaidById: byId('fixedPaid'),
      habitLog: byId('habitLog'),
      englishLog: byId('englishLog'),
      energyLog: byId('energyLog'),
      reconcileLog: (raw.reconcileLog || []).map((d) => d.id),
      monthClose,
      allocations: byId('allocations'),
      budget: settings.budget || {},
      reconcile: settings.reconcile || { cycle: 'weekly', day: 0, shortcuts: [] },
      habits: settings.habits?.items || [],
      meta: settings.meta || {},
      meals: (raw.meals || []).slice().sort((a, b) => (a.createdAtMs || 0) - (b.createdAtMs || 0)),
      mealsById: byId('meals'),
      weightLog: byId('weightLog'),
      tarotLog: byId('tarotLog'),
      placeReviews: byId('placeReviews'),
      budgetChanges: (raw.budgetChanges || []).slice().sort((a, b) => (b.createdAtMs || 0) - (a.createdAtMs || 0)),
      inbox: raw.inbox || [],
      mail: (raw.mail || []).slice().sort((a, b) => (b.ts || 0) - (a.ts || 0)),
      gmail: settings.gmail || {},
      englishItems: raw.englishItems || [],
      studyGoals: raw.studyGoals || [],
      englishJournal: byId('englishJournal'),
      englishSettings: settings.english || {},
      body: settings.body || null,
      dismissed: settings.suggest?.dismissed || {},
      // 已結帳的月份，改紀錄前先確認一次
      confirmClosed: (date) => {
        const m = date && monthKey(date);
        if (!m || !monthClose[m]) return true;
        return window.confirm(`${Number(m.slice(5))} 月已經結帳了，確定要修改這個月的紀錄嗎？`);
      },
    };
  }, [raw, error, api, uid]);

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}
