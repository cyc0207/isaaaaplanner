# 個人計畫網站：第一版交接（2026-10-11）

給接手的 Claude Code。需求說明是使用者上傳的 `個人計畫網站_需求說明.md`，**只做第一版**，標【第二版】的不要做，但資料結構要預留。

## 現況

- 第一版功能全部寫完，已上線：https://isaaaaplanner.vercel.app/
- 程式碼：私人 repo https://github.com/cyc0207/isaaaaplanner （branch `main`）
- 推到 `main`，Vercel 就會自動部署（設定在 `vercel.json`）
- 還沒有人在真的手機上登入測過（雲端環境連不到 vercel.app）

## 服務設定

| 項目 | 狀態 |
|---|---|
| Firebase 專案 | `isaplanner`（id `isaplanner-489f0`），Spark 免費方案。**不能升級 Blaze、不能用 Cloud Functions** |
| 網頁設定 | 已寫在 `src/firebaseConfig.js`（前端公開設定，不是密碼） |
| Google 登入 | 使用者已在主控台啟用 |
| Firestore | 已建立 (default)，正式版模式 |
| 安全規則 | `firestore.rules`。要在 Firebase 主控台 → Firestore →「規則」貼上並發布（已請使用者做，**請確認**） |
| 授權網域 | `isaaaaplanner.vercel.app` 要加到 Authentication →「設定」→「授權網域」（已請使用者做，**請確認**），否則 Google 登入會失敗 |
| 部署 | Vercel Hobby。原本想用 GitHub Actions 部署到 Firebase Hosting，但使用者帳號的政策 `iam.disableServiceAccountKeyCreation` 不允許建服務帳戶金鑰（不要叫使用者關掉）。`.github/workflows/deploy.yml` 目前只跑測試和建置，沒有金鑰時會跳過部署 |

注意：需求說明裡的規則寫成 `service cloud.firestore.databases`，是錯的，正確是 `service cloud.firestore`（repo 裡已改好）。

## 程式結構

```
src/
  firebase.js          初始化；VITE_USE_EMULATOR=1 時連模擬器，並提供 window.__testSignIn
  firebaseConfig.js    Firebase 網頁設定
  data.jsx             DataProvider：即時監聽 users/{uid}/ 底下所有集合；第一次登入寫入初始資料
  App.jsx              登入、底部四個分頁、右上角齒輪、測試日期提示
  lib/
    date.js            日期工具（YYYY-MM-DD 字串、週一為一週開始、?today= 測試日期）
    budget.js          薪資分配、分類預算、彈性、帳戶餘額、餐費／飲料還剩、記帳分類排序
    plan.js            今天三件事、連續天數、提醒（每週固定、期限、月結、對帳、固定支出）
    csv.js             CSV 解析（BOM、引號、CRLF）、匯入預覽與防重複、輸出 UTF-8 with BOM
    exporters.js       匯出任務／期限／記帳／轉帳與檔名
    seed.js            初始資料（7 個期限、固定事項、2 件第一週任務、預設帳戶與預算）
  pages/               TodayPage, WeekPage, MonthPage, MoneyPage（記一筆、總覽、帳戶、固定支出、薪資分配）,
                       ReconcilePage, MonthClosePage, SettingsPage
  components/          ui.jsx, editors.jsx（任務／期限編輯、固定支出付款）, BalanceCheck.jsx, ImportExport.jsx
tests/                 單元測試（vitest）；tests/rules/ 是安全規則測試；fixtures/ 有 DecorateMe CSV
```

指令：`npm test`（26 個單元測試）、`npm run test:rules`（4 個規則測試，需要 Java 跑模擬器）、`npm run dev`、`npm run build`。

## 資料結構補充

照需求說明第 5 節。另外多用了：

- `tasks.note`、`deadlines.note`、`deadlines.tentative`（暫定日期）、`tasks.createdAtMs`（排序用）
- `recurring.special`：`habit` / `monthClose` / `planWeek` 這三個由程式特別處理，其他是一般每週固定事項
- `recurringDone/{recurringId}_{YYYY-MM-DD}`：每週固定事項打勾紀錄
- `allocations/{YYYY-MM}`：當月已執行薪資分配
- `settings/meta`：`startDate`、`startMonth`（開始使用前的月份不要求月結）
- 固定支出付款的支出 id 固定為 `fixed-{YYYY-MM}_{fixedItemId}`，同一個月重複按也只會有一筆
- 對帳調整記成分類「調整」的收入或支出
- 第二版保留：`expenses.mealId`、`kcal`、`drink`，集合 `meals`、`weightLog`、`settings/body`、`budgetChanges`、`inbox` 都沒用

## 驗收清單狀態（第一版）

在模擬器上用手機尺寸自動跑過（Playwright）並通過的：

- [x] 首頁今天任務不超過 3 件，第 4 件提示「先完成或移到別天」
- [x] 用另一個帳號登入看不到資料（規則測試＋畫面測試）
- [x] 週曆、月曆都看得到期限
- [x] 英文打卡後連續天數增加，中斷一天歸零
- [x] 週日首頁出現「排下週」
- [x] 匯入 DecorateMe CSV 預覽 28 列都正確，再匯入一次全部標成重複
- [x] 匯出任務 CSV 有 BOM，可以再匯入（全部標重複）
- [x] 記帳可匯出指定區間
- [x] 薪資戶轉帳到現金，總支出不變，兩個帳戶餘額正確
- [x] 薪水 30,000、固定支出 3,000 → 定期定額 10,000、生活費 17,000
- [x] 分類預算加總超過生活費時不能儲存
- [x] 午餐超過每餐預算時「今天餐費還剩」正確
- [x] 記一杯飲料，「本週飲料還剩」和進度條同步
- [x] 打勾後「今天完成 x／3」立刻變化
- [x] 每日固定項目隔天變回未勾，連續天數正確
- [x] `?today=2026-11-01` 首頁出現「作 10 月的帳」，11/2 仍顯示，按完成後消失
- [x] 月結頁匯出自動帶上個月區間
- [x] 固定支出按「已付」產生一筆支出，同月不能重複付

要在真的手機／電腦上確認的：

- [ ] 手機新增的任務，電腦重新整理看得到（需要真的兩台裝置）
- [ ] 新增一筆記帳 5 秒內（自動測試通過，要實際手感）
- [ ] 對帳捷徑在手機上能打開 App（使用者要先在設定頁貼上網址）
- [ ] 匯出檔名是中文 `planner_任務_2026-10.csv`：測試用的無頭瀏覽器會把中文檔名變成 `download`，真瀏覽器應該正常，要確認
- [ ] 匯出的 CSV 用 Excel 打開中文正常
- [ ] Google 登入在手機上正常（彈出視窗被擋時會改用重新導向）

## 已知小事

- 打包後的 JS 約 960 KB（Firebase SDK），可以之後再做 code splitting
- 初始的兩件第一週任務放在 10/12（需求說明沒寫哪一天）
- 薪資分配時可選「同時記一筆薪水收入」，預設勾選（這個月還沒記過薪水時）

## 下一步

1. 跟使用者確認規則已發布、授權網域已加、手機能登入
2. 把上面「要確認的」項目跑完
3. 第一版驗收通過且使用者用滿兩週後，才開始第二版
