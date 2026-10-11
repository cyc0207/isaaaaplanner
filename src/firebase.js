import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, connectAuthEmulator } from 'firebase/auth';
import {
  initializeFirestore, persistentLocalCache, persistentMultipleTabManager, connectFirestoreEmulator,
} from 'firebase/firestore';
import { firebaseConfig } from './firebaseConfig.js';

const useEmulator = import.meta.env.VITE_USE_EMULATOR === '1';

const config = { ...firebaseConfig };
if (useEmulator) config.projectId = 'demo-planner';
// 登入流程走網站自己的網域（Vercel 把 /__/auth/ 轉給 Firebase，見 vercel.json），
// 手機 Safari、Chrome 的儲存分區才不會讓重新導向登入失去狀態（missing initial state）
const host = typeof window !== 'undefined' ? window.location.hostname : '';
if (host.endsWith('.web.app') || host.endsWith('.firebaseapp.com') || host.endsWith('.vercel.app')) config.authDomain = host;

export const app = initializeApp(config);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

// 本機快取：離線也能看、寫入立刻反映在畫面上
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
});

if (useEmulator) {
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
  connectFirestoreEmulator(db, '127.0.0.1', 8080);
}

// 模擬器測試用：不用跳出 Google 視窗就能登入（正式版不會有）
if (useEmulator && typeof window !== 'undefined') {
  window.__testSignIn = async (sub = 'test-user', email = 'test@example.com') => {
    const { signInWithCredential } = await import('firebase/auth');
    return signInWithCredential(auth, GoogleAuthProvider.credential(JSON.stringify({ sub, email, email_verified: true })));
  };
}
