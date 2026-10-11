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

```bash
npx firebase login
npm run deploy              # 建置後部署 Hosting 和 Firestore 規則
```

## 第二版預留

`expenses` 的 `mealId`、`kcal`、`drink` 欄位名稱保留給第二版；`meals`、`weightLog`、`settings/body`、`budgetChanges`、`inbox` 這幾個集合名稱第一版沒有用。
第一版另外用到的集合：`recurringDone`（每週固定事項打勾）、`allocations`（每月薪資分配紀錄）、`settings/meta`（開始使用的日期）。
