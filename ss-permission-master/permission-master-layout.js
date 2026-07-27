(function () {
  "use strict";

  var rows = [
    { label: "アプリ利用", column: "ClassB" },
    { label: "レコード作成", column: "ClassC" },
    { label: "レコード更新", column: "ClassD" },
    { label: "レコード削除", column: "ClassE" }
  ];

  function field(columnName) {
    return document.getElementById("Results_" + columnName + "Field");
  }

  function createCell(className, text) {
    var element = document.createElement("div");
    element.className = className;
    if (text) element.textContent = text;
    return element;
  }

  function move(parent, child) {
    if (child && child.parentElement !== parent) {
      parent.appendChild(child);
    }
  }

  function buildTargetGrid() {
    if (document.querySelector(".permission-target-grid")) return true;

    var title = field("Title");
    var key = field("ClassA");
    var enabled = field("CheckA");
    if (!title || !key || !enabled) return false;

    var grid = createCell("permission-target-grid");
    enabled.classList.add("permission-enabled");
    title.parentNode.insertBefore(grid, title);
    move(grid, title);
    move(grid, key);
    move(grid, enabled);
    return true;
  }

  function matrixHeader(firstField) {
    var label = firstField.querySelector(".field-label");
    var labelText = label ? label.textContent : "";
    return labelText.indexOf("個別") >= 0 ? "個別設定" : "適用範囲";
  }

  function buildPermissionMatrix() {
    if (document.querySelector(".permission-matrix")) return true;

    var first = field(rows[0].column);
    if (!first) return false;

    var matrix = createCell("permission-matrix");
    matrix.appendChild(createCell("permission-matrix__corner", "権限"));
    matrix.appendChild(
      createCell("permission-matrix__header", matrixHeader(first))
    );
    first.parentNode.insertBefore(matrix, first);

    rows.forEach(function (row) {
      var permissionField = field(row.column);
      if (!permissionField) return;

      var permissionCell = createCell("permission-matrix__cell");
      matrix.appendChild(
        createCell("permission-matrix__row-label", row.label)
      );
      matrix.appendChild(permissionCell);
      move(permissionCell, permissionField);
    });
    return true;
  }

  function buildLayout() {
    buildTargetGrid();
    buildPermissionMatrix();
  }

  function observeEditorChanges() {
    if (!document.body || typeof MutationObserver === "undefined") return;

    var scheduled = false;
    var observer = new MutationObserver(function () {
      var fieldsExist = field("Title") || field(rows[0].column);
      var targetMissing = !document.querySelector(".permission-target-grid");
      var matrixMissing = !document.querySelector(".permission-matrix");

      if (!fieldsExist || (!targetMissing && !matrixMissing) || scheduled) return;

      scheduled = true;
      window.setTimeout(function () {
        scheduled = false;
        buildLayout();
      }, 0);
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  }

  function ready() {
    buildLayout();
    observeEditorChanges();
    window.setTimeout(buildLayout, 250);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", ready, { once: true });
  } else {
    ready();
  }
})();
