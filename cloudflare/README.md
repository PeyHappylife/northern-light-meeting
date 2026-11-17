# peytv.net/meeting 用ファイル

Cloudflare Pages に直接アップロードするためのファイルです。

- `meeting/index.html` → https://peytv.net/meeting
- `meeting/admin.html` → https://peytv.net/meeting/admin
- `meeting/customizer.html` → https://peytv.net/meeting/customizer.html（見た目の調整プレビュー）
- `meeting/leadership_honolulu_2027.mp4` → フォームの背景動画

デプロイ手順（Cloudflare ダッシュボード）:
1. Workers & Pages → Create → Pages → Upload assets（直接アップロード）
2. プロジェクト `northern-light-meeting` に `cloudflare/meeting` フォルダの中身をアップロード
3. Pages の `*.pages.dev` ホストはそのまま使い、`peytv.net` を Pages の Custom domain に設定しない
4. 既存の `peytv-wp` Worker で次のパスだけを Pages へ渡す。他のパスは既存処理を保つ
   - `/meeting` → Pages `/`
   - `/meeting/admin` → Pages `/admin`
   - `/meeting/<asset>` → Pages の同名ファイル（背景動画など）

※ フォームは GAS の API（script.google.com）に通信します。動画などの静的ファイルも Pages へ渡す Worker 経路が必要です。
