# peytv.net/meeting 用ファイル

Cloudflare Pages に直接アップロードするためのファイルです。

- `meeting/index.html` → https://peytv.net/meeting
- `meeting/admin.html` → https://peytv.net/meeting/admin

デプロイ手順（Cloudflare ダッシュボード）:
1. Workers & Pages → Create → Pages → Upload assets（直接アップロード）
2. プロジェクト名を入力し、`cloudflare/meeting` フォルダごとアップロード
3. 独自ドメイン peytv.net を Custom domain に設定し、パスを `/meeting` で公開
   （または peytv.net の Pages プロジェクトに meeting フォルダを配置）

※ フォームは GAS の API（script.google.com）に通信するため、サーバー側の変更は不要です。
