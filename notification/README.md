# レコード更新時のメール通知

`sk-realtime-notification.js` は、提供された16枚の写真から転記したコードを基準に、`sendRealtimeNotification` の処理を関数へ分割したPleasanterのサーバスクリプトです。Ccログの表記を `CC` から `Cc` に統一しています。

## 処理の構成

`sendRealtimeNotification()` は、変更情報を読み、候補ルールの条件を判定し、成立したルールの通知処理を呼び出します。

| 関数 | 役割 |
| --- | --- |
| readNotificationChanges | context.UserDataから変更情報を読む |
| getCandidateNotificationRules | 関連条件から有効な候補ルールを取得する |
| matchesNotificationRule | ルールの条件を取得・評価し、判定を記録する |
| processNotificationRule | 通知対象の有無を確認し、宛先・メール作成と送信を呼び出す |
| getTargetRecipientAddresses | 店所・グループから組織ごとの宛先を解決する |
| createNotificationRecipients | To・Cc・Bccを作成し、重複排除とToの必須チェックを行う |
| renderNotificationTemplate | プレースホルダーを置換する |
| createNotificationMessage | 件名・本文を作成する |
| sendNotification | 送信内容を記録し、送信有効時だけ通知APIを呼ぶ |

## 登録・実行について

ファイルは関数定義のみです。写真に写っていなかった実行呼び出しは追加していません。利用環境の元の登録内容と照合し、更新前に `getNotificationFields()`、更新後に `sendRealtimeNotification()` を呼び出す設定が必要です。Docker検証では、それぞれの実行条件にファイル本体と関数呼び出しを登録しています。

更新前にsavedとmodelから変更情報を取得し、context.UserData.notificationDataで更新後へ渡します。SEND_ENABLEDはfalseで、メール送信は無効のままです。

## マスターと原本から保持した仕様

| 設定 | サイトID |
| --- | --- |
| conditions | 843614 |
| rules | 843610 |
| targets | 843620 |
| organizations | 846822 |
| mailSettings | 809267 |

通知条件の検索では843614を直接指定しています。SITE_IDS.conditions / rulesは定義のみで参照されていません。

- statusはClassB、tenshoCodeはClassD、denatsuはClassEで変更検出・判定します。メールの電圧はClassFです。
- TOは保存したchange.newValueを比較します。CheckAが真偽値trueのルールだけを採用します。
- 同じ条件パターン内はAND、別パターン間はORです。未設定のパターンは「1」です。候補抽出時はCHANGED / TOを使いますが、各パターンにトリガーがあることは評価時に必須としていません。
- 宛先は更新後の店所コードから解決します。To > Cc > Bccの順に、大文字・小文字を区別せず文字列の重複を排除します。
- 不正なユーザIDは除外します。To不足、不正メール、未定義の置換項目などでは例外を送出します。
- ルール単位で例外を捕捉しません。処理中に例外が発生すると後続ルールも中断します。
- 件名・本文では `{件名}`、`{店所コード}`、`{ステータス}`、`{電圧}` が使えます。

## 検証

```sh
node --check notification/sk-realtime-notification.js
node --test notification/test/realtime-notification.test.cjs
```

29件のテストで、正常系、条件分岐、宛先生成、Cc、重複排除、異常系、送信APIの成功・失敗（モック）を確認します。`NOTIFICATION_BASELINE` に原本ファイルのパスを渡すと、28シナリオの結果・ログ・API呼び出し順・例外を原本と比較します（Ccログの表記差を除く）。

[Dockerでの検証結果](VALIDATION.md)も参照してください。
