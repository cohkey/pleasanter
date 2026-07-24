# Pleasanter SS 権限マスターサンプル

Pleasanter のサーバスクリプト（SS）から参照する権限マスターのサンプルです。
組織単位とユーザ単位の2テーブルを使い、ユーザ個別設定を組織設定より優先します。

このフォルダの SQL はローカル検証用です。Pleasanter のデータベースを直接更新するため、
本番環境へそのまま適用しないでください。

## 権限モデル

### 組織単位

| 列 | 用途 | 値 |
|---|---|---|
| `Title` | 対象組織 | 組織名 |
| `ClassA` | 組織キー | SS が照合する一意キー |
| `CheckA` | 有効 | この設定を利用するか |
| `ClassB` | アプリ利用 | `0` / `1` / `2` |
| `ClassC` | レコード作成 | `0` / `1` / `2` |
| `ClassD` | レコード更新 | `0` / `1` / `2` |
| `ClassE` | レコード削除 | `0` / `1` / `2` |

組織権限の値:

| 値 | 画面表示 | 判定 |
|---|---|---|
| `0` | 許可しない | 全ユーザを拒否 |
| `1` | 通常社員のみ | ユーザIDに `X` を含むユーザを拒否 |
| `2` | 全社員（派遣社員を含む） | 全ユーザを許可 |

### ユーザ単位

| 列 | 用途 | 値 |
|---|---|---|
| `Title` | 対象ユーザ | 表示名 |
| `ClassA` | ユーザキー | SS が照合するユーザID |
| `CheckA` | 有効 | この設定を利用するか |
| `ClassB` | アプリ利用の個別設定 | `0` / `1` / `2` |
| `ClassC` | レコード作成の個別設定 | `0` / `1` / `2` |
| `ClassD` | レコード更新の個別設定 | `0` / `1` / `2` |
| `ClassE` | レコード削除の個別設定 | `0` / `1` / `2` |

ユーザ個別設定の値:

| 値 | 画面表示 | 判定 |
|---|---|---|
| `0` | 組織設定に従う | 対応する組織権限を参照 |
| `1` | このユーザを許可 | 組織設定に関係なく許可 |
| `2` | このユーザを拒否 | 組織設定に関係なく拒否 |

## 判定順

1. 有効なユーザ個別設定を検索します。
2. 対象権限が `1` または `2` なら個別設定を採用します。
3. 個別設定が `0` または存在しない場合は、有効な組織設定を参照します。
4. 組織設定も存在しない場合は拒否します。
5. アプリ利用が拒否の場合、作成・更新・削除も拒否として扱います。

判定処理の例は
[`server-script/permission-resolver.js`](server-script/permission-resolver.js)
を参照してください。

## SQL の適用順

PostgreSQL コンテナ名とデータベース名は環境に合わせて変更してください。

```bash
docker cp sql/01-create-sample-tables.sql postgres:/tmp/01-create-sample-tables.sql
docker cp sql/02-configure-user-overrides.sql postgres:/tmp/02-configure-user-overrides.sql
docker cp sql/03-configure-organization-scopes.sql postgres:/tmp/03-configure-organization-scopes.sql
docker cp sql/04-apply-compact-layout.sql postgres:/tmp/04-apply-compact-layout.sql
```

```bash
docker exec postgres psql -v ON_ERROR_STOP=1 -U postgres \
  -d Implem.Pleasanter -f /tmp/01-create-sample-tables.sql
docker exec postgres psql -v ON_ERROR_STOP=1 -U postgres \
  -d Implem.Pleasanter -f /tmp/02-configure-user-overrides.sql
docker exec postgres psql -v ON_ERROR_STOP=1 -U postgres \
  -d Implem.Pleasanter -f /tmp/03-configure-organization-scopes.sql
docker exec postgres psql -v ON_ERROR_STOP=1 -U postgres \
  -d Implem.Pleasanter -f /tmp/04-apply-compact-layout.sql
```

作成されるテーブル:

- `SS権限管理_組織単位`
- `SS権限管理_ユーザ単位`

SQL はこのタイトルから SiteId を解決します。同名テーブルを複数作成しないでください。

## 画面構成

編集画面は「対象」と「権限設定」の2セクションです。

- 対象組織・組織キー・有効を横配置
- 権限設定を「権限 / 適用範囲」の2列で表示
- 権限表の最大幅は `720px`
- CSV 用の固有ラベルは維持し、表内の重複ラベルだけ非表示
- `body` の `--primaryColor` は `#eb9151`

詳細は [`docs/edit-screen-layout.md`](docs/edit-screen-layout.md) を参照してください。

## 本番利用前の確認

- ユーザIDに `X` を含む条件が派遣社員の判定として常に正しいこと
- `X` の大文字・小文字を区別しないこと
- 組織キーとユーザキーが一意であること
- 同一ユーザに複数の有効な個別設定が存在しないこと
- 権限マスターを参照できない場合は既定で拒否すること
- 対象環境のバックアップを取得していること
