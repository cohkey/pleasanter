import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const script = fs.readFileSync(
  new URL("../apply-site-package-settings.js", import.meta.url),
  "utf8"
);

function loadApplier(currentSettings) {
  globalThis.window = globalThis;
  globalThis.location = { origin: "http://localhost:50001" };
  globalThis.fetch = async () =>
    new Response(
      JSON.stringify({
        Response: {
          Data: {
            Title: "Target",
            ReferenceType: "Results",
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

test("dry-run rejects invalid field CSS, default choices, and missing columns", async () => {
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
      key: "Columns.Title.FieldCss",
      before: "field-title",
      after: undefined,
      reason: "value is not available in the target UI options"
    },
    {
      type: "skip",
      key: "Columns.ClassB.FieldCss",
      before: "field-radio",
      after: undefined,
      reason: "value is not available in the target UI options"
    },
    {
      type: "skip",
      key: "Columns.ClassB.DefaultInput",
      before: "999",
      after: undefined,
      reason: "default value is not in ChoicesText: 999"
    },
    {
      type: "skip",
      key: "Columns.DescriptionC.FieldCss",
      before: "field-rte",
      after: undefined,
      reason: "value is not available in the target UI options"
    },
    {
      type: "update",
      key: "Columns.DescriptionC.FieldCss",
      before: undefined,
      after: "field-wide",
      reason: "RTEditor requires a valid FieldCss; normalized to field-wide"
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

  assert.equal(result.plan.nextSettings.Columns[0].FieldCss, undefined);
  assert.equal(result.plan.nextSettings.Columns[1].FieldCss, undefined);
  assert.equal(result.plan.nextSettings.Columns[1].DefaultInput, undefined);
  assert.equal(result.plan.nextSettings.Columns[2].FieldCss, "field-wide");
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
