# 陳陳的計畫（第一版）

手機優先的個人計畫網站：今天三件事、週曆、月曆、記帳、CSV 匯入匯出。

- 前端：Vite + React
- 登入：Firebase Authentication（Google）
- 資料：Cloud Firestore，全部放在 `users/{uid}/` 底下，規則只允許本人讀寫（`firestore.rules`）
- 部署：Firebase Hosting，Spark 免費方案（不用 Cloud Functions）

## 開發

```bash
npm install
npm run dev                 # 連正式的 Firebase 專案
npm test                    # 計算邏輯的單元測試
npm run test:rules          # 用模擬器測 Firestore 安全規則（需要 Java）
```

本機用模擬器跑整個網站（不碰正式資料）：

```bash
npx firebase emulators:start --only firestore,auth --project demo-planner
VITE_USE_EMULATOR=1 npm run dev
```

## 測試日期

網址後面加 `?today=2026-11-01` 可以假裝今天是那一天（例如測「作 10 月的帳」提醒），頁面上方會出現黃色提示，點「回到真正的今天」取消。

## 部署

**Vercel（目前用的方式）**：Vercel 連到這個 GitHub repo，推到 main 就會自動部署（設定在 `vercel.json`）。Vercel 的網域要加到 Firebase Authentication →「設定」→「授權網域」。Firestore 規則改了要到 Firebase 主控台 → Firestore →「規則」貼上 `firestore.rules` 再發布。

**Firebase Hosting（備用）**：

```bash
npx firebase login
npm run deploy              # 建置後部署 Hosting 和 Firestore 規則
```

## 第二版預留

`expenses` 的 `mealId`、`kcal`、`drink` 欄位名稱保留給第二版；`meals`、`weightLog`、`settings/body`、`budgetChanges`、`inbox` 這幾個集合名稱第一版沒有用。
第一版另外用到的集合：`recurringDone`（每週固定事項打勾）、`allocations`（每月薪資分配紀錄）、`settings/meta`（開始使用的日期）。

## Google 地圖（附近餐廳轉盤）

「吃什麼 → 附近」用 Google Places API (New) 的 Nearby Search。**不要在 Firebase 專案 isaplanner-489f0 開帳單**（那會把 Firebase 升級成 Blaze），請用另一個已經綁好帳單的 Google Cloud 專案：

1. Google Cloud Console 選那個已綁帳單的專案 → 「API 和服務」→「程式庫」→ 啟用 **Places API (New)**。
2. 「憑證」→「建立憑證」→「API 金鑰」。
3. 編輯金鑰：
   - 應用程式限制選「網站」，加入 `https://isaaaaplanner.vercel.app/*`（本機測試再加 `http://localhost:5173/*`）。
   - API 限制選「限制金鑰」，只勾 **Places API (New)**。
4. 「API 和服務」→ Places API (New) →「配額與系統限制」，把 SearchNearby 每天的要求數上限設成 100 左右，超過就停，不會扣款。
5. Vercel → 專案 → Settings → Environment Variables，新增 `VITE_GOOGLE_MAPS_KEY`，值貼金鑰，環境勾 Production → 到 Deployments 對最新一次按 Redeploy。

找店時多拿了價位做價格篩選，這是 Enterprise 等級的欄位，每月有 1,000 次免費（只拿名稱、類型、位置、地址的 Pro 等級是 5,000 次）；輸入街道找地點用的是 Text Search 的 Pro 等級。同一個位置、同一個地址 6 小時內會用手機上的快取，不會重複查，再加上金鑰設的每日上限，自己用不會超過免費額度。
本機開發把金鑰放 `.env.local`（已在 .gitignore）：`VITE_GOOGLE_MAPS_KEY=...`
