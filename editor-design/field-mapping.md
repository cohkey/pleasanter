# 項目とDOMの対応表

以下の内部名・IDは共有された設定画像に基づき、登録用スクリプトに反映した割当です。Docker検証テーブルの割当は tests/lab-settings.json を参照してください。既存項目を確認し、editor-layout.js の columns の右辺だけを差し替えてください。表示名では検索しません（同名の連絡記録を取り違えないため）。期限付きテーブルでは接頭辞を Issues に変更します。

|設定キー|配置|項目名|型の提案|登録用内部名|移動する既存DOM|
|---|---|---|---|---|---|
|`title`|概要|タイトル|既存標準|`Title`|`#Results_TitleField`|
|`status`|概要|対応状況|既存標準|`Status`|`#Results_StatusField`|
|`design`|基本情報|設計番号|文字|`DescriptionA`|`#Results_DescriptionAField`|
|`area`|基本情報|エリア|選択|`ClassB`|`#Results_ClassBField`|
|`block`|基本情報|ブロック番号|選択|`ClassC`|`#Results_ClassCField`|
|`customer`|基本情報|お客さま名|文字|`DescriptionC`|`#Results_DescriptionCField`|
|`agent`|基本情報|担当者|文字またはユーザー選択|`DescriptionD`|`#Results_DescriptionDField`|
|`attendance`|基本情報|工事立会|選択|`ClassD`|`#Results_ClassDField`|
|`power`|グリッドサービスG／工事日程|送電日|日付|`DateA`|`#Results_DateAField`|
|`withstand`|グリッドサービスG／工事日程|耐圧試験日|日付|`DateB`|`#Results_DateBField`|
|`period`|グリッドサービスG／工事日程|工事実施予定日（工期）|日付|`DateC`|`#Results_DateCField`|
|`twoWeeks`|グリッドサービスG／工事日程|当社工事日2週間前|日付|`DateD`|`#Results_DateDField`|
|`twoDays`|グリッドサービスG／工事日程|当社工事実施日の2日前|日付|`DateE`|`#Results_DateEField`|
|`customerReceived`|グリッドサービスG／安全処置|お客さまからの受領日|日付|`DateF`|`#Results_DateFField`|
|`checked`|グリッドサービスG／安全処置|記入漏れ不備確認|チェック|`CheckA`|`#Results_CheckAField`|
|`reply`|グリッドサービスG／安全処置|工事監理方への回答日|日付|`DateG`|`#Results_DateGField`|
|`gridReceived`|配電建設G／安全処置|グリッドサービス方からの受領日|日付|`DateH`|`#Results_DateHField`|
|`forwarded`|配電建設G／安全処置|安全措置・工事会社へ回付日|日付|`DateI`|`#Results_DateIField`|
|`fax`|配電建設G／安全処置|工事会社よりFAX受領・グリサへ工事日連絡|日付|`DateJ`|`#Results_DateJField`|
|`workday`|配電建設G／工事日程|工事予定日|日付|`DateK`|`#Results_DateKField`|
|`alternate`|配電建設G／工事日程|第二工事予定日|日付|`DateL`|`#Results_DateLField`|
|`workManager`|工事日の連絡記録|主任技術者へ|長文|`DescriptionE`|`#Results_DescriptionEField`|
|`workContractor`|工事日の連絡記録|電気工事店へ|長文|`DescriptionF`|`#Results_DescriptionFField`|
|`completionManager`|工事完了の連絡記録|主任技術者へ|長文|`DescriptionG`|`#Results_DescriptionGField`|
|`completionContractor`|工事完了の連絡記録|電気工事店へ|長文|`DescriptionH`|`#Results_DescriptionHField`|

入力本体は通常 `#Results_<内部名>`。name、選択肢、required等の属性、子要素一式、アップロードボタンや隠しファイル入力も含めて Field ラッパーを移動します。入力本体の型を変更しません。

タイトル＋対応状況は既存の標準2項目、追加候補は23項目（Class 3、Date 12、Check 1、Description 7）。26項目という制約が**全体の運用上限**でも計25項目で収まります。ただし既存の他項目も含む場合は残枠確認が必要です。標準のA〜Z枠は型ごとにあるため、総数の制約と混同しないでください。使用済みのA等をこの例のために上書きしないでください。

工期を開始日・終了日に分ける場合は日付を1項目追加し計26項目。実環境の既存「工期」が文字列・期間などの場合はその項目を再利用し、型の変更や自動分割は行いません。日付の2週間前・2日前は独立した既存項目を再利用し、自動計算は要件未確定のため追加していません。FAX受領と連絡を別々に記録する場合も追加枠の確認が必要です。

不足時は未使用枠へ必要な型だけ追加します。枠が足りない場合は連絡記録を関連子テーブル化する案、あるいは業務合意の上で長文欄に日時付きでまとめる案を検討します。後者は項目単位の検索・必須チェックを失うため自動実施しません。
