(() => {
  "use strict";

  const permissionRows = [
    { label: "アプリ利用", column: "ClassB" },
    { label: "レコード作成", column: "ClassC" },
    { label: "レコード更新", column: "ClassD" },
    { label: "レコード削除", column: "ClassE" }
  ];
  const requiredColumns = [
    "Title",
    "ClassA",
    "CheckA",
    ...permissionRows.map(({ column }) => column)
  ];

  const field = (columnName) =>
    document.getElementById(`Results_${columnName}Field`);

  const createCell = (className, text) => {
    const element = document.createElement("div");
    element.className = className;
    if (text) element.textContent = text;
    return element;
  };

  const move = (parent, child) => {
    if (child && child.parentElement !== parent) {
      parent.appendChild(child);
    }
  };

  const buildTargetGrid = () => {
    if (document.querySelector(".permission-target-grid")) return true;

    const title = field("Title");
    const key = field("ClassA");
    const enabled = field("CheckA");
    if (!title || !key || !enabled) return false;

    const grid = createCell("permission-target-grid");
    enabled.classList.add("permission-enabled");
    title.parentNode.insertBefore(grid, title);
    [title, key, enabled].forEach((targetField) => move(grid, targetField));
    return true;
  };

  const matrixHeader = (firstField) => {
    const labelText =
      firstField.querySelector(".field-label")?.textContent ?? "";
    return labelText.includes("個別") ? "個別設定" : "適用範囲";
  };

  const buildPermissionMatrix = () => {
    if (document.querySelector(".permission-matrix")) return true;

    const rows = permissionRows.map((row) => ({
      ...row,
      permissionField: field(row.column)
    }));
    if (rows.some(({ permissionField }) => !permissionField)) return false;

    const matrix = createCell("permission-matrix");
    matrix.appendChild(createCell("permission-matrix__corner", "権限"));
    matrix.appendChild(
      createCell(
        "permission-matrix__header",
        matrixHeader(rows[0].permissionField)
      )
    );
    rows[0].permissionField.parentNode.insertBefore(
      matrix,
      rows[0].permissionField
    );

    rows.forEach(({ label, permissionField }) => {
      const permissionCell = createCell("permission-matrix__cell");
      matrix.appendChild(createCell("permission-matrix__row-label", label));
      matrix.appendChild(permissionCell);
      move(permissionCell, permissionField);
    });
    return true;
  };

  const buildLayout = () => {
    buildTargetGrid();
    buildPermissionMatrix();
  };

  const fieldsAreReady = () =>
    requiredColumns.every((columnName) => field(columnName));

  const layoutIsMissing = () =>
    !document.querySelector(".permission-target-grid") ||
    !document.querySelector(".permission-matrix");

  const observeEditorChanges = () => {
    if (!document.body || typeof MutationObserver === "undefined") return;

    let scheduled = false;
    const scheduleBuild = () => {
      if (scheduled) return;
      scheduled = true;
      window.setTimeout(() => {
        scheduled = false;
        buildLayout();
      }, 0);
    };

    const observer = new MutationObserver(() => {
      if (fieldsAreReady() && layoutIsMissing()) {
        scheduleBuild();
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  };

  const ready = () => {
    buildLayout();
    observeEditorChanges();
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", ready, { once: true });
  } else {
    ready();
  }
})();
