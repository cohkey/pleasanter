# サイトパッケージ設定適用ツール

Pleasanter のサイトパッケージ JSON から、対象テーブルの `SiteSettings` を API 経由で反映するためのブラウザ用ユーティリティです。

本番利用で Node.js や外部フレームワークを使わない前提のため、DevTools Console に小さなローダーを貼り付け、ローカルファイル選択ダイアログから JS と JSON を読み込んで実行します。

## 対応状況

対応済みの `SiteSettings`:

- `all`
- サイトパッケージ JSON に含まれる任意の `SiteSettings` キー

- `Views`
- `Columns`
- `EditorColumnHash`
- `EditorColumns`
- `GridColumns`
- `Scripts`
- `ServerScripts`
- `Styles`
- `Htmls`
- `Processes`
- `StatusControls`

`Views`、`Columns`、`Scripts` などの既知キーは、名前や `ColumnName` を使って差分を出します。未定義のキーは値をそのままコピーします。

安全のため、次の設定はデフォルトでは変更しません。

- `Notifications`
- `Reminders`
- `Scripts`
- `ServerScripts`
- `Htmls`
- `Processes`
- `StatusControls`
- `Aggregations`

これらは Pleasanter 側の内部 schema や実行タイミングに依存し、推測した値を入れると管理画面のエラーや意図しないスクリプト実行につながります。適用する場合は、実際に Pleasanter からダウンロードした site-package JSON 由来であることを確認したうえで、オプションに `allowUnsafeSections: true` を明示してください。

実地検証済み:

- `Views`
- `Columns`
- `EditorColumnHash`
- `Styles`
- `Scripts`

`Columns` は各項目の詳細設定です。表示名、選択肢、必須、最大文字数、入力検証、数値範囲、日付形式、Markdown/RTE、添付ファイル制限などを `ColumnName` 単位でマージします。

`EditorColumnHash` はエディタ画面の項目配置です。`General` などのキーがタブ/見出し、値の配列が配置する列名です。基本項目、分類項目、数値項目、日付項目、説明項目、チェック項目、添付項目を同じ仕組みで扱えます。

Pleasanter のバージョンによっては `updatesite` API が `EditorColumnHash` を保存対象にしない場合があります。その場合は対象テーブルの「テーブルの管理」画面を開き、Console で次のように実行してください。現在開いている画面のエディタ項目一覧を更新し、画面の「更新」と同じ経路で保存します。

```js
const picked = await PleasanterSitePackageApplier.pickPackageFile();
await PleasanterSitePackageApplier.applyEditorColumnsInCurrentPage(picked.package, {
  dryRun: false,
  save: true
});
```

通知、リマインダー、インポート/エクスポートなども、サイトパッケージ JSON の `SiteSettings` に含まれていれば `all` で適用対象になります。ただし、レコードデータ、権限、添付ファイル本体など、`SiteSettings` の外側にあるサイトパッケージ要素はこのツールの対象外です。

## 使い方

1. Pleasanter にログインします。
2. 対象テーブル、または同じ Pleasanter 内の任意ページを開きます。
3. DevTools Console を開きます。
4. `load-local-js-from-file.js` の中身を Console に貼り付けます。
5. 次を実行します。

```js
await PleasanterLocalJsLoader.pickAndRun();
```

6. ファイル選択ダイアログで `apply-site-package-settings.js` を選択します。
7. 次を実行します。

```js
await PleasanterSitePackageApplier.runWizard();
```

8. ウィザードに従って、サイトパッケージ JSON、TenantId、SiteId、API キー、対象設定、適用モードを指定します。

## ウィザードで行うこと

`runWizard()` は次を順番に実行します。

1. サイトパッケージ JSON を選択
2. TenantId を入力
3. 適用先 SiteId を入力
4. API キーを入力
5. 対象設定を選択
6. `merge` / `replace` を選択
7. dry-run を実行
8. dry-run 結果を `console.table` に表示
9. 適用してよいか確認
10. OK なら API で適用
11. 再取得して反映結果を確認

## mode

最初は `merge` で dry-run し、完全同期したい場合は `replace` を使ってください。

- `merge`: 同じ名前の設定を更新し、存在しない設定を追加します。対象テーブルにしかない設定は残します。
- `replace`: 対象テーブルの設定を JSON 側に合わせます。対象テーブルにしかない設定は削除対象になります。

完全にサイトパッケージへ合わせる例:

```js
const picked = await PleasanterSitePackageApplier.pickPackageFile();
await PleasanterSitePackageApplier.applySiteSettings(picked.package, {
  apiKey: "YOUR_API_KEY",
  tenantId: 1,
  targetSiteId: 3,
  sections: "all",
  mode: "replace",
  dryRun: true
});
```

dry-run の内容に問題がなければ `dryRun:false` に変更して適用します。

## 適用後の確認

一番確実なのは、適用元テーブルと適用先テーブルのサイトパッケージ JSON をダウンロードして比較する方法です。

1. 適用元テーブルのサイトパッケージ JSON をダウンロードします。
2. 適用先テーブルのサイトパッケージ JSON をダウンロードします。
3. DevTools Console で `apply-site-package-settings.js` を読み込みます。
4. 2つの JSON を読み込んで次を実行します。

```js
const source = await PleasanterSitePackageApplier.pickPackageFile();
const target = await PleasanterSitePackageApplier.pickPackageFile();
const diff = PleasanterSitePackageApplier.compareSitePackages(source.package, target.package, {
  sections: "all"
});
console.log(diff.equal);
console.table(diff.differences.map(x => ({
  type: x.type,
  section: x.section
})));
```

`diff.equal` が `true` なら、比較対象の `SiteSettings` は一致しています。`false` の場合は `differences` の `section` を見て、どの設定が違うか確認してください。

## API

内部では Pleasanter API を使います。

```text
POST /api/items/{siteId}/getsite
POST /api/items/{siteId}/get
POST /api/items/{siteId}/updatesite
```

ビュー設定は `updatesitesettings` ではなく、`updatesite` に `SiteSettings` 全体を含めて更新します。

## サンプル

ビューだけ:

```text
samples/site-package.views.sample.json
```

ビュー、スタイル、スクリプト:

```text
samples/site-package.multi-settings.sample.json
```

エディタ項目配置と項目詳細設定:

```text
samples/site-package.editor-columns.sample.json
```

広めの `SiteSettings` を含む総合サンプル:

```text
samples/site-package.comprehensive-settings.sample.json
```

この総合サンプルには、項目詳細設定、エディタ配置、グリッド列、複数ビュー、スタイルを含めています。ローカル Pleasanter の `updatesite` で実適用し、`getsite` で再取得できた設定だけを残した API-safe なサンプルです。

`Processes`、`StatusControls`、`Aggregations` などは Pleasanter の `updatesite` API が内部 schema に厳しく、推測した項目構造を入れると HTML エラーページへリダイレクトされることがあります。実際の site-package JSON から取得した構造が確認できるまでは、総合サンプルには含めない方針です。

`Views`、`Columns`、`Scripts` などの既知キーは名前や `ColumnName` で差分を出し、それ以外のキーは `SiteSettings` の値をそのままコピーする想定の確認に使います。実環境の Pleasanter バージョンによって保存されない raw キーがある可能性があるため、適用後は「適用元/適用先のサイトパッケージ JSON 比較」で確認してください。

## 注意

ブラウザはローカルファイルパスを文字列指定して勝手に読み込めません。ユーザーがファイル選択ダイアログで選んだファイルだけ読み込めます。

また、Chrome では 1つの JavaScript 実行中に 2回目のファイル選択を自動で開こうとすると、ユーザー操作ではないとしてブロックされることがあります。その場合は、ローダー読み込みと `runWizard()` 実行を分けてください。

Pleasanter が出力するサイトパッケージ JSON には UTF-8 BOM が付く場合があります。このツールでは読み込み時に BOM を除去してから JSON として解析します。
