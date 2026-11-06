# 通知ログの表示

更新日：2026/11/06

通知IDごとに区切り線を入れ、既存の条件一覧とJSONログを読みやすく並べる。ログ整形のために条件の評価順や短絡評価を変更しない。

## 表示例

以下は、ステータス0000→0100・電圧6kVで、N002に通知対象がない場合の例。

```text
通知候補: N002, N001, N999
----- 通知ID: N002 -----
通知条件: 2件
パターン1 / denatsu / IN / 比較値: 6kV,20kV
パターン1 / status / FROM_TO / 比較値: 0000,0100
{"field":"denatsu","operator":"IN","value":"6kV,20kV","columnName":"ClassE","modelValue":"6kV","hasChange":false}
{"field":"status","operator":"FROM_TO","value":"0000,0100","columnName":"ClassB","modelValue":"0100","changedValue":"0100","hasChange":true}
条件成立: true
通知対象が未設定のためスキップ
----- 通知ID: N001 -----
通知条件: 2件
パターン1 / denatsu / NOT_IN / 比較値: 6kV,20kV
パターン1 / status / FROM_TO / 比較値: 0000,0100
{"field":"denatsu","operator":"NOT_IN","value":"6kV,20kV","columnName":"ClassE","modelValue":"6kV","hasChange":false}
条件成立: false
----- 通知ID: N999（テスト1） -----
通知条件: 3件
パターン1 / denatsu / EQ / 比較値: 6kV
パターン1 / status / TO / 比較値: 0220
パターン2 / status / TO / 比較値: 0300
{"field":"denatsu","operator":"EQ","value":"6kV","columnName":"ClassE","modelValue":"6kV","hasChange":false}
{"field":"status","operator":"TO","value":"0220","columnName":"ClassB","modelValue":"0100","changedValue":"0100","hasChange":true}
{"field":"status","operator":"TO","value":"0300","columnName":"ClassB","modelValue":"0100","changedValue":"0100","hasChange":true}
条件成立: false
----- 通知処理終了 -----
```

先頭のchangedFieldsのJSONログも維持する。上記の候補・条件の並びは例で、実際には既存の取得順・評価順に従う。ログを整えるためのソートは行わない。

条件一覧は取得した全条件を表示するが、JSONは実際に評価した条件だけを表示する。同パターン内で不成立が確定した後や、別パターンで成立が確定した後の未評価条件について、結果を作って表示することはしない。

## 残すもの・整理するもの

| 対象 | 対応 |
| --- | --- |
| changedFieldsと条件評価のJSON | 内容を維持 |
| 候補ルール | 内部IDと名前の重複出力をやめ、表示用通知IDの一覧にまとめる |
| 通知IDと通知名 | ルールの先頭に区切り線付きで表示。通知名が空なら省略 |
| 条件一覧 | パターン・項目・演算子・比較値の間にスペースと区切りを追加 |
| 成立結果 | 同じルールの区切り内にtrue / falseを表示 |
| 通知対象なし | 空配列との二重表示をやめ、スキップ理由を1行で表示 |
| 組織・宛先 | グループ・組織・設定件数を簡潔に表示し、最終To / Cc / Bccと件名・本文を維持 |
| 有効なメールアドレスの個別ログ | 最終宛先と重複するため削除。不正なアドレスだけ記録し、既存の例外を送出 |
| oldValue / newValueの項目ごとのログ | changedFieldsと重複するため削除 |
| records.length / records[0]、record.ClassDの繰り返し | 削除 |
| 宛先解析前後の古いコメントアウトログ | 削除 |

正常にルール処理を終えた場合は終了行を1回出す。例外で中断した場合に終了したように表示しない。引き継ぎデータなし・変更なしで早期終了するケースのためにログを増やさない。

## 検証

- 既存123テストに、画像の3ルールの表示、重複ログ整理、終了・例外時の表示の3テストと空行なしの確認を追加し、127件が成功。
- 変更前のコードとの比較で、通常の28シナリオと画像の3ルールのAPI呼び出し・順番・送信内容・例外が一致。条件評価JSONの内容と順番も一致。
- 通知IDの防御除去と検索値退行を検出するチェックも成功。
- Pleasanter 1.4.23.3 / PostgreSQL 16の専用環境で、複数ルールを実更新。区切り、判定結果、既存JSONの維持、終了行を確認。
- 実更新の検証は既存の専用テストサイト・レコードだけを使い、設定と値を退避してfinallyで復元し、一致も確認。
- SEND_ENABLEDはfalse、OutgoingMailsは0件。ブラウザ画面操作と実メール配送は未実施。

実更新では永続ログ取得のため、検証コピーだけcontext.Logをlogs.LogInfoに置き換えた。通知エンジン自身は空のログや区切り線前の改行を出力しない。メール本文内の改行は維持する。通知エンジン以外のcheckGMUser等のログは変更していない。
