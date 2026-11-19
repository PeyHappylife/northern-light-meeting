# 引き継ぎ書：ノーザンライト申し込みフォーム（peytv.net 移行）

最終更新: 2026-11-19 ／ 対象ブランチ: `main`（確認時 HEAD = `cbabbc5`）

## 1. 現在の状態

| 項目 | 状態 | 確認方法 |
|---|---|---|
| https://peytv.net/meeting（申し込みフォーム） | 公開中・200 OK | 2026-11-19 にアクセス確認 |
| https://peytv.net/meeting/admin（管理画面） | 公開中・200 OK | 同上 |
| 背景動画 /meeting/leadership_honolulu_2027.mp4 | 配信中・200 OK | 同上（repo には入っている版もあり） |
| 公開フォームが使う GAS | `AKfycbwnGJydyJhohPEhfTPQNRDfmMTBzSStfHiJF3iYSQctNLk8k4EPCeMqMov9vXU7O-RxTA` | `?action=getEventsList` が 3 件返す |
| GitHub Pages の転送 | `docs/index.html` → peytv.net/meeting、`docs/admin.html` → peytv.net/meeting/admin | repo 上で確認。**github.io へはこの環境から接続不可のため、実際の転送は未確認** |
| メールテンプレートのリンク（repo の `Claude code/northernlight-form/gas_northernlight.gs`） | peytv.net/meeting に変更済み | repo 上で確認。**GAS 本体への貼り直しは未実施** |

## 2. 重要な注意

- **repo の GAS 用 URL（`AKfycbzORi…`）は 404 で使えません。** 使うのは上の `AKfycbwnGJ…` です。
- `cloudflare/meeting/index.html` と `admin.html` は、公開中の版と同じ内容です（作成者: prestep172、コミット `cbabbc5` ほか）。古い版で上書きしないでください。
- 動画（`leadership_honolulu_2027.mp4`、約 12MB）は repo に入っています。Cloudflare へ再アップロードするときは、動画も `meeting/` 直下に置いてください。
- `main` へは、別アカウント（prestep172）も直接 push しています。push の前に必ず `git pull` / `git fetch` してください（今回、競合が発生しました）。

## 3. スプレッドシート（MTG管理シート）

- ID: `1CdZSj0xJ56mBN7pSHsnqPm2JRlDxXxZCVTIXNC50LbY`
- 申し込みは GAS が直接このシートへ書き込みます（イベント別シート）。
- 現在の申し込み（個人情報は repo に書かない）:
  - `20261124 畑山 健一郎 GAR.W`（11/24）: 3 件（テスト行は削除済み）
  - `20261216 畑山 喜子 GAR.W`（12/16）: 1 件（11/24 の申込者と同一人物の可能性あり。確認が必要）
  - `20270209 岡田薫`（2027/02/09）: 0 件（テスト行は削除済み）

## 4. 完了したこと

1. peytv.net/meeting・/meeting/admin の公開（既に公開されていたものを確認）
2. GitHub Pages の転送先を peytv.net に変更
3. メールリンクを peytv.net/meeting に変更（repo 内のファイル）
4. 受付テスト：1 件登録 → 行が保存され、金額（1,500円）も正しく計算されることを確認 → テスト行を削除
5. 環境の許可ホストに `peytv.net` / `api.cloudflare.com` / `script.google.com` / `script.googleusercontent.com` を追加

## 5. 未完了（次にやること）

1. **GAS 本体の差し替え（最優先）**：公開中の GAS プロジェクト（ID `AKfycbwnGJ…` のデプロイ元）に、`gas_northernlight.gs` の内容を貼り直して再デプロイ。これをしないと、送信されるメールのリンクは古いままです。
2. **GitHub Pages の転送確認**：https://peyhappylife.github.io/northern-light-meeting/ を開き、peytv.net/meeting に飛ぶことを確認。
3. **申し込みテスト**：自分のメールアドレスで 1 件申し込み → 確認メールが届くか、シートに行が入るか確認 → テスト行だけ削除（実際の申し込みは残す）。
4. **山崎優太さんの重複申し込み**（11/24 と 12/16）の扱いを決める。

## 6. この環境の制約（クラウドセッション）

- Cloudflare の API トークンがないため、wrangler でのデプロイは不可（`wrangler whoami` は未認証）。
- Google アカウントの GAS エディタ・clasp 認証がないため、GAS の貼り直しと再デプロイは不可。
- 外部 HTTPS は、上記の許可ホストのみ通ります。github.io は許可していないため、転送の確認は不可。
- **ローカル（Mac）で作業するのが確実です。** `npx wrangler login` と `npx @google/clasp login` はブラウザ認証で完結します。

## 7. ローカル（Mac）で再開する手順

```bash
git pull origin main
cd cloudflare && npx wrangler login
# 公開する場合（既存の Pages プロジェクト名に合わせる）
npx wrangler pages deploy meeting --project-name=<Pages のプロジェクト名>
# GAS: clasp login のあと、本番プロジェクトへ gas_northernlight.gs を反映して再デプロイ
```

※ 動画 `leadership_honolulu_2027.mp4` を消さないよう、Cloudflare 側の既存ファイルを確認してからデプロイしてください。

## 8. テストのルール

- テストは**自分のメールアドレス**で行い、テスト行だけを削除する。
- 実際の申し込み行は消さない。
- テストの後は、必ずシートで削除できたかを確認する。
