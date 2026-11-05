# IN / NOT_INの追加差分と検証結果

実施日：2026/11/05

## 製品コードの変更範囲

- モジュール先頭の変更履歴にIN / NOT_INを追記。
- 共通関数parseMultipleComparisonValuesを追加し、半角カンマで2要素以上・全要素が空でないことを検証。
- evaluateConditionにIN / NOT_INを追加し、modelの現在値を文字列として完全一致で比較。
- evaluateConditionsの事前検証にIN / NOT_INを追加し、短絡評価でも設定エラーが隠れないようにする。

トリガー一覧、既存演算子の分岐、パターン分類とAND/OR、更新前SS、ルール分離、宛先・通知処理は変更していない。

## Node.js

123テストが成功。既存55テストに、新演算子の68テストを追加した。

| 観点 | 確認内容 |
| --- | --- |
| 一致 | 先頭・末尾・3要素以上のリスト |
| 完全一致 | 部分一致、大文字小文字の違い、対象値の末尾空白を一致にしない |
| 比較値の空白 | 各要素だけtrim |
| 先頭ゼロ | 0100と100を区別 |
| 空欄 | 空文字・null・undefinedでIN=false、NOT_IN=true |
| 設定エラー | 空欄・単一値・空要素・不正区切りを例外にする |
| 短絡評価 | ANDが先に不成立、ORが先に成立しても不正設定を検出 |
| トリガー | IN / NOT_INだけでは候補ルールを取得しない |
| パターン | FROM_TOとのAND、異なるパターンとのOR |
| ルール境界 | 別ルールの不正なIN / NOT_INを評価へ持ち込まない |

親IDの防御除去・検索値退行を検出する既存のチェックも成功。

```sh
node --check notification/sk-realtime-notification.js
node --test notification/test/realtime-notification.test.cjs
node notification/test/check-rule-scope-regression.cjs
```

## Pleasanter 1.4.23.3 / PostgreSQL 16

専用Docker環境で実レコードを更新し、SysLogsのAssemblyVersionが1.4.23.3であることを確認。製品コードのコピーに更新前後の呼び出しを追加し、context.Logをlogs.LogInfoに差し替えて記録した。

- IN / NOT_INの26シナリオが成功。
- 両演算子で6kV / 20kV / 60kV / 空欄を確認。
- 比較値の空白除去、先頭ゼロの区別を確認。
- FROM_TOと組み合わせたAND、パターン間OR、単独ではトリガーにしないことを確認。
- 両演算子で空欄・単一値・空要素を含む設定を例外として検出。1.4.23.3のAPI応答はHTTP 500。
- 既存17シナリオとClearScriptの16アサーション、FROM_TOの12シナリオを再実行し成功。
- 自由入力・リンク選択式の両方の親ID列で、画像の複数ルール・6条件の回帰確認を再実行。修正版は各3件、N001だけ成立。

SEND_ENABLEDはfalse、OutgoingMailsは0件。実メール配送とブラウザ操作は未検証。

## 注意する仕様

比較値の検証は候補ルールの評価時に行う。全テーブルの一括設定検証は追加していない。IN / NOT_INだけでは通知の候補にならないが、既存どおり別パターンのトリガーから候補になったルールでは、IN / NOT_INを含む別パターンもOR評価の対象になる。
