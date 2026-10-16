# 夜語:匿名聊天室

一個不用登入的匿名聊天室。任何知道網址的人,輸入一個代號就能進入同一間聊天室,電腦和手機都能用。

**線上版:https://matthew5201.github.io/matthew3456789/**

## 功能

- 輸入代號進入,不需要註冊或登入。代號最多 12 字,不可與線上的人重複。
- 即時收發訊息,單則最多 500 字,每人每秒最多一則。訊息一律當純文字顯示。
- 線上名單,有人進來或離開時有提示。
- 不保留歷史訊息,只看得到加入之後的內容。
- 重新整理會直接回到聊天室;按「離開」才會真的離開。
- 電腦版名單常駐右側,手機版收進抽屜。

## 技術

| 項目 | 選擇 |
|---|---|
| 前端 | 純 HTML、CSS、JavaScript(ES modules),沒有框架,沒有建置步驟 |
| 即時傳訊 | Supabase Realtime(WebSocket):訊息用 Broadcast,線上名單用 Presence |
| 資料庫 | 不使用(沒有資料表,因為不保留歷史) |
| 部署 | GitHub Pages,從 `main` 分支的根目錄發布 |

通訊的部分和畫面是分開的:`js/ui.js` 與 `js/chat.js` 不知道訊息從哪裡來,只認 `js/transport.js` 定義的介面。換掉通訊方式時,不需要改畫面。

## 在自己電腦上執行

需要 Node.js 與 Python(只用來開一個本機伺服器)。

```
npm test        # 單元測試(聊天規則)
npm start       # 啟動 http://localhost:5173/
```

網址加 `?mock` 會改用本機模擬的假人,不連 Supabase,開發時很方便:
`http://localhost:5173/?mock`

## 金鑰與安全

`js/config.js` 裡有 Supabase 的 Project URL 和 **publishable key**。這個 key 設計上就是公開的,放在前端程式碼裡是安全的;GitHub Pages 是純靜態網站,本來就無法藏金鑰。

**絕對不要把 `secret` key(舊稱 `service_role`)放進程式或 commit 進 git。** 本專案完全用不到它。`.gitignore` 已排除 `.env` 與 `.env.*`。

## 已知限制

- 代號防重複沒有後端,不是 100% 保證。兩人同時搶同一個代號時,系統會讓最早加入的留下;為此每次進入要多等約 3 秒。
- 防洗版(字數、頻率)只在前端,有心人可以繞過。
- Supabase 免費方案約可同時 200 人連線;專案一週沒有活動會被暫停,需要在 Supabase 後台按 Restore。
- 沒有檢舉、踢人或敏感字過濾。

## 文件

| 檔案 | 內容 |
|---|---|
| `docs/requirements.md` | 需求:使用者會看到什麼、做什麼 |
| `docs/architecture.md` | 技術選擇與理由、檔案結構、資料流、Supabase 設定與金鑰 |
| `docs/design.md` | 視覺風格、色碼、字體、每個畫面的規格 |
| `CLAUDE.md` | 給 AI 協作者的專案說明 |
