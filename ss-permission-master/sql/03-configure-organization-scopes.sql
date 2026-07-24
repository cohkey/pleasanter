DO $$
DECLARE
  layout_css text := $css$
.permission-target-grid,
.permission-matrix {
  width: 100%;
  margin: 8px 0 20px;
}

.permission-target-grid {
  display: grid;
  grid-template-columns: minmax(260px, 2fr) minmax(220px, 1.4fr) minmax(140px, .7fr);
  gap: 12px;
}

.permission-target-grid > [id$="Field"] {
  min-width: 0;
  margin: 0 !important;
  padding: 12px 14px !important;
  border: 1px solid #cfd7e3;
  border-radius: 6px;
  background: #fff;
}

.permission-target-grid .permission-enabled {
  background: #f1f8f4 !important;
  border-color: #bad8c7;
}

.permission-matrix {
  display: grid;
  grid-template-columns: minmax(170px, .8fr) minmax(320px, 1.7fr);
  overflow: hidden;
  border: 1px solid #c8d2df;
  border-radius: 6px;
  background: #fff;
}

.permission-matrix__corner,
.permission-matrix__header,
.permission-matrix__row-label,
.permission-matrix__cell {
  min-width: 0;
  border-right: 1px solid #dce3eb;
  border-bottom: 1px solid #dce3eb;
}

.permission-matrix > :nth-child(2n) {
  border-right: 0;
}

.permission-matrix > :nth-last-child(-n + 2) {
  border-bottom: 0;
}

.permission-matrix__corner,
.permission-matrix__header {
  padding: 10px 14px;
  background: #eaf2f8;
  color: #163b57;
  font-weight: 700;
}

.permission-matrix__header {
  text-align: center;
}

.permission-matrix__row-label {
  display: flex;
  align-items: center;
  padding: 12px 14px;
  background: #f7f9fc;
  color: #243447;
  font-weight: 700;
}

.permission-matrix__cell {
  display: flex;
  align-items: center;
  min-height: 62px;
  padding: 8px 12px;
  background: #fff;
}

.permission-matrix__cell > [id$="Field"] {
  width: 100%;
  margin: 0 !important;
  padding: 0 !important;
  border: 0 !important;
  background: transparent !important;
}

.permission-matrix__cell select {
  width: 100%;
  min-width: 260px;
}

.permission-matrix__cell label,
.permission-target-grid label {
  font-weight: 600;
}

@media (max-width: 760px) {
  .permission-target-grid {
    grid-template-columns: 1fr;
  }

  .permission-matrix {
    grid-template-columns: minmax(125px, .75fr) minmax(250px, 1.5fr);
    overflow-x: auto;
  }
}
$css$;
  layout_script text := $js$
(function () {
  function ready(fn) {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", fn, { once: true });
    } else {
      fn();
    }
  }

  function field(columnName) {
    return document.getElementById("Results_" + columnName + "Field");
  }

  function move(parent, child) {
    if (child && child.parentElement !== parent) parent.appendChild(child);
  }

  function cell(className, text) {
    var element = document.createElement("div");
    element.className = className;
    if (text) element.textContent = text;
    return element;
  }

  function buildTarget() {
    if (document.querySelector(".permission-target-grid")) return;
    var title = field("Title");
    var key = field("ClassA");
    var enabled = field("CheckA");
    if (!title || !key || !enabled) return;

    var grid = document.createElement("div");
    grid.className = "permission-target-grid";
    title.parentNode.insertBefore(grid, title);
    move(grid, title);
    move(grid, key);
    move(grid, enabled);
  }

  function buildMatrix() {
    if (document.querySelector(".permission-matrix")) return;

    var rows = [
      { label: "アプリ利用", column: "ClassB" },
      { label: "レコード作成", column: "ClassC" },
      { label: "レコード更新", column: "ClassD" },
      { label: "レコード削除", column: "ClassE" }
    ];
    var first = field(rows[0].column);
    if (!first) return;

    var matrix = document.createElement("div");
    matrix.className = "permission-matrix";
    matrix.appendChild(cell("permission-matrix__corner", "権限"));
    matrix.appendChild(cell("permission-matrix__header", "適用範囲"));
    first.parentNode.insertBefore(matrix, first);

    rows.forEach(function (row) {
      var scopeField = field(row.column);
      if (!scopeField) return;
      var scopeCell = cell("permission-matrix__cell");
      matrix.appendChild(cell("permission-matrix__row-label", row.label));
      matrix.appendChild(scopeCell);
      move(scopeCell, scopeField);
    });
  }

  ready(function () {
    buildTarget();
    buildMatrix();
    setTimeout(function () {
      buildTarget();
      buildMatrix();
    }, 250);
  });
})();
$js$;
  settings jsonb;
  columns jsonb;
  class_template jsonb;
  column_name text;
  column_label text;
  org_site_id bigint;
BEGIN
  SELECT "SiteId"
    INTO org_site_id
    FROM "Implem.Pleasanter"."Sites"
   WHERE "Title" = 'SS権限管理_組織単位'
   ORDER BY "UpdatedTime" DESC
   LIMIT 1;

  IF org_site_id IS NULL THEN
    RAISE EXCEPTION 'Run 01-create-sample-tables.sql before this script.';
  END IF;

  SELECT "SiteSettings"::jsonb
    INTO settings
    FROM "Implem.Pleasanter"."Sites"
   WHERE "SiteId" = org_site_id;

  SELECT col
    INTO class_template
    FROM jsonb_array_elements(settings->'Columns') AS col
   WHERE col->>'ColumnName' = 'ClassA';

  SELECT jsonb_agg(
    CASE col->>'ColumnName'
      WHEN 'Title' THEN col || jsonb_build_object(
        'LabelText', '対象組織',
        'GridLabelText', '対象組織',
        'InputGuide', '権限を設定する組織を入力します。',
        'ValidateRequired', true,
        'NoDuplication', true,
        'FieldCss', 'permission-target')
      WHEN 'ClassA' THEN col || jsonb_build_object(
        'LabelText', '組織キー',
        'GridLabelText', '組織キー',
        'InputGuide', 'SSが組織を特定するための一意なキーです。',
        'ValidateRequired', true,
        'NoDuplication', true,
        'FieldCss', 'permission-target')
      WHEN 'CheckA' THEN col || jsonb_build_object(
        'LabelText', '有効',
        'GridLabelText', '有効',
        'DefaultInput', 'true',
        'FieldCss', 'permission-enabled')
      WHEN 'ClassB' THEN col || jsonb_build_object(
        'LabelText', 'アプリ利用：適用範囲',
        'GridLabelText', 'アプリ利用：適用範囲',
        'ChoicesText', E'0,許可しない\n1,XID（派遣社員）を除外\n2,全ID（XIDを含む）',
        'DefaultInput', '0',
        'ValidateRequired', true,
        'NoDuplication', false,
        'FieldCss', 'permission-scope')
      WHEN 'ClassC' THEN col || jsonb_build_object(
        'LabelText', 'レコード作成：適用範囲',
        'GridLabelText', 'レコード作成：適用範囲',
        'ChoicesText', E'0,許可しない\n1,XID（派遣社員）を除外\n2,全ID（XIDを含む）',
        'DefaultInput', '0',
        'ValidateRequired', true,
        'NoDuplication', false,
        'FieldCss', 'permission-scope')
      WHEN 'ClassD' THEN col || jsonb_build_object(
        'LabelText', 'レコード更新：適用範囲',
        'GridLabelText', 'レコード更新：適用範囲',
        'ChoicesText', E'0,許可しない\n1,XID（派遣社員）を除外\n2,全ID（XIDを含む）',
        'DefaultInput', '0',
        'ValidateRequired', true,
        'NoDuplication', false,
        'FieldCss', 'permission-scope')
      WHEN 'ClassE' THEN col || jsonb_build_object(
        'LabelText', 'レコード削除：適用範囲',
        'GridLabelText', 'レコード削除：適用範囲',
        'ChoicesText', E'0,許可しない\n1,XID（派遣社員）を除外\n2,全ID（XIDを含む）',
        'DefaultInput', '0',
        'ValidateRequired', true,
        'NoDuplication', false,
        'FieldCss', 'permission-scope')
      ELSE col
    END
  ) INTO columns
  FROM jsonb_array_elements(settings->'Columns') AS col
  WHERE col->>'ColumnName' NOT IN (
    'CheckB', 'CheckC', 'CheckD', 'CheckE', 'CheckF', 'CheckG', 'CheckH', 'CheckI'
  );

  FOREACH column_name IN ARRAY ARRAY['ClassB', 'ClassC', 'ClassD', 'ClassE']
  LOOP
    IF NOT EXISTS (
      SELECT 1
      FROM jsonb_array_elements(columns) col
      WHERE col->>'ColumnName' = column_name
    ) THEN
      column_label := CASE column_name
        WHEN 'ClassB' THEN 'アプリ利用：適用範囲'
        WHEN 'ClassC' THEN 'レコード作成：適用範囲'
        WHEN 'ClassD' THEN 'レコード更新：適用範囲'
        WHEN 'ClassE' THEN 'レコード削除：適用範囲'
      END;

      columns := columns || jsonb_build_array(
        (class_template - 'NoDuplication') || jsonb_build_object(
          'ColumnName', column_name,
          'LabelText', column_label,
          'GridLabelText', column_label,
          'InputGuide', '許可範囲をXIDの扱いで選択します。',
          'ChoicesText', E'0,許可しない\n1,XID（派遣社員）を除外\n2,全ID（XIDを含む）',
          'DefaultInput', '0',
          'ValidateRequired', true,
          'NoDuplication', false,
          'FieldCss', 'permission-scope')
      );
    END IF;
  END LOOP;

  settings := jsonb_set(settings, '{Columns}', columns, true);
  settings := jsonb_set(settings, '{EditorColumnHash}', jsonb_build_object(
    'General', jsonb_build_array(
      '_Section-1', 'Title', 'ClassA', 'CheckA',
      '_Section-2', 'ClassB', 'ClassC', 'ClassD', 'ClassE'
    )
  ), true);
  settings := jsonb_set(settings, '{SectionLatestId}', '2'::jsonb, true);
  settings := jsonb_set(settings, '{Sections}', jsonb_build_array(
    jsonb_build_object('Id', 1, 'LabelText', '対象', 'AllowExpand', false, 'Expand', true),
    jsonb_build_object('Id', 2, 'LabelText', '権限設定', 'AllowExpand', false, 'Expand', true)
  ), true);
  settings := jsonb_set(settings, '{GridColumns}', jsonb_build_array(
    'ResultId', 'Title', 'ClassA', 'CheckA', 'ClassB', 'ClassC', 'ClassD', 'ClassE', 'UpdatedTime'
  ), true);
  settings := jsonb_set(settings, '{Styles}', jsonb_build_array(
    jsonb_build_object('Id', 1, 'Title', 'SS権限管理 XID適用範囲', 'All', true, 'Body', layout_css)
  ), true);
  settings := jsonb_set(settings, '{Scripts}', jsonb_build_array(
    jsonb_build_object('Id', 1, 'Title', 'SS権限管理 XID適用範囲', 'All', true, 'Body', layout_script)
  ), true);

  UPDATE "Implem.Pleasanter"."Sites"
     SET "SiteSettings" = settings::text,
         "UpdatedTime" = CURRENT_TIMESTAMP,
         "Updator" = 1
   WHERE "SiteId" = org_site_id;

  UPDATE "Implem.Pleasanter"."Results"
     SET "ClassB" = '2',
         "ClassC" = '1',
         "ClassD" = '2',
         "ClassE" = '0',
         "UpdatedTime" = CURRENT_TIMESTAMP,
         "Updator" = 1
   WHERE "SiteId" = org_site_id
     AND "ClassA" = 'DEPT-SALES';

  UPDATE "Implem.Pleasanter"."Results"
     SET "ClassB" = '1',
         "ClassC" = '1',
         "ClassD" = '1',
         "ClassE" = '1',
         "UpdatedTime" = CURRENT_TIMESTAMP,
         "Updator" = 1
   WHERE "SiteId" = org_site_id
     AND "ClassA" = 'DEPT-ADMIN';

  UPDATE "Implem.Pleasanter"."Results"
     SET "ClassB" = '0',
         "ClassC" = '0',
         "ClassD" = '0',
         "ClassE" = '0',
         "UpdatedTime" = CURRENT_TIMESTAMP,
         "Updator" = 1
   WHERE "SiteId" = org_site_id
     AND "ClassA" = 'DEPT-VENDOR';
END $$;
