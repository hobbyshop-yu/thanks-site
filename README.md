
# iPhone 17 買取ダッシュボード（モバステ自動取得対応）

- 店舗：**買取wiki / 買取ルデヤ / 森森買取 / 海峡通信 / モバステ / モバイルミックス**
- 自動取得：**モバステ（pastec.net）/ 海峡通信（mobile-ichiban.com）/ モバイルミックス**＋既存3店舗

## 使い方
1. GitHubにpush → Pages公開（root配信）
2. Actionsを有効化（毎時実行）
3. うまく取れない場合は `MOBASTE_URL`（例: `https://pastec.net/iphone`）や `MOBILE_MIX_URL` をVariablesに設定

## 備考
- モバステでは「シルバー：-8,000円、ブルー：-9,000円…」「iPhone17 Pro Max 256GB … 205,000円」等の表記を基に、
  **ベース価格 − 色別減額**で色価格を算出します（一般郵送の追加減額は現時点では反映外）。
- 公式サイトの仕様変更で正規表現が外れた場合は、`scripts/update.mjs` 内の `parseMobaste()` を調整してください。
