DO $$
DECLARE
  orange_style text := $css$
body {
  --primaryColor: #eb9151;
}

.permission-target-grid,
.permission-matrix {
  margin: 8px 0 20px;
}

.permission-target-grid {
  width: 100%;
  max-width: 1040px;
  display: grid;
  grid-template-columns: minmax(360px, 1.2fr) minmax(320px, 1fr) max-content;
  gap: 12px;
}

.permission-target-grid > [id$="Field"] {
  display: grid;
  grid-template-columns: max-content minmax(0, 1fr);
  align-items: center;
  column-gap: 12px;
  min-width: 0;
  margin: 0 !important;
  padding: 12px 14px !important;
  border: 1px solid #d7dbe1;
  border-radius: 6px;
  background: #fff;
}

.permission-target-grid .field-label {
  float: none !important;
  width: auto !important;
  margin: 0 !important;
  padding: 0 !important;
  text-align: left !important;
  text-align-last: left !important;
  white-space: nowrap;
}

.permission-target-grid .field-control {
  width: auto !important;
  min-width: 0;
  margin: 0 !important;
}

.permission-target-grid .field-control input[type="text"] {
  width: 100% !important;
}

.permission-target-grid .permission-enabled {
  grid-template-columns: max-content max-content;
  justify-content: start;
  border-color: #d7dbe1;
  background: #fff !important;
}

.permission-matrix {
  width: 100%;
  max-width: 720px;
  display: grid;
  grid-template-columns: 180px minmax(320px, 1fr);
  overflow: hidden;
  border: 1px solid #cfd4dc;
  border-radius: 6px;
  background: #fff;
}

.permission-matrix__corner,
.permission-matrix__header,
.permission-matrix__row-label,
.permission-matrix__cell {
  min-width: 0;
  border-right: 1px solid #e1e4e8;
  border-bottom: 1px solid #e1e4e8;
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
  background: #f1f3f5;
  color: #30343b;
  font-weight: 700;
}

.permission-matrix__corner {
  padding-left: 18px;
  box-shadow: inset 4px 0 0 var(--primaryColor);
}

.permission-matrix__header {
  text-align: center;
}

.permission-matrix__row-label {
  display: flex;
  align-items: center;
  padding: 12px 14px;
  background: #f8f9fa;
  color: #343a42;
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

.permission-matrix__cell .field-label {
  display: none !important;
}

.permission-matrix__cell .field-control {
  width: 100% !important;
  margin: 0 !important;
}

.permission-matrix__cell select {
  width: 100%;
  min-width: 0;
}

.permission-matrix__cell select:focus {
  border-color: var(--primaryColor) !important;
  outline: 2px solid rgb(235 145 81 / 22%);
  outline-offset: 1px;
}

.permission-matrix input[type="checkbox"],
.permission-target-grid input[type="checkbox"] {
  accent-color: var(--primaryColor);
}

.permission-matrix__cell label,
.permission-target-grid label {
  font-weight: 600;
}

@media (max-width: 760px) {
  .permission-target-grid {
    grid-template-columns: 1fr;
  }

  .permission-target-grid > [id$="Field"] {
    grid-template-columns: 1fr;
    row-gap: 6px;
  }

  .permission-target-grid .permission-enabled {
    grid-template-columns: max-content max-content;
  }

  .permission-matrix {
    grid-template-columns: 140px minmax(250px, 1fr);
    overflow-x: auto;
  }
}
$css$;
  organization_choices text := E'0,許可しない\n1,通常社員のみ\n2,全社員（派遣社員を含む）';
  user_choices text := E'0,組織設定に従う\n1,このユーザを許可\n2,このユーザを拒否';
  site_rec record;
  settings jsonb;
  columns jsonb;
BEGIN
  FOR site_rec IN
    SELECT
      "SiteId",
      "Title",
      "SiteSettings"::jsonb AS settings
      FROM "Implem.Pleasanter"."Sites"
     WHERE "Title" IN ('SS権限管理_組織単位', 'SS権限管理_ユーザ単位')
     ORDER BY "SiteId"
  LOOP
    settings := site_rec.settings;

    SELECT jsonb_agg(
      CASE
        WHEN col->>'ColumnName' IN ('ClassB', 'ClassC', 'ClassD', 'ClassE') THEN
          col || jsonb_build_object(
            'ChoicesText', CASE
              WHEN site_rec."Title" = 'SS権限管理_組織単位' THEN organization_choices
              ELSE user_choices
            END
          )
        ELSE col
      END
    )
    INTO columns
    FROM jsonb_array_elements(settings->'Columns') AS col;

    settings := jsonb_set(settings, '{Columns}', columns, true);
    settings := jsonb_set(
      settings,
      '{Styles}',
      jsonb_build_array(
        jsonb_build_object(
          'Id', 1,
          'Title', 'SS権限管理 コンパクト横配置',
          'All', true,
          'Body', orange_style
        )
      ),
      true
    );

    UPDATE "Implem.Pleasanter"."Sites"
       SET "SiteSettings" = settings::text,
           "UpdatedTime" = CURRENT_TIMESTAMP,
           "Updator" = 1
     WHERE "SiteId" = site_rec."SiteId";
  END LOOP;
END $$;
