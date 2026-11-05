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

55件のテストで、正常系、条件分岐、宛先生成、Cc、重複排除、異常系、送信APIの成功・失敗（モック）を確認します。通知IDが異なる条件の混在、誤成立・誤不成立、別ルールの設定エラー混入も回帰テストで確認します。条件検索の形式を変更しているため、写真原本とのAPI呼び出しの完全一致は現行版の検証基準に含めません。

[Dockerでの検証結果](VALIDATION.md)も参照してください。

## FROM_TO：変更前と変更後を指定する条件

通知条件のClassCに対象項目（例：`status`）、ClassDに`FROM_TO`、DescriptionBに`0100,0200`を指定すると、保存した変更情報のoldValueが`0100`、newValueが`0200`の場合だけ成立します。対象項目に実際の変更があることが前提です。

比較値は半角カンマで区切った**2つの空でない値**です。それぞれの前後の空白を除去し、文字列として比較します。先頭ゼロは保持するため、`100,200`と`0100,0200`は異なります。レコード側の値はトリミング・数値変換しません。

| 変更前 | 変更後 | DescriptionB | 成立 |
| --- | --- | --- | --- |
| 0100 | 0200 | 0100,0200 | はい |
| 0100 | 0300 | 0100,0200 | いいえ |
| 0150 | 0200 | 0100,0200 | いいえ |
| 0200 | 0200 | 0100,0200 | いいえ |

FROM_TOはCHANGED・TOと同じ通知候補抽出のトリガーです。同一パターンの電圧NEなどとはAND、異なるパターンとはORで評価します。既存のevaluateConditionsにはパターンごとのトリガー必須チェックがないため、その仕様を維持しています。

空値、カンマ不足・過多、片側の空値（例：`0100`、`0100,`、`,0200`、`0100,0200,0300`）は、FROM_TOの設定エラーとして例外を送出します。候補ルールの条件を評価する際は、AND/ORの短絡評価で不正なFROM_TOが隠れないよう、全FROM_TO条件を先に検証します。既存の条件演算子は変更していません。

[FROM_TO追加時のPleasanter 1.4.23.3検証結果](FROM_TO-VALIDATION.md)

## 通知IDごとの条件分離

通知条件はClassAの親ルールID（通知ルールのResultId）で取得し、そのルール内のClassBでパターンをまとめます。別通知IDのパターン「1」は別の条件群として扱います。

通知IDがリンク選択式の場合にも検索が効くよう、ClassAの検索値はJSON配列文字列、検索方法はExactMatchMultipleを使用します。取得後にもClassAと対象ResultIdを文字列の完全一致で確認し、別ルールの条件を評価へ渡しません。

[条件混在の再現・修正検証](RULE-SCOPE-VALIDATION.md)
