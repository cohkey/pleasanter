# Site Package Config Editor UI Design

Pleasanter の標準管理画面で編集しづらいテーブル設定を、サイトパッケージ JSON を正本として編集、検証、適用するための専用 UI 設計です。

## 目的

- テーブル設定を 1 項目ずつではなく、一覧性のある UI でまとめて編集できるようにする。
- 元テーブルを Pleasanter 画面上で直接いじらなくても、サイトパッケージ JSON を編集して対象テーブルへ適用できるようにする。
- 適用前 dry-run、参照検証、適用後比較を必須フローにして、テーブル設定を壊しにくくする。
- 本番環境では Node.js やビルド済みフレームワークを不要にし、DevTools Console から読み込める純 JavaScript で動かす。

## 非目的

- レコードデータ、添付ファイル本体、サイト/レコード権限、ユーザー/組織マスタの編集は対象外。
- Pleasanter 本体の画面を置き換えるのではなく、管理作業用の補助 UI として動かす。
- 最初から全 `SiteSettings` を高機能フォーム化しない。複雑で壊れやすい設定は raw JSON 表示と比較から始める。

## 実行方式

本番で使う形式は、既存のローダーと同じです。

1. Pleasanter にログインする。
2. 任意の Pleasanter ページで DevTools Console を開く。
3. `load-local-js-from-file.js` を貼り付ける。
4. `config-editor-ui.js` をファイル選択で読み込む。
5. 画面上に専用 UI を表示する。

UI は単一 JS ファイルで、外部ライブラリなし、ビルドなしで動かします。CSS は Shadow DOM か十分に名前空間化したクラスで隔離し、Pleasanter 既存 CSS と衝突しないようにします。

既存の `apply-site-package-settings.js` は適用エンジンとして再利用します。UI は編集体験と確認体験に集中します。

```text
site-package JSON
        |
        v
Config Editor UI
        |
        +--> normalize / validate
        |
        +--> PleasanterSitePackageApplier.planSiteSettings()
        |
        +--> dry-run table
        |
        +--> PleasanterSitePackageApplier.applySiteSettings()
        |
        +--> postApplyCompare
```

## ファイル構成案

```text
site-package-settings-applier/
  apply-site-package-settings.js
  load-local-js-from-file.js
  config-editor-ui.js
  docs/
    config-editor-ui-design.md
  tests/
    reference-validation.test.mjs
    config-editor-model.test.mjs
```

`config-editor-ui.js` は UI と状態管理を含む本番用ファイルです。テストしやすい純粋関数は、将来的に同じファイル内の名前空間 API として公開します。

## 画面構成

全体は業務ツールとして、密度高めの 2 ペイン構成にします。

```text
+--------------------------------------------------------------+
| Toolbar                                                      |
| [Load JSON] [Fetch Current] [Import TSV] [Export JSON]        |
| Target SiteId [ 3 ] Mode [replace] [Dry-run] [Apply]          |
+----------------------+---------------------------------------+
| Section Navigator    | Editor Panel                          |
| - Summary            |                                       |
| - Views              | section-specific grid/form             |
| - Editor Layout      |                                       |
| - Columns            |                                       |
| - Scripts/HTML       |                                       |
| - Notify/Reminder    |                                       |
| - Raw JSON           |                                       |
| - Diff               |                                       |
+----------------------+---------------------------------------+
| Validation / Diff / Apply Log                                |
+--------------------------------------------------------------+
```

### Toolbar

- `Load JSON`: サイトパッケージ JSON を読み込む。
- `Fetch Current`: API で現在開いている、または指定した SiteId の `SiteSettings` を取得する。
- `Import TSV`: Excel からコピーした TSV を一部セクションへ取り込む。
- `Export JSON`: 編集中のサイトパッケージ JSON をダウンロードする。
- `Target SiteId`: 適用先。
- `Mode`: `merge` / `replace`。
- `Dry-run`: 必須。操作差分を表示する。
- `Apply`: dry-run 済み、エラーなし、危険設定確認済みの場合だけ有効化する。

### Section Navigator

各セクションの状態を表示します。

- 未変更
- 変更あり
- 警告あり
- エラーあり
- unsafe セクション

## セクション別 UI

### Summary

- パッケージ名
- 対象サイト名
- `SiteSettings` キー一覧
- 変更数
- エラー数
- unsafe セクション数
- 最終 dry-run 結果
- 最終 `postApplyCompare` 結果

### Views

ビュー一覧を表で編集します。

主な列:

- `Name`
- `DefaultMode`
- `GridColumns`
- `ColumnFilterHash`
- `ColumnSorterHash`
- `KambanGroupBy`
- `CalendarColumn`
- `FiltersDisplayType`
- `AggregationsDisplayType`

操作:

- ビュー作成、複製、削除
- ビュー順の変更
- 表示列の並び替え
- フィルター条件の編集
- ソート条件の編集

フィルターとソートは、最初は構造化フォームと raw JSON の両方を持ちます。Pleasanter の内部表現を完全に隠すと壊れやすいため、保存される JSON を常に確認できるようにします。

### Editor Layout

`EditorColumnHash` を編集します。

表示:

- 左: 利用可能項目
- 右: タブ/見出しごとの配置

操作:

- タブ/見出し追加、名前変更、削除
- 項目の追加、削除
- 項目順の移動
- タブ間移動
- `General` と日本語タブ名の併存を可視化

検証:

- 存在しない列名
- 重複配置
- `Comments` などシステム項目の扱い
- 元/対象の順序差分

### Columns

`Columns` を項目単位で編集します。

一覧列:

- `ColumnName`
- 表示名
- 種別
- 必須
- 読み取り専用
- 既定値
- 選択肢
- 入力検証
- 表示幅
- 説明/ヘルプ
- 変更有無
- エラー

詳細ペイン:

- 基本: `LabelText`, `NoWrap`, `Required`, `ReadOnly`
- 入力: `ControlType`, `ChoicesText`, `DefaultInput`
- 検証: 最大長、正規表現、数値範囲、日付範囲
- 表示: `FieldCss`, `TextAlign`, Markdown/RTE
- 添付: 添付列の制限

安全策:

- `ChoicesText` にない `DefaultInput` はエラー表示。
- `FieldCss` は列種別ごとの許可値だけ選べるようにする。
- Pleasanter 画面で `? value` になる値は保存前にブロックする。

### Scripts / HTML / Server Scripts

最初は一覧と raw editor を中心にします。

- タイトル/名前
- 有効/無効
- 実行位置
- コード本文
- unsafe 表示

適用時は `allowUnsafeSections:true` を要求します。ユーザーが UI 上で明示的に unlock しない限り dry-run に含めません。

### Notifications / Reminders

最初は Pleasanter 標準 UI からエクスポートした JSON の編集を前提にします。

- 一覧表示
- 有効/無効
- 条件の概要
- 宛先の概要
- 件名/本文
- raw JSON

手書きでゼロから作る UI は後回しにします。内部 schema 依存が強いため、まずは既存 JSON の軽微な編集と比較確認に限定します。

### Processes / Exports

実地確認済みの構造をもとにフォーム化します。

Processes:

- 名前
- 条件
- 実行アクション
- ボタン表示
- 状態変更

Exports:

- 名前
- 出力列
- 区切り
- ヘッダー有無
- 文字コード関連

### Raw JSON

すべてのセクションに raw JSON 表示を用意します。

- 整形表示
- コピー
- JSON 構文チェック
- 編集前/編集後の差分

フォーム化していないセクションは raw JSON で編集できるようにしますが、適用前の dry-run と `postApplyCompare` を必須にします。

### Diff

差分は 3 種類を見ます。

- 元 JSON と編集中 JSON
- 編集中 JSON と適用先 SiteSettings
- 適用予定 SiteSettings と適用後再取得 SiteSettings

表示項目:

- section
- operation: create/update/delete/skip
- key
- reason
- before
- after

`EditorColumnHash` と `Views.GridColumns` は順序差分を見やすく表示します。

## Excel / TSV 連携

Excel は正本ではなく、表形式に向く設定の補助編集に使います。

対応しやすいもの:

- `Columns`
- `GridColumns`
- `EditorColumnHash`
- `Views` の基本情報
- `Exports.Columns`

対応しにくいもの:

- `Notifications`
- `Reminders`
- 複雑な `Processes`
- ネストが深い raw settings

TSV の例:

```text
Section	ColumnName	LabelText	Required	ControlType	ChoicesText	DefaultInput	FieldCss
Columns	ClassB	対応区分	true	Normal	10,調査|20,実装	10	field-normal
Columns	DescriptionC	リッチテキスト備考	false	RTEditor			field-wide
```

`ChoicesText` の改行は Excel 取り込み時に扱いづらいため、TSV 上では `|` 区切りにして、取り込み時に `\n` へ変換します。

## 状態モデル

UI 内部では次の状態を持ちます。

```js
{
  sourcePackage,
  sourceSettings,
  workingSettings,
  targetSiteId,
  tenantId,
  mode,
  allowUnsafeSections,
  validation,
  dryRun,
  postApplyCompare,
  dirtySections
}
```

`workingSettings` が唯一の編集対象です。フォームは `workingSettings` を更新し、JSON export と apply は常に `workingSettings` から作ります。

## バリデーション

最低限の必須検証:

- JSON として正しい。
- `SiteSettings` が存在する。
- 列参照が対象テーブルに存在する。
- `DefaultInput` が `ChoicesText` に存在する。
- `FieldCss` が列種別に対して有効。
- enum 値が既知の選択肢に含まれる。
- unsafe セクションが lock されたまま適用されない。
- `postApplyCompare.equal` が false の場合、成功扱いにしない。

ブラウザ画面検証:

- エディタ詳細ダイアログを開いたとき、select の表示が `? value` にならない。
- 通知、リマインダー、プロセス、エクスポートの管理タブでアプリケーションエラーが出ない。

## 適用フロー

```text
Load or Fetch
  -> Edit
  -> Validate
  -> Dry-run
  -> Review operations
  -> Apply
  -> Fetch after apply
  -> postApplyCompare
  -> Optional browser/UI export compare
```

`Apply` ボタンは次の条件を満たすまで無効です。

- JSON 構文エラーなし
- validation error なし
- dry-run 実行済み
- dry-run 後に編集されていない
- unsafe セクションの確認済み

## 段階的な実装計画

### Phase 1: MVP

- `config-editor-ui.js` を追加。
- JSON 読み込み、API 取得、JSON export。
- Summary、Views、Editor Layout、Columns、Diff。
- dry-run と apply。
- `postApplyCompare` 表示。
- TSV import/export は `Columns` と `EditorColumnHash` のみ。

### Phase 2: 運用設定

- Scripts、ServerScripts、Htmls。
- Exports。
- Processes。
- unsafe unlock UI。

### Phase 3: 通知/リマインダー

- Notifications、Reminders の一覧表示。
- 既存 JSON の軽微な編集。
- 管理タブを開けることの E2E 確認。

### Phase 4: 高度な比較とテンプレート

- セクション別テンプレート。
- source/target/export の 3 点比較。
- 設定セットの保存。
- チェックリスト形式の適用レポート。

## テスト方針

単体テスト:

- TSV import/export。
- `EditorColumnHash` の順序差分。
- `Columns` の入力検証。
- unsafe セクションの lock。
- `postApplyCompare` の差分表示。

実地テスト:

- SiteId 1 を source として UI で編集。
- SiteId 3 へ dry-run。
- SiteId 3 へ apply。
- API 比較で `equal:true`。
- Pleasanter 標準 UI で site-package export して `equal:true`。
- 管理画面の主要タブを開いてエラーなし。

## リスク

- Pleasanter のバージョン差で `SiteSettings` の schema が変わる。
- 通知、リマインダー、プロセスは内部 schema 依存が強い。
- API 保存時に Pleasanter が値を正規化し、入力 JSON と完全一致しない可能性がある。
- DevTools Console から読み込む運用は手順が残る。
- 大きい JSON を UI で扱うと操作が重くなる可能性がある。

## 判断

最初に作るべきものは Excel 管理ではなく、Pleasanter 上で動く専用 UI です。JSON を正本にしつつ、表形式が向く部分だけ TSV import/export を提供します。

MVP は `Views`、`EditorColumnHash`、`Columns` に限定します。この 3 つが一番編集頻度が高く、標準 UI のつらさも大きく、既存 applier の検証ロジックも活かしやすいためです。
