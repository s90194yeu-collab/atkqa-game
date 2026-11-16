# 專案說明（給 AI 開發工具：Antigravity、Claude Code、Codex 共用）

「關於答對率等於攻擊力這件事」：南山高中國文科的答題戰鬥遊戲。作者：闕宏宇老師。
回覆、程式註解、commit 訊息、畫面文字一律用**繁體中文**（臺灣用語）。

## 架構

| 部分 | 位置 | 說明 |
|---|---|---|
| 前端（這個儲存庫，公開） | GitHub Pages | 畫面、程式、角色圖、音樂 |
| 後端 | Google Apps Script（**不在這個儲存庫**） | `Code.gs`、`GitHubBridge.gs`、`ArchiveData.gs`、`Duel.gs`；登入、權限、讀寫試算表 |
| 資料 | Google 試算表 | 學生紀錄、題庫（每課一個工作表，由「課程」工作表指定）、角色覆寫 |
| 雙人對戰同步 | Firebase Realtime Database | 規則檔在 `firebase/database.rules.json`，改了要到 Firebase 主控台重新發布 |

Apps Script 讀的是 `pages/` 裡建置好的畫面，`installGitHubFrontend` 依 `release.json` 切換版本。

## 每次開發的流程

1. 開始前先 `git pull`（老師會在不同電腦、不同工具之間輪流開發）。
2. 只改 `src/`、`js/`、`css/`、`assets/`、`tools/`；**不要直接改 `pages/`、`release.json`、`demo.html`、`assets/duel/chars.json`**（都是建置產生的）。
3. 改完執行 `python3 tools/build.py`（會一併執行 `node tools/duel_export.js`）。
4. commit 後一般 push 到 `main`。
5. 提醒老師：等 1～2 分鐘，到 Apps Script 執行 `installGitHubFrontend`。

## 一定要遵守

- **這是公開儲存庫**：不可放入教師密碼、API 金鑰、Firebase 服務帳戶金鑰、學生資料，也不可放入任何 `.gs` 後端檔。
  金鑰只存在 Apps Script 的「指令碼屬性」（`GEMINI_API_KEY`、`FIREBASE_SA`、`QUEWUE_PW`）。
- 不可 force push、不可改寫歷史。
- 隱藏角色「闕闕」（`sp_quewue`）完全不能更動（只在雙人對戰中禁用）。
- 單人遊戲的核心機制不可改變，除非老師明確要求。
- 改後端時，只交付有變動的 `.gs` 檔，並說明要在 Apps Script 做哪些步驟（取代檔案、部署新版本）。
- 不要動老師電腦上與專案無關的檔案（例如 Downloads 裡的其他檔案）。

## 程式在哪裡

- 遊戲本體：`js/game/01～25-*.js`（依編號載入，對照表見 `README.md`），樣式在 `css/game/`。
- 雙人對戰前端：`js/duel/`、`css/game/11-duel.css`；畫面在 `src/game.html` 的 `scr-duel`。
  裁判（勝負、傷害、計分）全部在後端 `Duel.gs`；前端只負責畫面與送出作答／出招。
  角色數值由 `tools/duel_export.js` 從 `js/game/02、03、06、12` 匯出成 `assets/duel/chars.json` 給 `Duel.gs` 使用。
- 展示模式：`js/demo/`、`css/demo.css`，輸出 `demo.html`。
- 學習分析：`js/stats.js`；教師後臺：`js/teacher.js`。

## 題庫工作表格式

A～K 欄：題幹、選項1～6、正解（A／B／AC…）、解析、啟用（0／否＝停用）、題型（A1_形音義…B2_白話文課內理解）。
「課程」工作表 D 欄的題庫工作表名稱必須和分頁名稱**完全相同**（前後不能有空格）。
