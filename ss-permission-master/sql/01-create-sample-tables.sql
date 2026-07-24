DO $$
DECLARE
  org_site_id bigint;
  user_site_id bigint;
  target_result_id bigint;
  rec record;
  settings_org text := $json$
{
  "Version": 1.017,
  "ReferenceType": "Results",
  "GridColumns": [
    "ResultId",
    "Title",
    "ClassA",
    "CheckA",
    "CheckB",
    "CheckC",
    "CheckD",
    "CheckE",
    "CheckF",
    "UpdatedTime"
  ],
  "EditorColumnHash": {
    "対象": [
      "ResultId",
      "Ver",
      "Title",
      "ClassA",
      "CheckA"
    ],
    "適用範囲": [
      "CheckB"
    ],
    "SS制御権限": [
      "CheckC",
      "CheckD",
      "CheckE",
      "CheckF"
    ],
    "General": [
      "ResultId",
      "Ver",
      "Title",
      "ClassA",
      "CheckA",
      "CheckB",
      "CheckC",
      "CheckD",
      "CheckE",
      "CheckF"
    ]
  },
  "GeneralTabLabelText": "権限設定",
  "Columns": [
    {
      "ColumnName": "Title",
      "LabelText": "対象組織",
      "GridLabelText": "組織",
      "InputGuide": "SSで判定する組織名を入力します。",
      "ValidateRequired": true,
      "MaxLength": 100,
      "NoDuplication": true
    },
    {
      "ColumnName": "ClassA",
      "LabelText": "組織キー",
      "GridLabelText": "組織キー",
      "InputGuide": "SSが参照する組織IDまたは組織コードを入力します。",
      "ValidateRequired": true,
      "MaxLength": 64,
      "NoDuplication": true
    },
    {
      "ColumnName": "CheckA",
      "LabelText": "有効",
      "GridLabelText": "有効",
      "DefaultInput": "true"
    },
    {
      "ColumnName": "CheckB",
      "LabelText": "派遣社員を含める",
      "GridLabelText": "派遣含む",
      "DefaultInput": "false"
    },
    {
      "ColumnName": "CheckC",
      "LabelText": "アプリ利用",
      "GridLabelText": "利用",
      "DefaultInput": "false"
    },
    {
      "ColumnName": "CheckD",
      "LabelText": "レコード作成",
      "GridLabelText": "作成",
      "DefaultInput": "false"
    },
    {
      "ColumnName": "CheckE",
      "LabelText": "レコード更新",
      "GridLabelText": "更新",
      "DefaultInput": "false"
    },
    {
      "ColumnName": "CheckF",
      "LabelText": "レコード削除",
      "GridLabelText": "削除",
      "DefaultInput": "false"
    }
  ],
  "ViewLatestId": 1,
  "Views": [
    {
      "Id": 1,
      "Name": "権限一覧",
      "DefaultMode": "Index",
      "GridColumns": [
        "ResultId",
        "Title",
        "ClassA",
        "CheckA",
        "CheckB",
        "CheckC",
        "CheckD",
        "CheckE",
        "CheckF",
        "UpdatedTime"
      ],
      "ColumnSorterHash": {
        "Title": "asc"
      },
      "ApiColumnKeyDisplayType": 0,
      "ApiColumnValueDisplayType": 0,
      "CalendarSiteId": 0,
      "ApiDataType": 0
    }
  ],
  "NoDisplayIfReadOnly": true
}
$json$;
  settings_user text := $json$
{
  "Version": 1.017,
  "ReferenceType": "Results",
  "GridColumns": [
    "ResultId",
    "Title",
    "ClassA",
    "CheckA",
    "CheckB",
    "CheckC",
    "CheckD",
    "CheckE",
    "CheckF",
    "UpdatedTime"
  ],
  "EditorColumnHash": {
    "対象": [
      "ResultId",
      "Ver",
      "Title",
      "ClassA",
      "CheckA"
    ],
    "適用範囲": [
      "CheckB"
    ],
    "SS制御権限": [
      "CheckC",
      "CheckD",
      "CheckE",
      "CheckF"
    ],
    "General": [
      "ResultId",
      "Ver",
      "Title",
      "ClassA",
      "CheckA",
      "CheckB",
      "CheckC",
      "CheckD",
      "CheckE",
      "CheckF"
    ]
  },
  "GeneralTabLabelText": "権限設定",
  "Columns": [
    {
      "ColumnName": "Title",
      "LabelText": "対象ユーザ",
      "GridLabelText": "ユーザ",
      "InputGuide": "組織設定と異なる個別制御が必要なユーザだけ登録します。",
      "ValidateRequired": true,
      "MaxLength": 100,
      "NoDuplication": true
    },
    {
      "ColumnName": "ClassA",
      "LabelText": "ユーザキー",
      "GridLabelText": "ユーザキー",
      "InputGuide": "SSが参照するユーザIDまたはログインIDを入力します。",
      "ValidateRequired": true,
      "MaxLength": 64,
      "NoDuplication": true
    },
    {
      "ColumnName": "CheckA",
      "LabelText": "有効",
      "GridLabelText": "有効",
      "DefaultInput": "true"
    },
    {
      "ColumnName": "CheckB",
      "LabelText": "派遣社員の場合も適用",
      "GridLabelText": "派遣適用",
      "DefaultInput": "true"
    },
    {
      "ColumnName": "CheckC",
      "LabelText": "アプリ利用",
      "GridLabelText": "利用",
      "DefaultInput": "false"
    },
    {
      "ColumnName": "CheckD",
      "LabelText": "レコード作成",
      "GridLabelText": "作成",
      "DefaultInput": "false"
    },
    {
      "ColumnName": "CheckE",
      "LabelText": "レコード更新",
      "GridLabelText": "更新",
      "DefaultInput": "false"
    },
    {
      "ColumnName": "CheckF",
      "LabelText": "レコード削除",
      "GridLabelText": "削除",
      "DefaultInput": "false"
    }
  ],
  "ViewLatestId": 1,
  "Views": [
    {
      "Id": 1,
      "Name": "個別例外一覧",
      "DefaultMode": "Index",
      "GridColumns": [
        "ResultId",
        "Title",
        "ClassA",
        "CheckA",
        "CheckB",
        "CheckC",
        "CheckD",
        "CheckE",
        "CheckF",
        "UpdatedTime"
      ],
      "ColumnSorterHash": {
        "Title": "asc"
      },
      "ApiColumnKeyDisplayType": 0,
      "ApiColumnValueDisplayType": 0,
      "CalendarSiteId": 0,
      "ApiDataType": 0
    }
  ],
  "NoDisplayIfReadOnly": true
}
$json$;
BEGIN
  SELECT "SiteId"
    INTO org_site_id
    FROM "Implem.Pleasanter"."Sites"
   WHERE "Title" = 'SS権限管理_組織単位'
   ORDER BY "UpdatedTime" DESC
   LIMIT 1;

  IF org_site_id IS NULL THEN
    INSERT INTO "Implem.Pleasanter"."Items"
      ("ReferenceType", "SiteId", "Title", "Creator", "Updator")
    VALUES
      ('Sites', 0, 'SS権限管理_組織単位', 1, 1)
    RETURNING "ReferenceId" INTO org_site_id;

    UPDATE "Implem.Pleasanter"."Items"
       SET "SiteId" = org_site_id
     WHERE "ReferenceId" = org_site_id;

    INSERT INTO "Implem.Pleasanter"."Sites"
      (
        "TenantId",
        "SiteId",
        "Title",
        "ReferenceType",
        "ParentId",
        "InheritPermission",
        "SiteSettings",
        "Publish",
        "Creator",
        "Updator"
      )
    VALUES
      (
        1,
        org_site_id,
        'SS権限管理_組織単位',
        'Results',
        0,
        org_site_id,
        settings_org,
        false,
        1,
        1
      );
  ELSE
    UPDATE "Implem.Pleasanter"."Items"
       SET "Title" = 'SS権限管理_組織単位',
           "UpdatedTime" = CURRENT_TIMESTAMP,
           "Updator" = 1
     WHERE "ReferenceId" = org_site_id
       AND "ReferenceType" = 'Sites';

    UPDATE "Implem.Pleasanter"."Sites"
       SET "SiteSettings" = settings_org,
           "ReferenceType" = 'Results',
           "UpdatedTime" = CURRENT_TIMESTAMP,
           "Updator" = 1
     WHERE "SiteId" = org_site_id;
  END IF;

  SELECT "SiteId"
    INTO user_site_id
    FROM "Implem.Pleasanter"."Sites"
   WHERE "Title" = 'SS権限管理_ユーザ単位'
   ORDER BY "UpdatedTime" DESC
   LIMIT 1;

  IF user_site_id IS NULL THEN
    INSERT INTO "Implem.Pleasanter"."Items"
      ("ReferenceType", "SiteId", "Title", "Creator", "Updator")
    VALUES
      ('Sites', 0, 'SS権限管理_ユーザ単位', 1, 1)
    RETURNING "ReferenceId" INTO user_site_id;

    UPDATE "Implem.Pleasanter"."Items"
       SET "SiteId" = user_site_id
     WHERE "ReferenceId" = user_site_id;

    INSERT INTO "Implem.Pleasanter"."Sites"
      (
        "TenantId",
        "SiteId",
        "Title",
        "ReferenceType",
        "ParentId",
        "InheritPermission",
        "SiteSettings",
        "Publish",
        "Creator",
        "Updator"
      )
    VALUES
      (
        1,
        user_site_id,
        'SS権限管理_ユーザ単位',
        'Results',
        0,
        user_site_id,
        settings_user,
        false,
        1,
        1
      );
  ELSE
    UPDATE "Implem.Pleasanter"."Items"
       SET "Title" = 'SS権限管理_ユーザ単位',
           "UpdatedTime" = CURRENT_TIMESTAMP,
           "Updator" = 1
     WHERE "ReferenceId" = user_site_id
       AND "ReferenceType" = 'Sites';

    UPDATE "Implem.Pleasanter"."Sites"
       SET "SiteSettings" = settings_user,
           "ReferenceType" = 'Results',
           "UpdatedTime" = CURRENT_TIMESTAMP,
           "Updator" = 1
     WHERE "SiteId" = user_site_id;
  END IF;

  INSERT INTO "Implem.Pleasanter"."Permissions"
    ("ReferenceId", "DeptId", "GroupId", "UserId", "PermissionType", "Creator", "Updator")
  VALUES
    (org_site_id, 0, 0, 1, 511, 1, 1),
    (user_site_id, 0, 0, 1, 511, 1, 1)
  ON CONFLICT ("ReferenceId", "DeptId", "GroupId", "UserId")
  DO UPDATE SET
    "PermissionType" = EXCLUDED."PermissionType",
    "Updator" = 1,
    "UpdatedTime" = CURRENT_TIMESTAMP;

  FOR rec IN
    SELECT *
      FROM (VALUES
        (org_site_id, '営業部', 'DEPT-SALES', true, true, true, true, true, false),
        (org_site_id, '管理部', 'DEPT-ADMIN', true, false, true, true, true, true),
        (org_site_id, '外部委託チーム', 'DEPT-VENDOR', false, true, false, false, false, false),
        (user_site_id, '山田 太郎', 'user-yamada', true, true, true, true, true, true),
        (user_site_id, '佐藤 花子', 'user-sato', true, false, true, false, true, false)
      ) AS v(
        target_site_id,
        record_title,
        record_key,
        enabled,
        include_temp_staff,
        can_access,
        can_create,
        can_update,
        can_delete
      )
  LOOP
    SELECT "ResultId"
      INTO target_result_id
      FROM "Implem.Pleasanter"."Results"
     WHERE "SiteId" = rec.target_site_id
       AND "ClassA" = rec.record_key
     ORDER BY "UpdatedTime" DESC
     LIMIT 1;

    IF target_result_id IS NULL THEN
      INSERT INTO "Implem.Pleasanter"."Items"
        ("ReferenceType", "SiteId", "Title", "Creator", "Updator")
      VALUES
        ('Results', rec.target_site_id, rec.record_title, 1, 1)
      RETURNING "ReferenceId" INTO target_result_id;

      INSERT INTO "Implem.Pleasanter"."Results"
        (
          "SiteId",
          "ResultId",
          "Title",
          "ClassA",
          "CheckA",
          "CheckB",
          "CheckC",
          "CheckD",
          "CheckE",
          "CheckF",
          "Creator",
          "Updator"
        )
      VALUES
        (
          rec.target_site_id,
          target_result_id,
          rec.record_title,
          rec.record_key,
          rec.enabled,
          rec.include_temp_staff,
          rec.can_access,
          rec.can_create,
          rec.can_update,
          rec.can_delete,
          1,
          1
        );
    ELSE
      UPDATE "Implem.Pleasanter"."Items"
         SET "Title" = rec.record_title,
             "UpdatedTime" = CURRENT_TIMESTAMP,
             "Updator" = 1
       WHERE "ReferenceId" = target_result_id;

      UPDATE "Implem.Pleasanter"."Results"
         SET "Title" = rec.record_title,
             "ClassA" = rec.record_key,
             "CheckA" = rec.enabled,
             "CheckB" = rec.include_temp_staff,
             "CheckC" = rec.can_access,
             "CheckD" = rec.can_create,
             "CheckE" = rec.can_update,
             "CheckF" = rec.can_delete,
             "UpdatedTime" = CURRENT_TIMESTAMP,
             "Updator" = 1
       WHERE "ResultId" = target_result_id
         AND "SiteId" = rec.target_site_id;
    END IF;
  END LOOP;
END $$;
