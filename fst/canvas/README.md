# デザインキャンバスの元ファイル

Claude Design のキャンバス（Artifact）を作るための `.dc.html` 一式。

- `Main / Step1 / Rules / Today.dc.html` ＋ `canvas-d.json`
  → 採用案「D 陽だまり」で組んだ本番スライドの抜粋。キャンバス: FSTスライド 陽だまり
- `DirectionA〜E.dc.html` ＋ `canvas.json`
  → 最初に出した方向性5案（同じ1枚で比較）。キャンバス: FSTスライド 方向性5案

これらは **本番ではない**。本番は `fst/fst_slides.html`。
キャンバス側で色や余白を直したら、その値を `fst/fst_slides.html` のトークンに反映すること。

再構築（要 node）:

```
node "<design skillのbase directory>/seed-canvas.mjs" \
  --template "<同>/payload.template.html" \
  --out fst-slides-hidamari.html --title "FSTスライド 陽だまり" \
  --artboard Main.dc.html --artboard Step1.dc.html \
  --artboard Rules.dc.html --artboard Today.dc.html \
  --canvas canvas-d.json
```
