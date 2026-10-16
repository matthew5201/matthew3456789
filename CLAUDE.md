# 匿名聊天室

一個不用登入的匿名聊天室,純 HTML/CSS/JS 放在 GitHub Pages,即時傳訊用 Supabase Realtime。

- 開始任何工作前,先讀 `docs/architecture.md`(需求在 `docs/requirements.md`)。
- 目前在**階段二**:已接上 Supabase(`js/transport-supabase.js`)。網址加 `?mock` 可改用本機模擬傳輸,開發與測試用。
- 不可以把金鑰檔案 commit 進 git(`.env`、`.env.*`,以及任何 `secret` / `service_role` key)。
