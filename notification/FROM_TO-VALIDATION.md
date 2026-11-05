# FROM_TO追加の検証結果

検証日：2026-11-05（日本時間）

## 実装差分

- getRelatedConditionsのトリガーにFROM_TOを追加。
- evaluateConditionで、保存したoldValue / newValueと比較値の2要素を文字列比較。
- parseFromToComparisonでカンマ数、両側の空値、空白を処理。数値変換は行わない。
- evaluateConditionsで全FROM_TOの比較値を事前検証し、AND/ORの短絡評価で設定エラーが隠れないようにする。

現行evaluateConditionsにはパターンごとのトリガー必須判定がありません。その制約を新設すると既存仕様が変わるため追加していません。FROM_TO単独のパターンから通知候補を抽出し、既存のAND/ORで評価できることを検証しています。

更新前SS、既存6演算子、宛先取得、メール生成・送信は変更していません。

## Node.js

51テストが成功しました。既存の28シナリオは写真転記版との処理・ログ・API呼び出し順・例外比較でも一致（既存のCc表記修正を除く）。FROM_TOは指定4ケース、先頭ゼロ、比較値の空白、変更なし、不正な比較値、AND/OR、トリガーから通知生成までを確認しています。

```sh
node --check notification/sk-realtime-notification.js
node --test notification/test/realtime-notification.test.cjs
```

## Pleasanter 1.4.23.3 / PostgreSQL 16

既存の停止中テストDBを読み取り専用で別ボリュームへ複製し、専用の通知マスターとテストレコードを作成しました。元のコンテナ・DBは変更していません。アプリイメージはimplem/pleasanter:1.4.23.3、SysLogsのAssemblyVersionも1.4.23.3であることを確認しました。

原本と同様に実行呼び出しは本体に含まれないため、検証用コピーに更新前・更新後の呼び出しを追加しています。context.Logをlogs.LogInfoに置き換えて永続ログを取得し、APIで実際にレコードを更新しました。

- 既存の17シナリオと、ClearScriptの16アサーションが成功。
- FROM_TOの追加12シナリオが成功。
- 0100→0200だけ成立し、0100→0300、0150→0200、0200→0200は不成立。
- 「 0100 , 0200 」の空白除去と、100→200を0100→0200とは区別することを確認。
- FROM_TOと電圧NEが両方成立する場合のみ通知内容を生成。
- 不正な比較値（空値、区切り不足・過多、片側空値）は設定例外を記録。1.4.23.3のAPIはHTTP 500を返す。
- SEND_ENABLEDはfalse、OutgoingMailsは0件。

検証したソースのSHA-256：e234b59f82f40c2d39141660aeec88a472deb252745eea88c6befc5a312a1bbc

実メール送信、ブラウザ操作、利用先の実マスター・権限では検証していません。
