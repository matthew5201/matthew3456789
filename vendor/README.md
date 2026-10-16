# vendor/

第三方程式庫,直接放在 repo 裡,讓網站不依賴外部 CDN,也完全由這個 repo 的內容組成。

## supabase-js.esm.js

- 來源:[`@supabase/supabase-js`](https://www.npmjs.com/package/@supabase/supabase-js) 版本 **2.117.2**(MIT 授權,見 `LICENSE-supabase-js`)。
- 只匯出 `createClient`,打包成單一個 ES module,已壓縮。
- 由 `js/transport-supabase.js` 載入。

### 如何重新產生(要升級版本時)

在 repo 之外的空資料夾執行:

```
npm init -y
npm i @supabase/supabase-js@<版本> esbuild
echo "export { createClient } from '@supabase/supabase-js';" > entry.js
npx esbuild entry.js --bundle --format=esm --minify --platform=browser --target=es2020 --legal-comments=none --outfile=supabase-js.esm.js
```

再把 `supabase-js.esm.js` 複製到這裡覆蓋,並更新上面的版本號。
