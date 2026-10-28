# 關於答對率等於攻擊力這件事

南山高中國文科的答題戰鬥遊戲。比照《Re:縱橫鼎業》的做法：

- **GitHub**（這個儲存庫）：提供遊戲畫面、程式、角色圖與背景音樂。
- **Google Apps Script**：負責學校帳號登入、教師權限與讀寫資料。學生紀錄只存在原本的 Google 試算表，不會出現在這裡。

## 網址

| 用途 | 網址 |
|---|---|
| 入口頁（GitHub） | https://s90194yeu-collab.github.io/atkqa-game/ |
| 遊戲本體（Google） | 原本的 Apps Script 部署網址 |
| 學習分析 | Google 網址加上 `?page=stats` |
| 教師後臺 | Google 網址加上 `?page=teacher` |

入口頁的「進入遊戲」會連到 Google 網址；要改連結，編輯 `index.html` 開頭的 `GAS_URL`。

## 第一次設定

1. 本儲存庫 **Settings → Pages**：Source 選 **Deploy from a branch**，Branch 選 **main**、資料夾 **/(root)**，按 Save。約 1 分鐘後入口頁就能開啟。
2. 在 Apps Script 專案新增指令碼檔 `GitHubBridge`，並更新 `Code.gs`（這兩個後端檔不放在公開儲存庫，含教師密碼等設定）。
3. 在 Apps Script 編輯器選 `installGitHubFrontend` → 執行（第一次會要求授權「連結外部服務」，請允許）。執行紀錄出現 `"ok": true`、`"enabled": true` 就完成。
4. **部署 → 管理部署作業 → 編輯 → 版本選「新版本」→ 部署**。網址不變。

## 之後更新

1. 更新這個儲存庫的檔案。
2. 等 GitHub Pages 更新完成（約 1～2 分鐘）。
3. 在 Apps Script 執行一次 `installGitHubFrontend`，就會切換到新版本。不用再貼 HTML，也不用重新部署。

## 回到原本的 GAS 畫面

在 Apps Script 執行 `disableGitHubFrontend`。GitHub 暫時讀不到時，也會自動改用專案裡原本的 HTML。學生紀錄都不受影響。

## 檔案位置

| 位置 | 內容 |
|---|---|
| `index.html` | GitHub 入口頁 |
| `pages/` | 畫面空殼（Apps Script 讀取後提供給學生） |
| `js/`、`css/` | 遊戲、學習分析、教師後臺的程式與樣式 |
| `assets/img/` | 角色圖（134 張，WebP） |
| `assets/bgm/` | 背景音樂（主選單、戰鬥、頭目） |
| `assets/anim/` | 攻擊演出動畫（依角色名稱命名，見該資料夾說明） |
| `assets/manifest.js` | Google Drive 圖檔 ID 與 GitHub 圖檔的對照 |
| `release.json` | 版本清單，`installGitHubFrontend` 用來核對 |

請不要把 Apps Script 後端檔（Code.gs 等）、試算表資料、教師密碼或任何金鑰放進這個公開儲存庫。

本作品由新北市私立南山高級中學闕宏宇老師設計製作，僅供校內教學、非營利使用，請勿作商業用途。
