# 架構文件:匿名聊天室

需求見 `docs/requirements.md`。

## 技術選擇與理由

| 項目 | 選擇 | 理由 |
|---|---|---|
| 前端 | 純 HTML、CSS、JS(ES modules),無建置步驟 | 只有「進入」和「聊天」兩個畫面,用不到框架。GitHub Pages 直接發布。 |
| 即時傳訊 | Supabase Realtime(WebSocket) | 使用者指定。 |
| 訊息 | Realtime **Broadcast** | 即時轉發,不經資料庫,所以天然沒有歷史。 |
| 線上名單 | Realtime **Presence** | 自動追蹤加入、離開、斷線。 |
| 資料庫 | 不使用 | 不保留歷史,不建任何資料表,也不需要 RLS。 |
| 部署 | GitHub Pages,從 `main` 根目錄發布 | 純靜態檔。資源一律用相對路徑,因為網址帶有 repo 子路徑。 |

## 檔案結構

```
index.html                  頁面骨架(進入頁 + 聊天室)
css/style.css
js/main.js                  啟動,決定使用哪個 transport
js/ui.js                    畫面渲染與事件(只碰 DOM)
js/chat.js                  純邏輯:字數、頻率、代號驗證、相對時間、代號顏色
js/transport.js             傳輸介面說明
js/transport-mock.js        階段一:本地模擬
js/transport-supabase.js    階段二:Supabase 實作
js/config.js                Supabase URL 與 publishable key
```

## 關鍵設計:transport 隔離

`ui.js` 與 `chat.js` 不知道訊息從哪來,只認同一組介面:

- `join(nickname)`:加入;代號被占用就拒絕
- `send(text)`、`leave()`
- 事件:`onMessage`、`onPresenceChange`(進出提示由名單差異推出)、`onStatus`(連線狀態)

階段一用 mock,階段二只在 `main.js` 換成 supabase 實作,UI 不必改。

## 資料流(階段二)

- 所有人加入同一個 channel `lobby`。
- 訊息:Broadcast `{nickname, text, ts}`,包含自己都從廣播收到後才渲染。
- 名單:每人 `track({nickname, joinedAt})`;排序依 `joinedAt`。
- 代號唯一:`join` 時先看目前名單,已被使用就拒絕。但新登記的名字要約 2.3 秒(實測)才會傳到其他人那邊,所以登記自己後會再等 3 秒讓名單穩定,然後再檢查一次:同名時最早加入的留下,另一方退出並回到進入頁。這讓「兩人同時搶同一代號」也只有一人成功,代價是進入聊天室要多等約 3 秒。
- 重新整理自動回到聊天室:代號存在 `sessionStorage`,離開時清除。重新整理時伺服器可能還留著舊分頁的殘影,所以代號被占用時會每 1.5 秒重試、最多 8 次,仍不行才退回進入頁。
- 斷線:Presence 會在數秒內自動移出名單。自動重連,頂部顯示狀態。

## 防濫用(前端,可被繞過)

500 字、每秒一則、代號 12 字。訊息用 `textContent` 渲染,不解析 HTML,網址不轉連結。

## Supabase 設定與金鑰

1. 在 supabase.com 建立 Project。不需要建資料表,Realtime 預設開啟,使用公開 channel。
2. 在 Project Settings → API Keys 取得 **Project URL** 與 **publishable key**(舊稱 anon key)。
3. 這兩個值寫在 `js/config.js` 並 commit。這是安全的:publishable key 設計上就是公開的,而我們沒有資料表,匿名使用者能做的只有進 channel 收發。GitHub Pages 是純靜態網站,本來就無法藏金鑰。
4. **絕對不可放進前端或 git:** `secret` key(舊稱 `service_role`)。它有完整管理權限,本專案完全用不到。如果日後需要在本機留存,放在 `.env`(已被 `.gitignore` 忽略),不要放進 `config.js`。
5. 免費方案約 200 個同時連線,足夠小型聊天室。

## 測試

`chat.js` 是純函式,寫單元測試。UI 與 mock 用瀏覽器手動檢查。階段二用兩個分頁加手機實測。

## 階段

1. **階段一:前端。** 用 `/design` 定風格、`/frontend-design` 實作,接 mock,部署到 GitHub Pages。
2. **階段二:接 Supabase(已完成)。** 程式庫用 CDN 載入 `@supabase/supabase-js@2.117.2`。 建立 Project、實作 `transport-supabase.js`、填 `config.js`、重新部署並實測。
