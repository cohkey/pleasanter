# サイトパッケージ設定適用ツール

Pleasanter のサイトパッケージ JSON から、対象テーブルの `SiteSettings` を API 経由で反映するためのブラウザ用ユーティリティです。

本番利用で Node.js や外部フレームワークを使わない前提のため、DevTools Console に小さなローダーを貼り付け、ローカルファイル選択ダイアログから JS と JSON を読み込んで実行します。

専用 UI 化の設計は [docs/config-editor-ui-design.md](docs/config-editor-ui-design.md) にまとめています。

MVP 実装として `config-editor-ui.js` を追加しています。サイトパッケージ JSON を読み込み、`Views`、`EditorColumnHash`、`Columns` を画面上で編集し、TSV 入出力、dry-run、適用、適用後比較まで行えます。UI は日本語表示で、読込、編集、確認、適用の流れが見える構成です。エディタタブでは、配置と項目詳細を同じ画面にまとめ、項目キーだけでなく表示名、種別、必須、入力形式、設定メモを同じ行で確認できます。項目詳細は横スクロール表で、`Columns` に存在するキーを漏れなく列として表示します。差分確認では、変更種別、変更場所、変更前、変更後を強調表示します。

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
- `Notifications`
- `Reminders`
- `Exports`
- `Processes`
- `Htmls`
- `ServerScripts`

`Notifications` と `Reminders` は、Pleasanter の画面操作で作成し、標準の「サイトパッケージのエクスポート」から出力した JSON を使う条件で検証しています。手書き JSON や別バージョン由来の JSON は壊れやすいため、通常は dry-run とサイトパッケージ比較を必ず挟んでください。

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

## 専用 UI の使い方

1. Pleasanter にログインします。
2. DevTools Console を開きます。
3. `load-local-js-from-file.js` の中身を Console に貼り付けます。
4. 次を実行し、`config-editor-ui.js` を選択します。

```js
await PleasanterLocalJsLoader.pickAndRun();
```

5. 表示された UI で `Load JSON`、または API キーと Source SiteId を入力して `Fetch Source` を実行します。
6. dry-run / apply まで行う場合は `Load Applier JS` から `apply-site-package-settings.js` を読み込みます。
7. Target SiteId、mode、unsafe 設定を確認し、`Dry-run` を実行します。
8. Diff タブの内容を確認し、問題なければ `Apply` を実行します。

最初の MVP では、画面編集の主対象は `Views`、`EditorColumnHash`、`Columns` です。その他の `SiteSettings` は Raw JSON と dry-run / post-apply compare で確認します。

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
12. 適用予定の `SiteSettings` と再取得した `SiteSettings` を比較し、差分があれば `Post-apply compare` に表示

`Notifications`、`Reminders` などの安全確認が必要な設定が対象に含まれる場合は、dry-run 前に追加確認が出ます。Pleasanter 標準 UI からエクスポートした JSON であることを確認できている場合だけ OK を選んでください。

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

Pleasanter からダウンロードした site-package JSON の `Notifications` / `Reminders` も含めて完全同期する例:

```js
const picked = await PleasanterSitePackageApplier.pickPackageFile();
const dryRun = await PleasanterSitePackageApplier.applySiteSettings(picked.package, {
  apiKey: "YOUR_API_KEY",
  tenantId: 1,
  targetSiteId: 3,
  sections: "all",
  mode: "replace",
  dryRun: true,
  allowUnsafeSections: true
});

console.table(dryRun.plan.operations.map((x) => ({
  type: x.type,
  section: x.section,
  key: x.key,
  reason: x.reason || ""
})));
```

dry-run の削除・更新内容を確認して問題なければ、同じオプションで `dryRun:false` に変更して適用します。`allowUnsafeSections:true` は、Pleasanter から実際にエクスポートした JSON に限定して使ってください。

## 参照値の検証

デフォルトでは、適用前に列参照と一部の選択肢値を検証します。

- `GridColumns`、`EditorColumnHash`、`Views`、`Exports.Columns` などに対象テーブルへ存在しない列名がある場合は、その参照を適用しません。
- `Columns` に対象テーブルへ存在しない `ColumnName` がある場合は、その項目設定を適用しません。
- 分類項目の `ChoicesText` に存在しない値が `DefaultInput` に指定されている場合は、`DefaultInput` だけ適用しません。
- UI の既知プルダウンに存在しない値は適用しません。
- エディタ項目の `FieldCss` は列種別ごとに検証します。Pleasanter の画面で `? field-title` のように表示される値は、`select` の値として存在して見えても不正値として扱います。
- `ControlType:"RTEditor"` の説明項目で `FieldCss` が空、または不正な場合は、画面で `? field-markdown` にならないよう `field-wide` に正規化します。

除外した値は dry-run の `plan.operations` に `type: "skip"` と `reason` 付きで出力します。特殊な列を使う環境では `extraValidColumns` で明示的に許可できます。

```js
await PleasanterSitePackageApplier.applySiteSettings(picked.package, {
  apiKey: "YOUR_API_KEY",
  tenantId: 1,
  targetSiteId: 3,
  sections: "all",
  mode: "replace",
  dryRun: true,
  allowUnsafeSections: true,
  extraValidColumns: ["CustomColumn1"]
});
```

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

適用直後の戻り値にも `postApplyCompare` が入ります。`postApplyCompare.equal` が `false` の場合は、API が保存時に値を正規化したか、適用対象に含まれていない設定が残っています。エディタ項目の並び順も配列として比較するため、同じ項目でも順番が違えば差分になります。

## ブラウザE2E確認メモ

2026-05-28 に次の流れで確認しています。

1. SiteId 1 の管理画面で、エディタ、フィルター、ビュー、通知、リマインダー、プロセス、エクスポート、スクリプト、HTML、サーバスクリプトをブラウザ操作で設定します。
2. Pleasanter 標準 UI の「サイトパッケージのエクスポート」から、通知とリマインダーを含めて JSON をダウンロードします。
3. このツールを DevTools Console で読み込み、SiteId 3 に `mode:"replace"`、`sections:"all"`、`allowUnsafeSections:true` で適用します。
4. SiteId 3 の管理画面で、エディタ、フィルター、ビュー、通知、リマインダー、プロセス、エクスポート、スクリプト、HTML、サーバスクリプトの各タブがアプリケーションエラーなしで開けることを確認します。
5. SiteId 3 もサイトパッケージとして再ダウンロードし、SiteId 1 の `SiteSettings` と比較します。

確認結果は `Views`、`EditorColumnHash`、フィルター系設定、`Notifications`、`Reminders`、`Processes`、`Exports`、`Scripts`、`Htmls`、`ServerScripts` が一致し、差分はありませんでした。SiteId 3 の全エディタ項目詳細ダイアログも開き、存在しない選択肢や `?` 表示がないことを確認しています。

エディタ項目の不正なプルダウン値は、管理画面の全エディタ項目詳細ダイアログを順番に開き、各 `select` の選択済み表示を確認します。選択肢テキストが `?`、`? value`、または `？` を含む場合は、Pleasanter が未知の保存値を表示している状態なので不正です。適用元と適用先の両方でこの確認を行います。

自動テストでは、少なくとも次を実行します。

```text
node --check site-package-settings-applier/apply-site-package-settings.js
node --test site-package-settings-applier/tests/reference-validation.test.mjs
```

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
