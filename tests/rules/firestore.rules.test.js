import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, collection, getDocs } from 'firebase/firestore';

let env;

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-planner',
    firestore: { rules: readFileSync('firestore.rules', 'utf8'), host: '127.0.0.1', port: 8080 },
  });
});
afterAll(() => env.cleanup());
beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled((ctx) => setDoc(doc(ctx.firestore(), 'users/me/expenses/e1'), { amount: 100 }));
});

describe('Firestore 安全規則', () => {
  it('自己可以讀寫自己的資料', async () => {
    const db = env.authenticatedContext('me').firestore();
    await assertSucceeds(getDoc(doc(db, 'users/me/expenses/e1')));
    await assertSucceeds(setDoc(doc(db, 'users/me/tasks/t1'), { title: 'x' }));
  });
  it('另一個帳號讀不到、也寫不進我的資料', async () => {
    const db = env.authenticatedContext('someone-else').firestore();
    await assertFails(getDoc(doc(db, 'users/me/expenses/e1')));
    await assertFails(getDocs(collection(db, 'users/me/expenses')));
    await assertFails(setDoc(doc(db, 'users/me/tasks/t1'), { title: 'x' }));
  });
  it('錯誤庫：口說匯入紀錄只有自己能讀寫', async () => {
    const mine = env.authenticatedContext('me').firestore();
    await assertSucceeds(setDoc(doc(mine, 'users/me/speakImports/imp-x'), { transcript: 'hi' }));
    await assertSucceeds(setDoc(doc(mine, 'users/me/englishItems/err-x'), { bank: 'error', front: 'a' }));
    const other = env.authenticatedContext('someone-else').firestore();
    await assertFails(getDoc(doc(other, 'users/me/speakImports/imp-x')));
    await assertFails(setDoc(doc(other, 'users/me/englishItems/err-x'), { bank: 'error' }));
  });
  it('沒登入全部拒絕', async () => {
    const db = env.unauthenticatedContext().firestore();
    await assertFails(getDoc(doc(db, 'users/me/expenses/e1')));
  });
  it('users/ 以外的路徑全部拒絕', async () => {
    const db = env.authenticatedContext('me').firestore();
    await assertFails(setDoc(doc(db, 'public/x'), { a: 1 }));
  });
});
