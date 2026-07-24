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
  grid-template-columns: minmax(150px, .85fr) repeat(var(--permission-columns), minmax(220px, 1fr));
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

.permission-matrix--organization > :nth-last-child(-n + 3),
.permission-matrix--user > :nth-last-child(-n + 2) {
  border-bottom: 0;
}

.permission-matrix--organization > :nth-child(3n),
.permission-matrix--user > :nth-child(2n) {
  border-right: 0;
}

.permission-matrix__corner,
.permission-matrix__header {
  padding: 10px 14px;
  background: #eaf2f8;
  color: #163b57;
  font-weight: 700;
  text-align: center;
}

.permission-matrix__corner {
  text-align: left;
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

.permission-matrix__cell--temporary {
  background: #fff9e9;
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
  min-width: 170px;
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
    grid-template-columns: minmax(120px, .8fr) repeat(var(--permission-columns), minmax(180px, 1fr));
    overflow-x: auto;
  }
}
$css$;
  org_script text := $js$
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
      { label: "アプリ利用", regular: "CheckB", temporary: "CheckC" },
      { label: "レコード作成", regular: "CheckD", temporary: "CheckE" },
      { label: "レコード更新", regular: "CheckF", temporary: "CheckG" },
      { label: "レコード削除", regular: "CheckH", temporary: "CheckI" }
    ];
    var first = field(rows[0].regular);
    if (!first) return;

    var matrix = document.createElement("div");
    matrix.className = "permission-matrix permission-matrix--organization";
    matrix.style.setProperty("--permission-columns", "2");
    matrix.appendChild(cell("permission-matrix__corner", "権限"));
    matrix.appendChild(cell("permission-matrix__header", "通常社員"));
    matrix.appendChild(cell("permission-matrix__header", "派遣社員"));
    first.parentNode.insertBefore(matrix, first);

    rows.forEach(function (row) {
      var regular = field(row.regular);
      var temporary = field(row.temporary);
      if (!regular || !temporary) return;

      var regularCell = cell("permission-matrix__cell");
      var temporaryCell = cell("permission-matrix__cell permission-matrix__cell--temporary");
      matrix.appendChild(cell("permission-matrix__row-label", row.label));
      matrix.appendChild(regularCell);
      matrix.appendChild(temporaryCell);
      move(regularCell, regular);
      move(temporaryCell, temporary);
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
  user_script text := $js$
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
    matrix.className = "permission-matrix permission-matrix--user";
    matrix.style.setProperty("--permission-columns", "1");
    matrix.appendChild(cell("permission-matrix__corner", "権限"));
    matrix.appendChild(cell("permission-matrix__header", "個別設定"));
    first.parentNode.insertBefore(matrix, first);

    rows.forEach(function (row) {
      var overrideField = field(row.column);
      if (!overrideField) return;
      var overrideCell = cell("permission-matrix__cell");
      matrix.appendChild(cell("permission-matrix__row-label", row.label));
      matrix.appendChild(overrideCell);
      move(overrideCell, overrideField);
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
  org_site_id bigint;
  user_site_id bigint;
BEGIN
  SELECT "SiteId"
    INTO org_site_id
    FROM "Implem.Pleasanter"."Sites"
   WHERE "Title" = 'SS権限管理_組織単位'
   ORDER BY "UpdatedTime" DESC
   LIMIT 1;

  SELECT "SiteId"
    INTO user_site_id
    FROM "Implem.Pleasanter"."Sites"
   WHERE "Title" = 'SS権限管理_ユーザ単位'
   ORDER BY "UpdatedTime" DESC
   LIMIT 1;

  IF org_site_id IS NULL OR user_site_id IS NULL THEN
    RAISE EXCEPTION 'Run 01-create-sample-tables.sql before this script.';
  END IF;

  -- Organization rules: each action is independently allowed for regular and temporary staff.
  SELECT "SiteSettings"::jsonb
    INTO settings
    FROM "Implem.Pleasanter"."Sites"
   WHERE "SiteId" = org_site_id;

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
      WHEN 'CheckB' THEN col || jsonb_build_object(
        'LabelText', 'アプリ利用：通常社員',
        'GridLabelText', 'アプリ利用：通常社員',
        'DefaultInput', 'false',
        'FieldCss', 'permission-regular')
      WHEN 'CheckC' THEN col || jsonb_build_object(
        'LabelText', 'アプリ利用：派遣社員',
        'GridLabelText', 'アプリ利用：派遣社員',
        'DefaultInput', 'false',
        'FieldCss', 'permission-temporary')
      WHEN 'CheckD' THEN col || jsonb_build_object(
        'LabelText', 'レコード作成：通常社員',
        'GridLabelText', 'レコード作成：通常社員',
        'DefaultInput', 'false',
        'FieldCss', 'permission-regular')
      WHEN 'CheckE' THEN col || jsonb_build_object(
        'LabelText', 'レコード作成：派遣社員',
        'GridLabelText', 'レコード作成：派遣社員',
        'DefaultInput', 'false',
        'FieldCss', 'permission-temporary')
      WHEN 'CheckF' THEN col || jsonb_build_object(
        'LabelText', 'レコード更新：通常社員',
        'GridLabelText', 'レコード更新：通常社員',
        'DefaultInput', 'false',
        'FieldCss', 'permission-regular')
      WHEN 'CheckG' THEN col || jsonb_build_object(
        'LabelText', 'レコード更新：派遣社員',
        'GridLabelText', 'レコード更新：派遣社員',
        'DefaultInput', 'false',
        'FieldCss', 'permission-temporary')
      WHEN 'CheckH' THEN col || jsonb_build_object(
        'LabelText', 'レコード削除：通常社員',
        'GridLabelText', 'レコード削除：通常社員',
        'DefaultInput', 'false',
        'FieldCss', 'permission-regular')
      WHEN 'CheckI' THEN col || jsonb_build_object(
        'LabelText', 'レコード削除：派遣社員',
        'GridLabelText', 'レコード削除：派遣社員',
        'DefaultInput', 'false',
        'FieldCss', 'permission-temporary')
      ELSE col
    END
  ) INTO columns
  FROM jsonb_array_elements(settings->'Columns') AS col;

  settings := jsonb_set(settings, '{Columns}', columns, true);
  settings := jsonb_set(settings, '{EditorColumnHash}', jsonb_build_object(
    'General', jsonb_build_array(
      '_Section-1', 'Title', 'ClassA', 'CheckA',
      '_Section-2', 'CheckB', 'CheckC', 'CheckD', 'CheckE',
      'CheckF', 'CheckG', 'CheckH', 'CheckI'
    )
  ), true);
  settings := jsonb_set(settings, '{SectionLatestId}', '2'::jsonb, true);
  settings := jsonb_set(settings, '{Sections}', jsonb_build_array(
    jsonb_build_object('Id', 1, 'LabelText', '対象', 'AllowExpand', false, 'Expand', true),
    jsonb_build_object('Id', 2, 'LabelText', '権限マトリクス', 'AllowExpand', false, 'Expand', true)
  ), true);
  settings := jsonb_set(settings, '{GridColumns}', jsonb_build_array(
    'ResultId', 'Title', 'ClassA', 'CheckA',
    'CheckB', 'CheckC', 'CheckD', 'CheckE', 'CheckF', 'CheckG', 'CheckH', 'CheckI',
    'UpdatedTime'
  ), true);
  settings := jsonb_set(settings, '{Styles}', jsonb_build_array(
    jsonb_build_object('Id', 1, 'Title', 'SS権限管理 マトリクス', 'All', true, 'Body', layout_css)
  ), true);
  settings := jsonb_set(settings, '{Scripts}', jsonb_build_array(
    jsonb_build_object('Id', 1, 'Title', 'SS権限管理 組織マトリクス', 'All', true, 'Body', org_script)
  ), true);

  UPDATE "Implem.Pleasanter"."Sites"
     SET "SiteSettings" = settings::text,
         "UpdatedTime" = CURRENT_TIMESTAMP,
         "Updator" = 1
   WHERE "SiteId" = org_site_id;

  -- User rules: each action can inherit the organization rule, allow, or deny.
  SELECT "SiteSettings"::jsonb
    INTO settings
    FROM "Implem.Pleasanter"."Sites"
   WHERE "SiteId" = user_site_id;

  SELECT col
    INTO class_template
    FROM jsonb_array_elements(settings->'Columns') AS col
   WHERE col->>'ColumnName' = 'ClassA';

  SELECT jsonb_agg(
    CASE col->>'ColumnName'
      WHEN 'Title' THEN col || jsonb_build_object(
        'LabelText', '対象ユーザ',
        'GridLabelText', '対象ユーザ',
        'InputGuide', '個別設定するユーザを入力します。',
        'ValidateRequired', true,
        'NoDuplication', true,
        'FieldCss', 'permission-target')
      WHEN 'ClassA' THEN col || jsonb_build_object(
        'LabelText', 'ユーザキー',
        'GridLabelText', 'ユーザキー',
        'InputGuide', 'SSがユーザを特定するための一意なキーです。',
        'ValidateRequired', true,
        'NoDuplication', true,
        'FieldCss', 'permission-target')
      WHEN 'CheckA' THEN col || jsonb_build_object(
        'LabelText', '有効',
        'GridLabelText', '有効',
        'DefaultInput', 'true',
        'FieldCss', 'permission-enabled')
      WHEN 'ClassB' THEN col || jsonb_build_object(
        'LabelText', 'アプリ利用：個別設定',
        'GridLabelText', 'アプリ利用：個別設定',
        'ChoicesText', E'0,組織設定を使用\n1,許可\n2,拒否',
        'DefaultInput', '0',
        'ValidateRequired', true,
        'NoDuplication', false,
        'FieldCss', 'permission-override')
      WHEN 'ClassC' THEN col || jsonb_build_object(
        'LabelText', 'レコード作成：個別設定',
        'GridLabelText', 'レコード作成：個別設定',
        'ChoicesText', E'0,組織設定を使用\n1,許可\n2,拒否',
        'DefaultInput', '0',
        'ValidateRequired', true,
        'NoDuplication', false,
        'FieldCss', 'permission-override')
      WHEN 'ClassD' THEN col || jsonb_build_object(
        'LabelText', 'レコード更新：個別設定',
        'GridLabelText', 'レコード更新：個別設定',
        'ChoicesText', E'0,組織設定を使用\n1,許可\n2,拒否',
        'DefaultInput', '0',
        'ValidateRequired', true,
        'NoDuplication', false,
        'FieldCss', 'permission-override')
      WHEN 'ClassE' THEN col || jsonb_build_object(
        'LabelText', 'レコード削除：個別設定',
        'GridLabelText', 'レコード削除：個別設定',
        'ChoicesText', E'0,組織設定を使用\n1,許可\n2,拒否',
        'DefaultInput', '0',
        'ValidateRequired', true,
        'NoDuplication', false,
        'FieldCss', 'permission-override')
      ELSE col
    END
  ) INTO columns
  FROM jsonb_array_elements(settings->'Columns') AS col
  WHERE col->>'ColumnName' NOT IN ('CheckB', 'CheckC', 'CheckD', 'CheckE', 'CheckF', 'CheckG', 'CheckH', 'CheckI');

  IF NOT EXISTS (SELECT 1 FROM jsonb_array_elements(columns) col WHERE col->>'ColumnName' = 'ClassB') THEN
    columns := columns || jsonb_build_array(
      (class_template - 'NoDuplication') || jsonb_build_object(
        'ColumnName', 'ClassB',
        'LabelText', 'アプリ利用：個別設定',
        'GridLabelText', 'アプリ利用：個別設定',
        'InputGuide', '組織設定を使用するか、ユーザ単位で許可・拒否します。',
        'ChoicesText', E'0,組織設定を使用\n1,許可\n2,拒否',
        'DefaultInput', '0',
        'ValidateRequired', true,
        'NoDuplication', false,
        'FieldCss', 'permission-override')
    );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM jsonb_array_elements(columns) col WHERE col->>'ColumnName' = 'ClassC') THEN
    columns := columns || jsonb_build_array(
      (class_template - 'NoDuplication') || jsonb_build_object(
        'ColumnName', 'ClassC',
        'LabelText', 'レコード作成：個別設定',
        'GridLabelText', 'レコード作成：個別設定',
        'InputGuide', '組織設定を使用するか、ユーザ単位で許可・拒否します。',
        'ChoicesText', E'0,組織設定を使用\n1,許可\n2,拒否',
        'DefaultInput', '0',
        'ValidateRequired', true,
        'NoDuplication', false,
        'FieldCss', 'permission-override')
    );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM jsonb_array_elements(columns) col WHERE col->>'ColumnName' = 'ClassD') THEN
    columns := columns || jsonb_build_array(
      (class_template - 'NoDuplication') || jsonb_build_object(
        'ColumnName', 'ClassD',
        'LabelText', 'レコード更新：個別設定',
        'GridLabelText', 'レコード更新：個別設定',
        'InputGuide', '組織設定を使用するか、ユーザ単位で許可・拒否します。',
        'ChoicesText', E'0,組織設定を使用\n1,許可\n2,拒否',
        'DefaultInput', '0',
        'ValidateRequired', true,
        'NoDuplication', false,
        'FieldCss', 'permission-override')
    );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM jsonb_array_elements(columns) col WHERE col->>'ColumnName' = 'ClassE') THEN
    columns := columns || jsonb_build_array(
      (class_template - 'NoDuplication') || jsonb_build_object(
        'ColumnName', 'ClassE',
        'LabelText', 'レコード削除：個別設定',
        'GridLabelText', 'レコード削除：個別設定',
        'InputGuide', '組織設定を使用するか、ユーザ単位で許可・拒否します。',
        'ChoicesText', E'0,組織設定を使用\n1,許可\n2,拒否',
        'DefaultInput', '0',
        'ValidateRequired', true,
        'NoDuplication', false,
        'FieldCss', 'permission-override')
    );
  END IF;

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
    jsonb_build_object('Id', 2, 'LabelText', 'ユーザ個別設定', 'AllowExpand', false, 'Expand', true)
  ), true);
  settings := jsonb_set(settings, '{GridColumns}', jsonb_build_array(
    'ResultId', 'Title', 'ClassA', 'CheckA', 'ClassB', 'ClassC', 'ClassD', 'ClassE', 'UpdatedTime'
  ), true);
  settings := jsonb_set(settings, '{Styles}', jsonb_build_array(
    jsonb_build_object('Id', 1, 'Title', 'SS権限管理 マトリクス', 'All', true, 'Body', layout_css)
  ), true);
  settings := jsonb_set(settings, '{Scripts}', jsonb_build_array(
    jsonb_build_object('Id', 1, 'Title', 'SS権限管理 ユーザ上書き', 'All', true, 'Body', user_script)
  ), true);

  UPDATE "Implem.Pleasanter"."Sites"
     SET "SiteSettings" = settings::text,
         "UpdatedTime" = CURRENT_TIMESTAMP,
         "Updator" = 1
   WHERE "SiteId" = user_site_id;

  UPDATE "Implem.Pleasanter"."Results"
     SET "ClassB" = '0',
         "ClassC" = '2',
         "ClassD" = '0',
         "ClassE" = '0',
         "UpdatedTime" = CURRENT_TIMESTAMP,
         "Updator" = 1
   WHERE "SiteId" = user_site_id
     AND "ClassA" = 'user-yamada';

  UPDATE "Implem.Pleasanter"."Results"
     SET "ClassB" = '1',
         "ClassC" = '0',
         "ClassD" = '2',
         "ClassE" = '0',
         "UpdatedTime" = CURRENT_TIMESTAMP,
         "Updator" = 1
   WHERE "SiteId" = user_site_id
     AND "ClassA" = 'user-sato';
END $$;
