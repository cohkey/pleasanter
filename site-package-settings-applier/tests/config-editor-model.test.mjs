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
        ControlType: "RTEditor"
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
    "ClassB.FieldCss is not valid for this column: field-radio",
    "EditorColumnHash.General references missing column: NoSuchColumn",
    "View \"Broken view\" GridColumns references missing column: NoSuchColumn",
    "View \"Broken view\" ColumnSorterHash references missing column: MissingSorter"
  ]);
  assert.deepEqual(result.warnings, [
    "DescriptionC uses RTEditor and should set FieldCss to field-wide or field-normal."
  ]);
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

test("config editor comparison reports order-only changes", () => {
  const editor = loadEditor();
  const differences = editor.model.compareSettings(
    { EditorColumnHash: { General: ["Title", "ClassA", "ClassB"] } },
    { EditorColumnHash: { General: ["Title", "ClassB", "ClassA"] } }
  );

  assert.equal(differences.length, 1);
  assert.equal(differences[0].section, "EditorColumnHash");
});
