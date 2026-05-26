# サイトパッケージ設定適用ツール

Pleasanter のサイトパッケージ JSON から、対象テーブルの `SiteSettings` を API 経由で反映するためのブラウザ用ユーティリティです。

本番利用で Node.js や外部フレームワークを使わない前提のため、DevTools Console に小さなローダーを貼り付け、ローカルファイル選択ダイアログから JS と JSON を読み込んで実行します。

## 対応状況

対応済みの `SiteSettings` 配列:

- `Views`
- `Scripts`
- `ServerScripts`
- `Styles`
- `Htmls`
- `Processes`
- `StatusControls`

実地検証済み:

- `Views`
- `Styles`
- `Scripts`

通知、リマインダー、インポート/エクスポート、アクセス制御などは、サイトパッケージ JSON の形と API 保存後の形を確認してから adapter を追加してください。

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

最初は `merge` を使ってください。

- `merge`: 同じ名前の設定を更新し、存在しない設定を追加します。対象テーブルにしかない設定は残します。
- `replace`: 対象テーブルの設定を JSON 側に合わせます。対象テーブルにしかない設定は削除対象になります。

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

## 注意

ブラウザはローカルファイルパスを文字列指定して勝手に読み込めません。ユーザーがファイル選択ダイアログで選んだファイルだけ読み込めます。

また、Chrome では 1つの JavaScript 実行中に 2回目のファイル選択を自動で開こうとすると、ユーザー操作ではないとしてブロックされることがあります。その場合は、ローダー読み込みと `runWizard()` 実行を分けてください。

Pleasanter が出力するサイトパッケージ JSON には UTF-8 BOM が付く場合があります。このツールでは読み込み時に BOM を除去してから JSON として解析します。
