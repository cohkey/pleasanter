import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const script = fs.readFileSync(
  new URL("../config-editor-ui.js", import.meta.url),
  "utf8"
);

function loadEditor() {
  globalThis.window = globalThis;
  delete globalThis.document;
  (0, eval)(script);
  return globalThis.PleasanterConfigEditor;
}

test("config editor validates invalid references and field values", () => {
  const editor = loadEditor();
  const result = editor.model.validateSettings({
    Columns: [
      {
        ColumnName: "ClassB",
        ChoicesText: "10,調査\n20,実装",
        DefaultInput: "999",
        FieldCss: "field-radio"
      },
      {
        ColumnName: "DescriptionC",
        ControlType: "RTEditor",
        FieldCss: "field-rte"
      },
      {
        ColumnName: "Title",
        FieldCss: "field-unknown"
      }
    ],
    EditorColumnHash: {
      General: ["ClassB", "NoSuchColumn"]
    },
    Views: [
      {
        Name: "Broken view",
        GridColumns: ["ClassB", "NoSuchColumn"],
        ColumnSorterHash: { MissingSorter: "asc" }
      }
    ]
  });

  assert.deepEqual(result.errors, [
    "ClassB.DefaultInput is not in ChoicesText: 999",
    "Title.FieldCss is not valid for this column: field-unknown",
    "EditorColumnHash.General references missing column: NoSuchColumn",
    "View \"Broken view\" GridColumns references missing column: NoSuchColumn",
    "View \"Broken view\" ColumnSorterHash references missing column: MissingSorter"
  ]);
  assert.deepEqual(result.warnings, []);
});

test("columns TSV round-trips editable column fields", () => {
  const editor = loadEditor();
  const columns = [
    {
      ColumnName: "ClassB",
      LabelText: "対応区分",
      Required: true,
      ControlType: "Normal",
      ChoicesText: "10,調査\n20,実装",
      DefaultInput: "10",
      FieldCss: "field-normal"
    }
  ];

  const tsv = editor.model.columnsToTsv(columns);
  const merged = editor.model.mergeColumnsFromTsv([], tsv);

  assert.deepEqual(merged, [
    {
      ColumnName: "ClassB",
      LabelText: "対応区分",
      Required: true,
      ControlType: "Normal",
      ChoicesText: "10,調査\n20,実装",
      DefaultInput: "10",
      FieldCss: "field-normal"
    }
  ]);
});

test("editor column hash TSV preserves group order", () => {
  const editor = loadEditor();
  const hash = {
    "基本": ["Title", "Status"],
    "詳細": ["DescriptionA", "AttachmentsA"]
  };

  const tsv = editor.model.editorColumnHashToTsv(hash);
  const parsed = editor.model.editorColumnHashFromTsv(tsv);

  assert.deepEqual(parsed, hash);
});

test("editor layout helpers pair column keys with display names", () => {
  const editor = loadEditor();
  const settings = {
    Columns: [
      { ColumnName: "ClassB", LabelText: "対応区分" },
      { ColumnName: "DescriptionA", LabelText: "作業メモ" }
    ]
  };

  assert.equal(editor.model.columnDisplayName("ClassB", settings), "対応区分");
  assert.equal(editor.model.columnDisplayName("Title", settings), "タイトル");
  assert.equal(editor.model.columnKindLabel("DescriptionA"), "説明");
  assert.ok(editor.model.displayColumnNames(settings).includes("ClassB"));
});

test("column detail fields include all keys from loaded columns", () => {
  const editor = loadEditor();
  const settings = {
    Columns: [
      { ColumnName: "NumA", LabelText: "金額", DecimalPlaces: 2 },
      { ColumnName: "ClassA", LabelText: "区分", NoDisplay: true }
    ]
  };

  const fields = editor.model.columnDetailFields(settings);
  assert.ok(fields.includes("ColumnName"));
  assert.ok(fields.includes("DecimalPlaces"));
  assert.ok(fields.includes("NoDisplay"));
});

test("config editor comparison reports order-only changes", () => {
  const editor = loadEditor();
  const differences = editor.model.compareSettings(
    { EditorColumnHash: { General: ["Title", "ClassA", "ClassB"] } },
    { EditorColumnHash: { General: ["Title", "ClassB", "ClassA"] } }
  );

  assert.equal(differences.length, 1);
  assert.equal(differences[0].section, "EditorColumnHash");
});

test("detailed comparison reports changed property paths", () => {
  const editor = loadEditor();
  const differences = editor.model.compareSettingsDetailed(
    {
      Columns: [{ ColumnName: "ClassB", LabelText: "対応区分", Required: false }],
      Views: [{ Name: "一覧", GridColumns: ["Title"] }]
    },
    {
      Columns: [{ ColumnName: "ClassB", LabelText: "対応区分", Required: true }],
      Views: [{ Name: "一覧", GridColumns: ["Title", "ClassB"] }]
    }
  );

  assert.deepEqual(
    differences.map((difference) => difference.path),
    ["Columns[ClassB].Required", "Views[一覧].GridColumns[2]"]
  );
  assert.equal(differences[0].label, "項目設定 / ClassB / 入力必須");
  assert.equal(differences[0].type, "update");
});

test("column field labels use Japanese names for extended Pleasanter settings", () => {
  const editor = loadEditor();
  const differences = editor.model.compareSettingsDetailed(
    { Columns: [{ ColumnName: "Title", InputGuide: "" }] },
    { Columns: [{ ColumnName: "Title", InputGuide: "件名を入力してください。" }] }
  );

  assert.equal(differences[0].label, "項目設定 / Title / 入力ガイド");
});
