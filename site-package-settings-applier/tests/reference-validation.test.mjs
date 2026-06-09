import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const script = fs.readFileSync(
  new URL("../apply-site-package-settings.js", import.meta.url),
  "utf8"
);

function loadApplier(currentSettings, currentSite = {}) {
  globalThis.window = globalThis;
  globalThis.location = { origin: "http://localhost:50001" };
  globalThis.fetch = async () =>
    new Response(
      JSON.stringify({
        Response: {
          Data: {
            Title: "Target",
            ReferenceType: "Results",
            ...currentSite,
            SiteSettings: currentSettings
          }
        }
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" }
      }
    );
  (0, eval)(script);
  return globalThis.PleasanterSitePackageApplier;
}

test("dry-run preserves valid field CSS and rejects invalid choices and missing columns", async () => {
  const currentSettings = {
    Columns: [
      { ColumnName: "Title", FieldCss: "field-title" },
      { ColumnName: "ClassB", FieldCss: "field-radio" },
      { ColumnName: "DescriptionC", ControlType: "RTEditor", FieldCss: "field-rte" }
    ],
    EditorColumnHash: { General: ["Title", "ClassB", "DescriptionC"] },
    Exports: []
  };
  const applier = loadApplier(currentSettings);
  const sitePackage = {
    Sites: [
      {
        SiteSettings: {
          Columns: [
            { ColumnName: "Title", FieldCss: "field-title" },
            {
              ColumnName: "ClassB",
              FieldCss: "field-radio",
              ChoicesText: "10,調査\n20,実装",
              DefaultInput: "999"
            },
            { ColumnName: "DescriptionC", ControlType: "RTEditor", FieldCss: "field-rte" }
          ],
          EditorColumnHash: { General: ["Title", "NoSuchColumn"] },
          Exports: [
            {
              Name: "Export",
              Columns: [{ ColumnName: "NoSuchColumn" }]
            }
          ]
        }
      }
    ]
  };

  const result = await applier.applySiteSettings(sitePackage, {
    apiKey: "dummy",
    tenantId: 1,
    targetSiteId: 3,
    sections: "all",
    mode: "replace",
    dryRun: true,
    allowUnsafeSections: true
  });

  const reasons = result.plan.operations
    .filter((operation) => operation.reason)
    .map((operation) => ({
      type: operation.type,
      key: operation.key,
      before: operation.before,
      after: operation.after,
      reason: operation.reason
    }));

  assert.deepEqual(reasons, [
    {
      type: "skip",
      key: "Columns.ClassB.DefaultInput",
      before: "999",
      after: undefined,
      reason: "default value is not in ChoicesText: 999"
    },
    {
      type: "skip",
      key: "EditorColumnHash.General",
      before: "NoSuchColumn",
      after: undefined,
      reason: "column reference does not exist in the target table"
    },
    {
      type: "skip",
      key: "Exports[0].Columns.NoSuchColumn",
      before: "NoSuchColumn",
      after: undefined,
      reason: "column reference does not exist in the target table"
    }
  ]);

  assert.equal(result.plan.nextSettings.Columns[0].FieldCss, "field-title");
  assert.equal(result.plan.nextSettings.Columns[1].FieldCss, "field-radio");
  assert.equal(result.plan.nextSettings.Columns[1].DefaultInput, undefined);
  assert.equal(result.plan.nextSettings.Columns[2].FieldCss, "field-rte");
  assert.deepEqual(result.plan.nextSettings.EditorColumnHash.General, ["Title"]);
  assert.deepEqual(result.plan.nextSettings.Exports[0].Columns, []);
});

test("site package comparison reports editor column order differences", () => {
  const applier = loadApplier({});
  const source = {
    SiteSettings: {
      EditorColumnHash: {
        General: ["Title", "ClassA", "ClassB"]
      }
    }
  };
  const target = {
    SiteSettings: {
      EditorColumnHash: {
        General: ["Title", "ClassB", "ClassA"]
      }
    }
  };

  const result = applier.compareSitePackages(source, target, {
    sections: ["EditorColumnHash"]
  });

  assert.equal(result.equal, false);
  assert.deepEqual(result.summary, {
    create: 0,
    update: 0,
    delete: 0,
    skip: 0,
    different: 1
  });
  assert.equal(result.differences[0].section, "EditorColumnHash");
  assert.deepEqual(result.differences[0].source.General, ["Title", "ClassA", "ClassB"]);
  assert.deepEqual(result.differences[0].target.General, ["Title", "ClassB", "ClassA"]);
});

test("Japanese section names can be used instead of comma-separated English keys", async () => {
  const applier = loadApplier({
    Columns: [{ ColumnName: "Title", LabelText: "旧タイトル" }],
    Views: []
  });
  const sitePackage = {
    Sites: [
      {
        SiteSettings: {
          Columns: [{ ColumnName: "Title", LabelText: "タイトル" }],
          Views: [{ Name: "一覧", GridColumns: ["Title"] }],
          Notifications: [{ Name: "通知" }]
        }
      }
    ]
  };

  const result = await applier.applySiteSettings(sitePackage, {
    apiKey: "dummy",
    tenantId: 1,
    targetSiteId: 3,
    sections: "項目設定、表示\n通知",
    mode: "merge",
    dryRun: true
  });

  assert.deepEqual(result.plan.sections, ["Columns", "Views", "Notifications"]);
  assert.equal(result.plan.nextSettings.Columns[0].LabelText, "タイトル");
  assert.equal(result.plan.nextSettings.Views[0].Name, "一覧");
  assert.equal(result.plan.nextSettings.Notifications, undefined);
  assert.ok(result.plan.operations.some((operation) => (
    operation.type === "skip" &&
    operation.section === "Notifications" &&
    operation.reason.includes("unsafe")
  )));
});

test("section selector metadata uses Japanese labels for package keys", () => {
  const applier = loadApplier({});
  const sections = applier.selectableSections({
    Views: [],
    Columns: [],
    EditorColumnHash: {},
    Notifications: []
  });
  const byKey = new Map(sections.map((section) => [section.key, section]));

  assert.equal(byKey.get("Views").label, "ビュー");
  assert.equal(byKey.get("Columns").label, "項目設定");
  assert.equal(byKey.get("EditorColumnHash").label, "エディタ");
  assert.equal(byKey.get("Notifications").label, "通知");
  assert.equal(byKey.get("Notifications").unsafe, true);
  assert.equal(byKey.get("LinkColumns").label, "リンク項目");
  assert.equal(byKey.get("FilterColumns").label, "フィルタ項目");
  assert.equal(byKey.get("Summaries").label, "サマリ");
  assert.deepEqual(applier.parseSections("すべて"), ["all"]);
  assert.equal(applier.sectionLabel("Comments"), "コメント");
});

test("section selector exposes all management tab aliases", () => {
  const applier = loadApplier({});
  const aliases = [
    ["全般", "Site.Body"],
    ["ガイド", "Site.GridGuide"],
    ["サイト画像", "Site.SiteImage"],
    ["一覧", "GridColumns"],
    ["フィルタ", "FilterColumns"],
    ["集計", "Aggregations"],
    ["エディタ", "EditorColumnHash"],
    ["リンク", "LinkColumns"],
    ["履歴", "HistoryColumns"],
    ["移動", "MoveTargets"],
    ["サマリ", "Summaries"],
    ["計算式", "Formulas"],
    ["プロセス", "Processes"],
    ["状況による制御", "StatusControls"],
    ["ビュー", "Views"],
    ["通知", "Notifications"],
    ["リマインダー", "Reminders"],
    ["インポート", "Imports"],
    ["エクスポート", "Exports"],
    ["カレンダー", "Calendar"],
    ["クロス集計", "Crosstab"],
    ["時系列チャート", "TimeSeries"],
    ["分析チャート", "Analy"],
    ["カンバン", "Kamban"],
    ["画像ライブラリ", "ImageLib"],
    ["検索", "Search"],
    ["メール", "Mail"],
    ["サイト統合", "SiteIntegration"],
    ["スタイル", "Styles"],
    ["スクリプト", "Scripts"],
    ["HTML", "Htmls"],
    ["サーバスクリプト", "ServerScripts"],
    ["サイトのアクセス制御", "Package.Permissions"],
    ["レコードのアクセス制御", "PermissionForUpdating"],
    ["項目のアクセス制御", "UpdateColumnAccessControls"],
    ["変更履歴の一覧", "ChangeHistoryList"]
  ];

  for (const [label, key] of aliases) {
    assert.deepEqual(applier.parseSections(label), [key], label);
  }
});

test("site management fields including comments can be selected and planned", async () => {
  const applier = loadApplier(
    { Views: [] },
    {
      Body: "old body",
      GridGuide: "old guide",
      Comments: []
    }
  );
  const sitePackage = {
    Sites: [
      {
        Title: "Source",
        Body: "new body",
        GridGuide: "new guide",
        Comments: [{ Body: "管理画面コメント" }],
        SiteSettings: {
          Views: []
        }
      }
    ]
  };

  const result = await applier.applySiteSettings(sitePackage, {
    apiKey: "dummy",
    tenantId: 1,
    targetSiteId: 3,
    sections: "内容、一覧の説明、管理コメント",
    mode: "merge",
    dryRun: true
  });

  assert.deepEqual(result.plan.sections, ["Site.Body", "Site.GridGuide", "Site.Comments"]);
  assert.deepEqual(result.plan.nextSiteProperties, {
    Body: "new body",
    GridGuide: "new guide",
    Comments: [{ Body: "管理画面コメント" }]
  });
  assert.deepEqual(result.plan.nextSettings.Views, []);
});

test("site package comparison includes selected site management fields", () => {
  const applier = loadApplier({});
  const source = {
    Sites: [
      {
        Body: "new body",
        Comments: [{ Body: "管理画面コメント" }],
        SiteSettings: {}
      }
    ]
  };
  const target = {
    Sites: [
      {
        Body: "old body",
        Comments: [],
        SiteSettings: {}
      }
    ]
  };

  const result = applier.compareSitePackages(source, target, {
    sections: "内容,管理コメント"
  });

  assert.equal(result.equal, false);
  assert.deepEqual(
    result.differences.map((difference) => difference.section),
    ["Site.Body", "Site.Comments"]
  );
  assert.deepEqual(applier.parseSections("コメント"), ["Site.Comments"]);
});

test("replace mode can delete selected settings that are absent from source package", async () => {
  const applier = loadApplier({
    LinkColumns: ["Title"],
    Views: [{ Name: "一覧" }]
  });
  const sitePackage = {
    Sites: [
      {
        SiteSettings: {
          Views: [{ Name: "一覧" }]
        }
      }
    ]
  };

  const result = await applier.applySiteSettings(sitePackage, {
    apiKey: "dummy",
    tenantId: 1,
    targetSiteId: 3,
    sections: "リンク",
    mode: "replace",
    dryRun: true
  });

  assert.deepEqual(result.plan.sections, ["LinkColumns"]);
  assert.equal(result.plan.nextSettings.LinkColumns, undefined);
  assert.ok(result.plan.operations.some((operation) => (
    operation.type === "delete" &&
    operation.section === "LinkColumns"
  )));
});

test("top-level package permission sections are visible but skipped by updatesite", async () => {
  const applier = loadApplier({});
  const sitePackage = {
    Permissions: [{ Name: "Owners" }],
    PermissionIdList: [1],
    Sites: [{ SiteSettings: {} }]
  };

  const result = await applier.applySiteSettings(sitePackage, {
    apiKey: "dummy",
    tenantId: 1,
    targetSiteId: 3,
    sections: "サイトのアクセス制御",
    mode: "merge",
    dryRun: true,
    allowUnsafeSections: true
  });

  assert.deepEqual(result.plan.sections, ["Package.Permissions"]);
  assert.ok(result.plan.operations.some((operation) => (
    operation.type === "skip" &&
    operation.section === "Package.Permissions" &&
    operation.reason.includes("not applied by updatesite")
  )));
});
