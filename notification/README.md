# 写真から転記した通知コード（原本）

`sk-realtime-notification.js` は、提供されたIMG_9877〜IMG_9893（IMG_9880を除く16枚）に写っているコードを順につなぎ、転記したものです。インデントと空行は整えています。処理の改善や前回コードとの統合は行っていません。

## 転記範囲

| 写真 | 主な内容 |
| --- | --- |
| IMG_9877 | SITE_IDS、getNotificationFields / getChangedFields |
| IMG_9878〜9879 | getNotificationRules、getRelatedConditions |
| IMG_9881〜9882 | getNotificationConditions、evaluateCondition |
| IMG_9883 | evaluateConditions |
| IMG_9884〜9885 | getNotificationTargets、getOrganizationCodes |
| IMG_9885〜9886 | MAIL_SETTING_FIELDS、getMailRecipients |
| IMG_9887 | parseNotificationUsers、parseMailAddresses |
| IMG_9888 | createRecipientAddresses、removeDuplicateRecipients |
| IMG_9889〜9893 | sendRealtimeNotification、テンプレート、送信処理 |

写真先頭の1〜2行、および末尾の画面外は確認できません。末尾は関数を閉じて構文が成立する形にしています。写真で確認できない実行呼び出しは追加していません。したがって、このファイル単体では通知処理は実行しません。更新前・更新後それぞれでどのように関数を呼び出すかは、別途元の登録内容との照合が必要です。

## 原本のまま残した点

- 電圧は変更検出・条件判定でClassE、メールテンプレートでClassFを使用。
- TOはmodelの現在値ではなく、保存したchange.newValueと比較。
- CheckAが真偽値trueのルールだけを採用。
- 条件パターン未設定時は「1」。パターン内にCHANGED / TOがあることを評価時に必須とはしていない（候補抽出時はCHANGED / TOを使用）。
- 通知条件検索は843614を直接使用。SITE_IDS.conditions / rulesは定義されているが参照されていない。
- 不正なユーザIDは例外にせず除外。
- getMailRecipientsに未使用のrawValue / convertedValueを取得するループがある。
- 組織コードのログに単一のorganizationCodeではなくorganizationCodesを使用する箇所がある。
- デバッグログとコメントアウトされたログを保持。
- SEND_ENABLEDはfalse。送信は無効。

上記は写真の内容を保持したもので、修正事項として確定したものではありません。この写真転記版を通知コードの正とします。従来の notification-before-update.js / notification-after-update.js は削除し、本ファイルに差し替えています。

## 検証範囲

- node --checkによる構文確認。
- Node.jsのVMとモックによる変更検出、TOの値参照、パターン判定、ユーザID変換、宛先重複排除の確認。
- Pleasanterへの登録、検索API、実メール送信は未検証。

構文確認コマンド：

```sh
node --check notification/sk-realtime-notification.js
```
