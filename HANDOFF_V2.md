# 第二版交接（2026-10-11，本機 Claude Code → 雲端 Claude）

分支 `v2-wip`（commit `661e780`）。**是從 `fa915f5` 開出來的，比 main 舊 4 個 commit**（復古風、Y2K 風、打勾特效）。第一件事是把它 rebase 到最新的 main。

## 已經寫好的

照需求說明標【第二版】的部分：

| 功能 | 檔案 |
|---|---|
| 依習慣調整預算（4 週後才出現、中位數、接受才改、略過同週不再出現、彈性不夠不能接受、調整紀錄） | `src/lib/suggest.js`、`src/components/Suggestions.jsx`；出現在週曆「下週」（`/week?w=1` 的排下週面板）和記帳「總覽」 |
| 吃什麼：常吃清單、下一餐建議、轉盤（一餐盤格子大一倍、再轉一次會拿掉上一個、少於 2 個不轉、點轉盤直接看結果） | `src/lib/meals.js`、`src/components/Wheel.jsx`、`src/pages/FoodPage.jsx`（`/food`） |
| 首頁「下一餐吃這個」卡片、本週全糖杯數、今天已記熱量 | `src/pages/TodayPage.jsx` |
| 記帳：常吃的一鍵記、飲料選大小和甜度 | `src/pages/MoneyPage.jsx`（QuickAdd） |
| 體重與熱量目標（Mifflin-St Jeor、不低於基礎代謝、4 週趨勢斜率、每週量一次提醒） | `src/lib/body.js`、`FoodPage.jsx` 的「體重」分頁 |
| 收件匣（比賽／履歷／其他、截止日自動上行事曆、前一天提醒、排下週時決定「考慮中」的） | `src/lib/inbox.js`、`src/pages/InboxPage.jsx`（`/inbox`，第五個分頁） |

資料：`data.jsx` 多監聽 `meals`、`weightLog`、`budgetChanges`、`inbox`；`settings/body`、`settings/suggest`（略過紀錄）。
`deadlines` 現在包含收件匣算出來的期限（`fromInbox: true`，點了會開收件匣）；匯入匯出改用 `ownDeadlines`，不會把收件匣的期限匯出去。
既有使用者：`settings/meta.version` 小於 2 時，登入會補上常吃清單範例（`v2SeedDocs`），再把 version 設成 2。

## 驗證到哪裡

- `npm test`：47 個全過（原本 26 + 新增 21 個，在 `tests/v2.test.js`）
- `vite build` 成功
- **沒有在瀏覽器裡實際看過畫面**：本機 Java 只有 17，模擬器要 21，還沒跑模擬器加 Playwright 的手動流程
- 安全規則沒改（仍是 `users/{uid}/**`），新集合都在底下

## 接手要做的

1. `git rebase origin/main`。`src/styles.css` 一定會衝突：我加了 `--wheel-1`～`--wheel-4` 四個色彩變數（亮暗兩組）、把 `.tabbar` 改成 5 欄、檔案最後加了「/* 第二版 */」一段。新樣式要改成配合 Y2K 風
2. 用模擬器跑一遍需求說明第 9 節【第二版】的驗收項目，特別是轉盤動畫和結果是否對得上指針
3. 看手機寬度下：底部 5 個分頁擠不擠、記帳頁「常吃的」那排橫向捲動、飲料甜度的彈出視窗
4. 通過後合併到 main（Vercel 會自動部署）

## 已知的取捨

- 預算建議只看每天、每週的分類（三餐、飲料）；化妝品、服飾一個月買一次，用週來看沒有意義，所以不建議
- 晚上 9 點後「下一餐」顯示明天早餐；但記帳頁的「常吃的」在 9 點後仍顯示晚餐（晚上記的多半是晚餐）
- 範例餐點的熱量是約略值，畫面標「範例，請改」
