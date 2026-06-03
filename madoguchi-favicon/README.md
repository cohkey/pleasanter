# 窓口システム favicon

窓口システム用 favicon の候補画像です。

## 候補

- `madoguchi-e1-window.svg` / `madoguchi-e1-window-32.png` / `madoguchi-e1-window-64.png` / `madoguchi-e1-window-512.png`
  - 受付窓口を表すE-1案です。
- `madoguchi-b-ticket.svg` / `madoguchi-b-ticket-32.png` / `madoguchi-b-ticket-64.png` / `madoguchi-b-ticket-512.png`
  - 受付番号チケットを表すB案です。
- `madoguchi-d-chat-check.svg` / `madoguchi-d-chat-check-32.png` / `madoguchi-d-chat-check-64.png` / `madoguchi-d-chat-check-512.png`
  - 問い合わせ受付と確認済みを表すD案です。

PNGは透明ピクセルを使わず、不透明な正方形画像として作成しています。
一部の環境で透明な角が黒く表示されるのを避けるためです。

## 使い方

faviconとして使う場合は、まず32px PNGを指定します。

```html
<link rel="icon" href="./madoguchi-e1-window-32.png" sizes="32x32" type="image/png">
```

高解像度の元画像や生成AIへの参照には512px PNGを使います。

## 手動保存する場合

ブラウザから右クリックで画像をコピーし、ペイントなどに貼り付けて保存する場合は、
32pxではなく512px PNGを開いてコピーしてください。
小さく表示された画像をコピーすると、低解像度のまま保存されることがあります。

このフォルダのPNGは透明なしの不透明画像なので、透明部分が黒くなる環境でも黒い角が出にくいようにしています。
