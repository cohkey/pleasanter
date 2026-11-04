# レコード更新時のメール通知

レコードの変更内容から通知ルールを評価し、店所・組織に対応する宛先へメールを送るPleasanterのサーバスクリプトです。チャットで作成したコードの初期登録であり、実環境での動作確認は未実施です。

## ファイルと登録方法

- `notification-before-update.js`：対象サイトのサーバスクリプトに、実行条件「更新前」で登録します。
- `notification-after-update.js`：同じ対象サイトに、実行条件「更新後」で別のサーバスクリプトとして登録します。

2本は独立したスクリプトとして登録してください。更新前に `saved` と `model` を比較し、`context.UserData.notificationData` に保存した変更情報を更新後に読み取ります。この引き継ぎが利用環境で機能することを確認してください。

## 通知対象項目

| 論理名 | 物理項目 | 用途 |
| --- | --- | --- |
| status | ClassB | ステータス |
| tenshoCode | ClassD | 店所コード |
| denatsu | ClassF | 電圧 |

物理項目を変更する場合は両スクリプトの定義に加え、更新後スクリプトの店所コード取得・テンプレート値取得も確認してください。

## マスターの構成

更新後スクリプトの `SITE_IDS` はすべて `0` です。利用するマスターのサイトIDを設定してください。

| マスター | 設定キー | 使用項目 |
| --- | --- | --- |
| 通知ルール | rules | ResultId：ルールID、Title：ルール名、CheckA：有効、DescriptionB：件名、DescriptionC：本文 |
| 通知条件 | conditions | ClassA：ルールID、ClassB：条件パターン、ClassC：論理項目名、ClassD：演算子、DescriptionB：比較値 |
| 通知対象 | targets | ClassA：ルールID、ClassB：グループ区分、ClassC：To / Cc / Bcc |
| 組織 | organizations | ClassA：店所コード、ClassC：グループ区分、DescriptionA：組織コード |
| メール通知設定 | mailSettings | DescriptionB：組織コード、ClassZ：通知先ユーザIDのJSON配列、DescriptionA：メールアドレス |

現コードの `rules` キーは未使用です。通知ルールは通知条件のClassAに記録したレコードIDから直接取得し、ResultIdを使用します。

## 条件の判定

- CHANGED：項目が変更された。
- TO：項目が変更され、指定値になった。
- EQ / NE：更新後の値が指定値と等しい / 異なる。
- GE / LE：更新後の値が指定数値以上 / 以下。空欄・数値変換不可は不成立。

同じ条件パターン内はAND、異なるパターン間はORです。各パターンにはCHANGEDまたはTOが必要です。CheckAが有効なルールだけを処理します。

## 宛先とテンプレート

更新後の店所コードとグループ区分から組織コードを取得し、メール通知設定を参照します。ユーザIDは `[User12345]` 形式に変換します。メールアドレスはカンマ・セミコロン・改行で区切れます。

宛先文字列は大文字・小文字を区別せず、To > Cc > Bccの優先順でルール内の重複を排除します。ユーザ指定と直接指定メールの同一人物判定や、複数ルール間の重複排除は行いません。Toは必須です。

件名・本文では `{件名}`、`{店所コード}`、`{ステータス}`、`{電圧}` を更新後の値に置換できます。未定義の置換項目はエラーになります。

## 送信と検証

初期状態は `SEND_ENABLED = false` で、メールを送信しません。ただし条件検索・宛先作成・テンプレート生成は実行します。サイトIDとマスターを設定し、送信無効の状態でログを確認した後、送信を有効にしてください。

通知ルールごとに宛先作成・メッセージ生成・送信エラーを捕捉してログを出します。変更情報のJSON解析とルール取得・条件評価はその例外処理の対象外です。

構文確認：

```sh
node --check notification/notification-before-update.js
node --check notification/notification-after-update.js
```

これらはJavaScriptの構文確認です。Pleasanterの検索API、ユーザ宛先指定、更新前後の引き継ぎ、実メール送信は実環境での検証が必要です。
