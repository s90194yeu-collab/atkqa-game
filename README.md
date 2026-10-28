# 關於答對率等於攻擊力這件事

南山高中國文科的答題戰鬥遊戲。比照《Re:縱橫鼎業》的做法：

- **GitHub**（這個儲存庫）：提供遊戲畫面、程式、角色圖與背景音樂。
- **Google Apps Script**：負責學校帳號登入、教師權限與讀寫資料。學生紀錄只存在原本的 Google 試算表，不會出現在這裡。

## 網址

| 用途 | 網址 |
|---|---|
| 入口頁（GitHub） | https://s90194yeu-collab.github.io/atkqa-game/ |
| 遊戲本體（Google） | https://script.google.com/macros/s/AKfycbyVajJNmGKJ9TFqao2yC9aF3XG9ag1cchbFRs3voOOz4XfS8LZ5RA-6QVAw9H3x4Avm/exec |
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
| `index.html` | GitHub 入口頁（開頭的 `GAS_URL` 填 Google 網址） |
| `src/` | 三個畫面的樣板（HTML 結構） |
| `js/game/`、`css/game/` | 遊戲本體，依編號拆成多個檔（見下表） |
| `js/stats.js`、`css/stats.css` | 學習分析 |
| `js/teacher.js`、`css/teacher.css` | 教師後臺 |
| `pages/` | 由建置工具產生的畫面，Apps Script 讀這裡；**不要直接改** |
| `tools/build.py` | 建置工具 |
| `release.json` | 版本清單，`installGitHubFrontend` 用來核對 |
| `assets/img/` | 角色圖（WebP） |
| `assets/bgm/` | 背景音樂（主選單、戰鬥、頭目） |
| `assets/anim/` | 攻擊演出動畫（依角色名稱命名，見該資料夾說明） |
| `assets/manifest.js` | Google Drive 圖檔 ID 與 GitHub 圖檔的對照 |

### 遊戲程式在哪裡改（`js/game/`，依編號順序載入）

| 檔案 | 內容 |
|---|---|
| `01-boot.js` | 啟動診斷（`BOOT_DIAG` 改成 `true` 會把錯誤顯示在畫面上） |
| `02-config.js` | 遊戲設定 `CONFIG`、屬性相剋表 |
| `03-characters.js` | 角色資料 `ALL_CHARACTERS`、六種定位 |
| `04-lore.js` | 角色小傳、招式典故、角色台詞 |
| `05-art.js` | 角色立繪、特色能力演出動畫 |
| `06-spirits.js` | 精神指令 |
| `07-semester.js` | 學期積分、稱號風格、登入資訊 |
| `08-lessons.js` | 課程選單、本機示範題庫 |
| `09-audio.js` | 小工具、音效 |
| `10-bgm.js` | 背景音樂 |
| `11-scenes.js` | 戰場場景插畫 |
| `12-status.js` | 狀態效果、特技與特色能力說明、陣營被動 |
| `13-fx.js` | 畫面特效 |
| `14-state.js` | 遊戲狀態 |
| `15-select.js` | 選角畫面、角色清冊 |
| `16-bank.js` | 題庫載入 |
| `17-battle-setup.js` | 戰鬥：開局、個體差異、生成敵人 |
| `18-battle-answer.js` | 戰鬥：出題與作答 |
| `19-battle-moves.js` | 戰鬥：招式、特色能力、傷害與命中 |
| `20-battle-forms.js` | 戰鬥：換乘與形態 |
| `21-battle-turn.js` | 戰鬥：回合攻防、敵方行動、解析、倒下與復活 |
| `22-save.js` | 回合結算、存檔、臨時存檔 |
| `23-growth.js` | 熟練度、典故卡、成就、全班討伐、錯題道場、每週活動 |
| `24-result.js` | 結算畫面 |
| `25-start.js` | 啟動與按鈕綁定（一定要最後載入） |

樣式 `css/game/` 也依畫面拆開：01 基礎、02 共用元件、03 首頁、04 選角、05 戰鬥、06 全畫面卡片、07 解析與結算、08 清冊與稱號、09 橫向手機、10 成長系統。

這些檔案共用同一組全域變數，載入順序就是檔名編號。新增檔案時取一個不重複的編號放到適當位置；某個函式在載入當下就被呼叫的話，它所在的檔案編號必須比較前面。

## 修改流程

1. 改 `js/`、`css/` 或 `src/` 裡的檔案。
2. 在儲存庫根目錄執行 `python3 tools/build.py`（會重新產生 `pages/` 與 `release.json`，有 Node.js 時順便檢查語法）。
3. 推上 GitHub，等 1～2 分鐘，再到 Apps Script 執行一次 `installGitHubFrontend`。

請不要把 Apps Script 後端檔（Code.gs 等）、試算表資料、教師密碼或任何金鑰放進這個公開儲存庫。

本作品由新北市私立南山高級中學闕宏宇老師設計製作，僅供校內教學、非營利使用，請勿作商業用途。
