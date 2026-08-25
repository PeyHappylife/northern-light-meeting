# FSTスライド 引き継ぎメモ（クラウドセッション → ローカルセッション）

## いまの状態
- ブランチ `claude/fst-svg-animation-pxhoja` に、クリック送りの13枚スライド `fst/fst_slides.html` が入っている。
- 公開Artifact: https://claude.ai/code/artifact/c2d325b9-b2d0-442e-99cb-86672f260380
- **本文はクラウド側で新規に書いた仮原稿**。ユーザーの既存FST原稿（下記）は未反映。

## 未反映の既存資料（ローカルにしか無い）
- `~/Downloads/Claude code/fst_slides.html`
- `http://localhost:8791/fst_editor.html`
- Google Slides: https://docs.google.com/presentation/d/1ESBxqjynAfu1bL88PeMeAtkhoiy_Auzc0IHYUjhrEO0/edit
  （Driveコネクタでは "not found"、`docs.google.com` はクラウド側でegress遮断のため未取得）

## 次にやること
1. 既存資料の本文・構成を読む。
2. `fst/fst_slides.html` の各 `<section class="scene">` の `.txt`（見出し／ELi5一行／補足）を既存原稿に差し替える。
   図解SVGは意味が合うものは流用、合わないものは描き直す。
3. 拍番号 `data-b` を振り直す（下記ルール厳守）。
4. 尺を測り直して `MEASURED` を更新する。

## 拍（beat）のルール — 崩さないこと
- 図の要素は**1拍ずつ**。前の拍が出終わってから次を出す（重ねない）。
- **同時に出したい要素は同じ `data-b` にまとめる**。
- 実装: `.beat[data-b="n"]` を番号順にグループ化し、各拍の `Animation.finished` を全部待ってから `GAP_MS`(140ms) 空けて次の拍へ。
- アニメ種別は `data-anim`：`rise`(既定460ms) / `grow`(420ms) / `draw`(640ms・線を引く)。
  `data-dur="800"` で個別に長さ指定可。拍の中の線だけ描画したいときは、その `<line>`/`<polyline>` に `data-anim="draw"`。
- SVGで動かす要素に `transform` 属性を直書きしない（WAAPIのtransformと衝突する）。回転などは内側の `<g transform="...">` に書く。

## 尺
- 各シーンの尺 ＝ **実測した拍の時間 ＋ 読む間2.0秒**（`READ_MS = 2000`）。
- 実測値はソース内の `var MEASURED = [...]`（ミリ秒・拍のみ）。`T`キーで一覧表示。
- 再計測:
  ```
  npm i playwright-core
  node tools/measure-fst.js "$PWD/fst/fst_slides.html" 2
  ```
  出力 `runs` の各シーン最小値を `MEASURED` に貼る。Chromeの場所は `CHROME_PATH=...` で上書き可。
- 現状の実測: 拍 47.6秒 ＋ 読む間 26.0秒 ＝ **合計 73.6秒**（13シーン）。

## 操作
クリック / → / Space で次へ（再生中のクリックは残りの拍を即表示）、← で戻る、`A` 自動再生、`T` 尺一覧、`#5` で5枚目から開始。

## ファイル形式の注意
`fst/fst_slides.html` は **Artifact形式**（`<!doctype>`/`<html>`/`<head>`/`<body>` を書かない、`<title>` から始まる）。
ブラウザで直接開いても動くが、この構造は崩さないこと（同じURLに再公開するため）。
