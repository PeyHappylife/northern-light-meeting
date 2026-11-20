# GAS（ノーザンライト）運用手順：古い内容を戻さないために

## 正本（唯一の正しい場所）
- メールの件名・本文：スプレッドシート「MTG管理シート」の「メール内容」シートだけ。
- 会場の住所・地図リンク：同シートの「会場マスタ」。
- コード：本番GAS（scriptId 14Yj8EyFoakJGEVe8zypAXWDhs_NTaNUkuUFeTJOF6hMNWUgv1jYtZt29）。GitHub のこのフォルダは、本番を反映した控え。

## 守ること
1. 文面（件名・本文）を直すときは、シートを直接直す。コードからシートを上書きしない（installTemplates は 2026-11-20 に削除済み）。
2. コードを直す前に必ず `clasp pull` で本番の最新を取り込み、その上で直す。古いローカルの控えから直さない。
3. 直したら `clasp push` → `clasp deploy -i <既存デプロイID>` → このフォルダの `gas_northernlight.gs` と `gas_venue_images.gs` に反映して GitHub へ。
4. 会場画像は `gas_venue_images.gs`（base64）。会場を足すときは `getVenueImageKey_` にも会場名の判定を足す。

## メールの構成（2026-11-20 時点）
申込情報（イベント名・開催日・時間・会場・ゲスト…）→「追加はこちら」→ご来場の文 → 会場案内画像（タップで Google マップ）。
文字の会場詳細は画像のある会場では出さない。画像が無い会場は会場詳細の文字を出す。
