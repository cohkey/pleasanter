/*
 * Browser-based SiteSettings editor for Pleasanter site packages.
 *
 * Production target:
 * - Paste load-local-js-from-file.js into DevTools Console.
 * - Run PleasanterLocalJsLoader.pickAndRun() and select this file.
 * - No Node.js, build step, or external library is required.
 */
(function attachPleasanterConfigEditor(global) {
  const VERSION = "0.6.0";
  const rootId = "pleasanter-config-editor-root";
  const applierGlobalName = "PleasanterSitePackageApplier";
  const sections = ["Summary", "Views", "Editor", "Raw JSON", "Diff"];
  const sectionLabels = {
    Summary: "概要",
    Views: "ビュー",
    Editor: "エディタ",
    EditorColumnHash: "エディタ配置",
    Columns: "項目設定",
    "Raw JSON": "JSON",
    Diff: "差分確認"
  };
  const preferredColumnFields = [
    "ColumnName",
    "LabelText",
    "GridLabelText",
    "Required",
    "ControlType",
    "ChoicesText",
    "DefaultInput",
    "FieldCss",
    "TextAlign",
    "EditorReadOnly",
    "EditorFormat",
    "MaxLength",
    "Min",
    "Max",
    "Regex",
    "Description"
  ];
  const booleanColumnFields = new Set([
    "Required",
    "EditorReadOnly",
    "NoDisplay",
    "Hidden",
    "AllowSearch",
    "AllowBulkUpdate",
    "ReadOnly",
    "Nullable",
    "MultipleSelections"
  ]);
  const numberColumnFields = new Set([
    "MaxLength",
    "Min",
    "Max",
    "DecimalPlaces",
    "LinkedSiteId",
    "Width",
    "Height",
    "Rows"
  ]);
  const unsafeSections = new Set([
    "Notifications",
    "Reminders",
    "Scripts",
    "ServerScripts",
    "Htmls",
    "Processes",
    "StatusControls",
    "Aggregations"
  ]);
  const systemColumnNames = new Set([
    "ResultId",
    "Ver",
    "Title",
    "Body",
    "Status",
    "Manager",
    "Owner",
    "Locked",
    "Comments",
    "Creator",
    "CreatedTime",
    "Updator",
    "UpdatedTime",
    "TitleBody",
    "SiteTitle"
  ]);
  const systemColumnLabels = {
    ResultId: "ID",
    Ver: "バージョン",
    Title: "タイトル",
    Body: "内容",
    Status: "状況",
    Manager: "管理者",
    Owner: "担当者",
    Locked: "ロック",
    Comments: "コメント",
    Creator: "作成者",
    CreatedTime: "作成日時",
    Updator: "更新者",
    UpdatedTime: "更新日時",
    TitleBody: "タイトル/内容",
    SiteTitle: "サイト名"
  };

  const state = {
    activeSection: "Summary",
    sourcePackage: null,
    sourceSettings: {},
    workingSettings: {},
    packageFileName: "",
    siteTitle: "",
    sourceSiteId: "",
    targetSiteId: currentSiteId() || "",
    tenantId: domValue("TenantId") || "1",
    apiKey: "",
    mode: "replace",
    allowUnsafeSections: false,
    validation: { errors: [], warnings: [] },
    dirty: false,
    dirtyAfterDryRun: false,
    dryRun: null,
    applyResult: null,
    extraColumnFields: [],
    log: []
  };

  let shadow = null;

  function open(options = {}) {
    close();
    Object.assign(state, {
      targetSiteId: options.targetSiteId || state.targetSiteId || currentSiteId() || "",
      tenantId: options.tenantId || state.tenantId || domValue("TenantId") || "1",
      apiKey: options.apiKey || state.apiKey || sessionStorage.getItem("PleasanterConfigEditor.apiKey") || ""
    });

    const host = document.createElement("div");
    host.id = rootId;
    document.body.appendChild(host);
    shadow = host.attachShadow({ mode: "open" });
    renderShell();
    render();
    logInfo("設定エディタを開きました。");
    return api;
  }

  function close() {
    document.getElementById(rootId)?.remove();
    shadow = null;
  }

  function renderShell() {
    shadow.innerHTML = `
      <style>
        :host {
          all: initial;
          color: #20242a;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
          font-size: 13px;
          line-height: 1.45;
        }
        * { box-sizing: border-box; }
        .pcu-shell {
          position: fixed;
          inset: 14px;
          z-index: 2147483000;
          display: grid;
          grid-template-rows: auto auto 1fr 132px;
          min-width: 880px;
          min-height: 600px;
          background: #f5f5f7;
          border: 1px solid rgba(60, 64, 67, .28);
          border-radius: 8px;
          box-shadow: 0 22px 70px rgba(16, 24, 40, .28);
          overflow: hidden;
        }
        .pcu-toolbar {
          display: grid;
          grid-template-columns: 1fr auto;
          gap: 10px;
          align-items: center;
          padding: 10px 12px;
          background: rgba(255, 255, 255, .9);
          border-bottom: 1px solid #d9dde3;
        }
        .pcu-workflow {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 1px;
          background: #d6dbe1;
          border-bottom: 1px solid #d6dbe1;
        }
        .pcu-step {
          display: grid;
          grid-template-columns: auto 1fr;
          gap: 8px;
          align-items: center;
          min-height: 42px;
          padding: 8px 12px;
          background: #ffffff;
        }
        .pcu-step-number {
          display: inline-grid;
          place-items: center;
          width: 24px;
          height: 24px;
          border: 1px solid #9bbbe8;
          border-radius: 999px;
          background: #eef6ff;
          color: #0a5db7;
          font-weight: 700;
        }
        .pcu-step strong {
          display: block;
          font-size: 12px;
        }
        .pcu-step-detail {
          display: block;
          color: #5b6470;
          font-size: 11px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .pcu-title {
          display: flex;
          align-items: center;
          gap: 10px;
          min-width: 0;
        }
        .pcu-title strong {
          font-size: 14px;
          font-weight: 700;
          white-space: nowrap;
        }
        .pcu-title span {
          color: #5b6470;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .pcu-actions,
        .pcu-fields {
          display: flex;
          align-items: center;
          gap: 6px;
          flex-wrap: wrap;
          justify-content: flex-end;
        }
        .pcu-topline {
          display: grid;
          grid-template-rows: auto auto;
          gap: 8px;
        }
        button,
        input,
        select,
        textarea {
          font: inherit;
        }
        button {
          min-height: 30px;
          padding: 5px 10px;
          border: 1px solid #aeb7c2;
          border-radius: 6px;
          background: linear-gradient(#ffffff, #f4f5f6);
          color: #20242a;
          cursor: pointer;
        }
        button:hover { background: #eef3f5; }
        button:disabled {
          color: #9aa3ad;
          background: #f0f2f4;
          cursor: not-allowed;
        }
        button.pcu-primary {
          background: #0a84ff;
          border-color: #0a84ff;
          color: #ffffff;
        }
        button.pcu-danger {
          border-color: #c2410c;
          color: #9a3412;
        }
        input,
        select,
        textarea {
          border: 1px solid #b9c1cb;
          border-radius: 6px;
          background: #ffffff;
          color: #20242a;
          min-height: 30px;
          padding: 5px 7px;
        }
        textarea {
          resize: vertical;
          min-height: 74px;
          width: 100%;
          font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
          font-size: 12px;
          line-height: 1.5;
        }
        label {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          color: #39424e;
          white-space: nowrap;
        }
        .pcu-main {
          display: grid;
          grid-template-columns: 210px minmax(0, 1fr);
          min-height: 0;
        }
        .pcu-nav {
          overflow: auto;
          padding: 10px;
          background: #e9ebef;
          border-right: 1px solid #d0d7de;
        }
        .pcu-nav button {
          width: 100%;
          display: grid;
          grid-template-columns: 1fr auto;
          gap: 8px;
          align-items: center;
          margin-bottom: 6px;
          text-align: left;
          background: transparent;
          border-color: transparent;
          border-radius: 8px;
        }
        .pcu-nav .pcu-nav-title {
          display: block;
          font-weight: 700;
        }
        .pcu-nav .pcu-nav-subtitle {
          display: block;
          margin-top: 2px;
          color: #6b7280;
          font-size: 11px;
        }
        .pcu-nav button[aria-current="true"] {
          background: #ffffff;
          border-color: #c9d4e1;
          box-shadow: 0 1px 2px rgba(16, 24, 40, .08);
        }
        .pcu-badge {
          display: inline-block;
          min-width: 20px;
          padding: 1px 6px;
          border: 1px solid #ccd3da;
          border-radius: 999px;
          background: #ffffff;
          color: #4b5563;
          text-align: center;
          font-size: 11px;
        }
        .pcu-badge.warn {
          border-color: #f59e0b;
          background: #fff7ed;
          color: #92400e;
        }
        .pcu-badge.error {
          border-color: #dc2626;
          background: #fef2f2;
          color: #991b1b;
        }
        .pcu-panel {
          min-width: 0;
          min-height: 0;
          overflow: auto;
          padding: 12px;
        }
        .pcu-panel h2 {
          margin: 0 0 10px;
          font-size: 15px;
        }
        .pcu-panel h3 {
          margin: 16px 0 8px;
          font-size: 13px;
        }
        .pcu-grid {
          display: grid;
          gap: 10px;
        }
        .pcu-grid.two {
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }
        .pcu-grid.three {
          grid-template-columns: repeat(3, minmax(0, 1fr));
        }
        .pcu-metric {
          padding: 10px;
          background: #ffffff;
          border: 1px solid #d6dbe1;
          min-height: 72px;
        }
        .pcu-metric .label {
          color: #5b6470;
          font-size: 12px;
        }
        .pcu-metric .value {
          margin-top: 4px;
          font-size: 20px;
          font-weight: 700;
        }
        .pcu-table-wrap {
          overflow: auto;
          border: 1px solid #d6dbe1;
          border-radius: 8px;
          background: #ffffff;
        }
        table {
          width: 100%;
          border-collapse: collapse;
          table-layout: fixed;
        }
        th,
        td {
          border-bottom: 1px solid #e3e7eb;
          border-right: 1px solid #edf0f2;
          padding: 6px;
          vertical-align: top;
        }
        tr:hover td {
          background: #fbfcfd;
        }
        th {
          position: sticky;
          top: 0;
          z-index: 1;
          background: #f6f7f9;
          color: #374151;
          font-weight: 700;
          text-align: left;
        }
        td input,
        td select,
        td textarea {
          width: 100%;
        }
        td textarea {
          min-height: 54px;
        }
        .pcu-row-actions {
          display: flex;
          gap: 4px;
          flex-wrap: wrap;
        }
        .pcu-subbar {
          display: flex;
          justify-content: space-between;
          gap: 10px;
          align-items: center;
          margin-bottom: 10px;
        }
        .pcu-log {
          overflow: auto;
          padding: 8px 12px;
          background: #ffffff;
          border-top: 1px solid #d6dbe1;
          font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
          font-size: 12px;
        }
        .pcu-log-line {
          white-space: pre-wrap;
          margin: 0 0 3px;
        }
        .pcu-log-line.error { color: #b91c1c; }
        .pcu-log-line.warn { color: #92400e; }
        .pcu-empty {
          padding: 18px;
          border: 1px dashed #b9c1cb;
          background: #ffffff;
          color: #5b6470;
        }
        .pcu-split {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 10px;
          align-items: start;
        }
        .pcu-code {
          min-height: 360px;
        }
        .pcu-errors {
          display: grid;
          gap: 6px;
        }
        .pcu-message {
          border: 1px solid #d6dbe1;
          border-radius: 8px;
          background: #ffffff;
          padding: 8px;
        }
        .pcu-section-head {
          display: grid;
          grid-template-columns: 1fr auto;
          gap: 10px;
          align-items: start;
          margin-bottom: 12px;
        }
        .pcu-section-head h2 {
          margin-bottom: 3px;
        }
        .pcu-section-head p {
          margin: 0;
          color: #5b6470;
          font-size: 12px;
        }
        .pcu-field-stack {
          display: grid;
          gap: 4px;
        }
        .pcu-field-stack span {
          color: #4b5563;
          font-size: 11px;
          font-weight: 700;
        }
        .pcu-chip-list {
          display: flex;
          flex-wrap: wrap;
          gap: 5px;
        }
        .pcu-chip {
          display: inline-flex;
          align-items: center;
          max-width: 180px;
          padding: 2px 7px;
          border: 1px solid #cfd6dd;
          border-radius: 999px;
          background: #ffffff;
          color: #374151;
          font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
          font-size: 11px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .pcu-editor-summary {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 8px;
          margin-bottom: 10px;
        }
        .pcu-editor-summary-item {
          min-height: 58px;
          padding: 9px 10px;
          border: 1px solid #d9dde3;
          border-radius: 8px;
          background: #ffffff;
        }
        .pcu-editor-summary-item span {
          display: block;
          color: #606975;
          font-size: 11px;
        }
        .pcu-editor-summary-item strong {
          display: block;
          margin-top: 3px;
          font-size: 17px;
        }
        .pcu-editor-group-row td {
          background: #eef2f7;
          border-right: 0;
          padding: 8px;
        }
        .pcu-editor-group-row:hover td {
          background: #eef2f7;
        }
        .pcu-editor-group-bar {
          display: grid;
          grid-template-columns: minmax(230px, 1fr) auto;
          gap: 8px;
          align-items: center;
        }
        .pcu-editor-group-title {
          display: flex;
          align-items: center;
          gap: 8px;
          min-width: 0;
        }
        .pcu-editor-group-title input {
          min-width: 180px;
          max-width: 360px;
        }
        .pcu-editor-item-name {
          display: grid;
          gap: 4px;
        }
        .pcu-editor-item-name strong {
          font-size: 13px;
        }
        .pcu-key {
          color: #6b7280;
          font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
          font-size: 11px;
        }
        .pcu-muted {
          color: #6b7280;
          font-size: 11px;
        }
        .pcu-pill {
          display: inline-flex;
          align-items: center;
          min-height: 22px;
          padding: 1px 7px;
          border: 1px solid #d2d8df;
          border-radius: 999px;
          background: #f8fafc;
          color: #374151;
          font-size: 11px;
          white-space: nowrap;
        }
        .pcu-pill.warn {
          border-color: #f59e0b;
          background: #fff7ed;
          color: #92400e;
        }
        .pcu-pill.error {
          border-color: #fca5a5;
          background: #fff1f2;
          color: #991b1b;
        }
        .pcu-editor-note {
          display: flex;
          flex-wrap: wrap;
          gap: 4px;
        }
        .pcu-inline-details {
          width: 100%;
          margin-top: 6px;
        }
        .pcu-inline-details summary {
          color: #0a5db7;
          cursor: pointer;
          font-size: 12px;
          font-weight: 700;
        }
        .pcu-inline-details textarea {
          min-height: 160px;
          margin-top: 6px;
        }
        .pcu-section-block {
          margin-top: 12px;
          padding-top: 12px;
          border-top: 1px solid #d9dde3;
        }
        .pcu-section-block:first-of-type {
          margin-top: 0;
          padding-top: 0;
          border-top: 0;
        }
        .pcu-section-block h3 {
          margin-top: 0;
        }
        .pcu-wide-table {
          min-width: 2600px;
          table-layout: fixed;
        }
        .pcu-wide-table textarea {
          min-height: 48px;
        }
        .pcu-wide-table .pcu-narrow {
          text-align: center;
        }
        .pcu-wide-table .pcu-narrow input[type="checkbox"] {
          width: auto;
        }
        .pcu-view-table-wrap,
        .pcu-editor-matrix-wrap {
          max-height: max(420px, calc(100vh - 382px));
          overflow: auto;
        }
        .pcu-view-table {
          min-width: 1760px;
          table-layout: fixed;
        }
        .pcu-view-table th {
          z-index: 5;
        }
        .pcu-view-table .pcu-sticky-view {
          position: sticky;
          left: 0;
          width: 230px;
          z-index: 3;
          background: #ffffff;
          box-shadow: 1px 0 0 #dfe4ea;
        }
        .pcu-view-table th.pcu-sticky-view {
          z-index: 6;
          background: #f6f7f9;
        }
        .pcu-view-table tr:hover .pcu-sticky-view {
          background: #fbfcfd;
        }
        .pcu-preview-list {
          display: grid;
          gap: 4px;
          margin-top: 6px;
        }
        .pcu-preview-item {
          display: grid;
          grid-template-columns: minmax(0, 1fr) auto;
          gap: 6px;
          align-items: center;
          padding: 3px 6px;
          border: 1px solid #dbe1e7;
          border-radius: 6px;
          background: #f8fafc;
          font-size: 11px;
        }
        .pcu-preview-item.error {
          border-color: #fecaca;
          background: #fff1f2;
        }
        .pcu-editor-matrix {
          min-width: 3400px;
          table-layout: fixed;
        }
        .pcu-editor-matrix th {
          z-index: 5;
        }
        .pcu-editor-matrix .pcu-sticky-col {
          position: sticky;
          z-index: 3;
          background: #ffffff;
        }
        .pcu-editor-matrix th.pcu-sticky-col {
          z-index: 6;
          background: #f6f7f9;
        }
        .pcu-editor-matrix tr:hover .pcu-sticky-col {
          background: #fbfcfd;
        }
        .pcu-editor-matrix .pcu-sticky-group {
          left: 0;
          width: 174px;
        }
        .pcu-editor-matrix .pcu-sticky-order {
          left: 174px;
          width: 58px;
          text-align: center;
        }
        .pcu-editor-matrix .pcu-sticky-item {
          left: 232px;
          width: 286px;
          box-shadow: 1px 0 0 #dfe4ea;
        }
        .pcu-editor-matrix .pcu-placement-cell {
          display: grid;
          gap: 5px;
        }
        .pcu-editor-matrix .pcu-unplaced td {
          background: #f8fafc;
        }
        .pcu-editor-matrix .pcu-unplaced .pcu-sticky-col {
          background: #f8fafc;
        }
        .pcu-diff-table td:first-child {
          border-left: 5px solid transparent;
        }
        .pcu-diff-row-create td:first-child {
          border-left-color: #16a34a;
        }
        .pcu-diff-row-update td:first-child {
          border-left-color: #f59e0b;
        }
        .pcu-diff-row-delete td:first-child {
          border-left-color: #dc2626;
        }
        .pcu-diff-row-skip td:first-child {
          border-left-color: #64748b;
        }
        .pcu-diff-row-create td {
          background: #f0fdf4;
        }
        .pcu-diff-row-update td {
          background: #fffbeb;
        }
        .pcu-diff-row-delete td {
          background: #fff1f2;
        }
        .pcu-diff-row-skip td {
          background: #f8fafc;
        }
        .pcu-diff-path {
          display: grid;
          gap: 3px;
        }
        .pcu-diff-path strong {
          font-size: 12px;
        }
        .pcu-diff-path code {
          color: #475569;
          font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
          font-size: 11px;
          white-space: normal;
          word-break: break-all;
        }
        .pcu-diff-value {
          min-height: 30px;
          max-height: 150px;
          overflow: auto;
          padding: 6px;
          border: 1px solid #d8dee6;
          border-radius: 6px;
          background: rgba(255, 255, 255, .72);
          color: #1f2937;
          font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
          font-size: 11px;
          white-space: pre-wrap;
          word-break: break-word;
        }
        .pcu-diff-value.empty {
          color: #94a3b8;
          font-family: inherit;
        }
        .pcu-change-list {
          display: grid;
          gap: 4px;
        }
        .pcu-change-list div {
          padding: 4px 6px;
          border: 1px solid #e5e7eb;
          border-radius: 6px;
          background: rgba(255, 255, 255, .7);
        }
        .pcu-message.error {
          border-color: #fca5a5;
          background: #fff1f2;
        }
        .pcu-message.warn {
          border-color: #fbbf24;
          background: #fffbeb;
        }
        .pcu-hidden {
          display: none !important;
        }
      </style>
      <div class="pcu-shell" role="dialog" aria-label="プリザンター設定エディタ">
        <div class="pcu-toolbar">
          <div class="pcu-topline">
            <div class="pcu-title">
              <strong>プリザンター設定エディタ</strong>
              <span id="pcu-package-title"></span>
            </div>
            <div class="pcu-actions">
              <button data-action="load-json">JSONを開く</button>
              <button data-action="fetch-source">元テーブル取得</button>
              <button data-action="load-applier">適用JSを読込</button>
              <button data-action="import-tsv">TSV取込</button>
              <button data-action="export-tsv">TSV書出</button>
              <button data-action="export-json">JSON保存</button>
            </div>
          </div>
          <div class="pcu-fields">
            <label>テナント <input id="pcu-tenant-id" data-field="tenantId" size="4"></label>
            <label>元SiteId <input id="pcu-source-site-id" data-field="sourceSiteId" size="5"></label>
            <label>適用先SiteId <input id="pcu-target-site-id" data-field="targetSiteId" size="5"></label>
            <label>APIキー <input id="pcu-api-key" data-field="apiKey" type="password" size="18"></label>
            <label>モード
              <select id="pcu-mode" data-field="mode">
                <option value="replace">完全同期</option>
                <option value="merge">追加更新</option>
              </select>
            </label>
            <label><input id="pcu-unsafe" data-field="allowUnsafeSections" type="checkbox"> 危険設定も含める</label>
            <button data-action="dry-run">差分確認</button>
            <button class="pcu-primary" data-action="apply">適用</button>
            <button data-action="close">閉じる</button>
          </div>
        </div>
        <div class="pcu-workflow" id="pcu-workflow"></div>
        <div class="pcu-main">
          <nav class="pcu-nav" id="pcu-nav"></nav>
          <main class="pcu-panel" id="pcu-panel"></main>
        </div>
        <div class="pcu-log" id="pcu-log"></div>
      </div>
    `;

    shadow.addEventListener("click", onClick);
    shadow.addEventListener("input", onInput);
    shadow.addEventListener("change", onInput);
  }

  async function onClick(event) {
    const target = event.target.closest("[data-action]");
    if (!target) return;
    const action = target.dataset.action;
    try {
      if (action === "close") close();
      else if (action === "load-json") await loadJsonFile();
      else if (action === "fetch-source") await fetchSourceSettings();
      else if (action === "load-applier") await loadApplierFile();
      else if (action === "import-tsv") await importTsvFile();
      else if (action === "export-tsv") exportTsvForActiveSection();
      else if (action === "export-json") exportWorkingPackage();
      else if (action === "dry-run") await dryRun();
      else if (action === "apply") await apply();
      else if (action === "section") {
        state.activeSection = target.dataset.section;
        render();
      } else if (action === "add-view") addView();
      else if (action === "delete-view") deleteView(Number(target.dataset.index));
      else if (action === "move-view") moveView(Number(target.dataset.index), Number(target.dataset.delta));
      else if (action === "add-editor-group") addEditorGroup();
      else if (action === "delete-editor-group") deleteEditorGroup(target.dataset.group);
      else if (action === "add-editor-item") addEditorItem(target.dataset.group);
      else if (action === "delete-editor-item") deleteEditorItem(target.dataset.group, Number(target.dataset.index));
      else if (action === "move-editor-item") moveEditorItem(target.dataset.group, Number(target.dataset.index), Number(target.dataset.delta));
      else if (action === "place-column") placeColumnInEditor(target.dataset.columnName);
      else if (action === "ensure-editor-column") ensureEditorColumnSetting(target.dataset.columnName);
      else if (action === "add-column-field") addColumnField();
      else if (action === "add-column") addColumn();
      else if (action === "delete-column") deleteColumn(Number(target.dataset.index));
      else if (action === "format-raw") formatRawJson();
      else if (action === "apply-raw") applyRawJson();
      else if (action === "copy-json") await copyText(JSON.stringify(buildWorkingPackage(), null, 2));
    } catch (error) {
      logError(error.message || String(error));
    }
  }

  function onInput(event) {
    const element = event.target;
    if (element.dataset.field) {
      const field = element.dataset.field;
      state[field] = element.type === "checkbox" ? element.checked : element.value;
      if (field === "apiKey" && element.value) {
        sessionStorage.setItem("PleasanterConfigEditor.apiKey", element.value);
      }
      renderHeaderOnly();
      return;
    }

    if (element.dataset.viewField) {
      updateViewField(
        Number(element.dataset.index),
        element.dataset.viewField,
        element.type === "checkbox" ? element.checked : element.value
      );
      return;
    }

    if (element.dataset.viewJsonField) {
      updateViewJsonField(Number(element.dataset.index), element.dataset.viewJsonField, element.value);
      return;
    }

    if (element.dataset.editorGroupName) {
      renameEditorGroup(element.dataset.editorGroupName, element.value);
      return;
    }

    if (element.dataset.editorGroupItems) {
      setEditorGroupItems(element.dataset.editorGroupItems, element.value);
      return;
    }

    if (element.dataset.editorItemGroup) {
      setEditorItemColumn(element.dataset.editorItemGroup, Number(element.dataset.index), element.value);
      return;
    }

    if (element.dataset.columnField) {
      updateColumnField(
        Number(element.dataset.index),
        element.dataset.columnField,
        element.type === "checkbox" ? element.checked : element.value
      );
    }
  }

  function render() {
    if (!shadow) return;
    state.validation = validateSettings(state.workingSettings);
    renderHeaderOnly();
    renderWorkflow();
    renderNav();
    renderPanel();
    renderLog();
  }

  function renderHeaderOnly() {
    if (!shadow) return;
    setValue("pcu-tenant-id", state.tenantId);
    setValue("pcu-source-site-id", state.sourceSiteId);
    setValue("pcu-target-site-id", state.targetSiteId);
    setValue("pcu-api-key", state.apiKey);
    setValue("pcu-mode", state.mode);
    const unsafe = shadow.getElementById("pcu-unsafe");
    if (unsafe) unsafe.checked = state.allowUnsafeSections;

    const title = shadow.getElementById("pcu-package-title");
    if (title) {
      const bits = [
        state.packageFileName || "JSON未読込",
        state.siteTitle ? `テーブル: ${state.siteTitle}` : "",
        hasApplier() ? "適用JS: 読込済み" : "適用JS: 未読込"
      ].filter(Boolean);
      title.textContent = bits.join(" / ");
    }
  }

  function renderWorkflow() {
    const workflow = shadow.getElementById("pcu-workflow");
    if (!workflow) return;
    const steps = [
      ["読込", state.packageFileName ? state.packageFileName : "JSONを開くか元テーブル取得"],
      ["編集", `${state.workingSettings.Views?.length || 0} ビュー / ${state.workingSettings.Columns?.length || 0} 項目`],
      ["確認", state.dryRun ? summarizeOperations(state.dryRun.plan?.summary) : "差分確認待ち"],
      ["適用", state.applyResult ? `完了: ${state.applyResult.postApplyCompare?.equal ? "一致" : "差分あり"}` : "未適用"]
    ];
    workflow.innerHTML = steps.map(([title, detail], index) => `
      <div class="pcu-step">
        <span class="pcu-step-number">${index + 1}</span>
        <span><strong>${escapeHtml(title)}</strong><span class="pcu-step-detail">${escapeHtml(detail)}</span></span>
      </div>
    `).join("");
  }

  function renderNav() {
    const nav = shadow.getElementById("pcu-nav");
    nav.innerHTML = sections.map((section) => {
      const badge = sectionBadge(section);
      return `
        <button data-action="section" data-section="${escapeHtml(section)}" aria-current="${state.activeSection === section}">
          <span>
            <span class="pcu-nav-title">${escapeHtml(sectionLabel(section))}</span>
            <span class="pcu-nav-subtitle">${escapeHtml(sectionSubtitle(section))}</span>
          </span>
          ${badge ? `<span class="pcu-badge ${badge.kind}">${escapeHtml(badge.text)}</span>` : ""}
        </button>
      `;
    }).join("");
  }

  function sectionLabel(section) {
    return sectionLabels[section] || section;
  }

  function sectionSubtitle(section) {
    return {
      Summary: "読込状態とエラー",
      Views: "一覧・カンバン・条件",
      Editor: "配置と項目詳細",
      "Raw JSON": "直接編集",
      Diff: "変更内容と適用結果"
    }[section] || "";
  }

  function sectionBadge(section) {
    if (section === "Summary") {
      const count = state.validation.errors.length + state.validation.warnings.length;
      if (!count) return null;
      return { text: String(count), kind: state.validation.errors.length ? "error" : "warn" };
    }
    if (section === "Diff" && state.dryRun?.plan?.operations) {
      return { text: String(state.dryRun.plan.operations.length), kind: "" };
    }
    if (section === "Views") return countBadge(state.workingSettings.Views);
    if (section === "Editor") {
      const groupCount = Object.keys(state.workingSettings.EditorColumnHash || {}).length;
      const columnCount = state.workingSettings.Columns?.length || 0;
      return groupCount || columnCount ? { text: `${groupCount}/${columnCount}`, kind: "" } : null;
    }
    if (section === "Raw JSON") return { text: String(Object.keys(state.workingSettings || {}).length), kind: "" };
    return null;
  }

  function countBadge(value) {
    const count = Array.isArray(value) ? value.length : 0;
    return count ? { text: String(count), kind: "" } : null;
  }

  function renderPanel() {
    const panel = shadow.getElementById("pcu-panel");
    if (state.activeSection === "Summary") panel.innerHTML = renderSummary();
    else if (state.activeSection === "Views") panel.innerHTML = renderViews();
    else if (state.activeSection === "Editor") panel.innerHTML = renderEditor();
    else if (state.activeSection === "Raw JSON") panel.innerHTML = renderRawJson();
    else if (state.activeSection === "Diff") panel.innerHTML = renderDiff();
  }

  function renderSummary() {
    const settings = state.workingSettings || {};
    const unsafeInPackage = Object.keys(settings).filter((key) => unsafeSections.has(key));
    const metrics = [
      ["設定セクション", Object.keys(settings).length],
      ["ビュー", settings.Views?.length || 0],
      ["エディタ枠", Object.keys(settings.EditorColumnHash || {}).length],
      ["項目", settings.Columns?.length || 0],
      ["エラー", state.validation.errors.length],
      ["警告", state.validation.warnings.length],
      ["危険設定", unsafeInPackage.length],
      ["変更", state.dirty ? "あり" : "なし"]
    ];
    return `
      <div class="pcu-section-head">
        <div>
          <h2>概要</h2>
          <p>読み込んだ設定、検証結果、適用前後の状態を確認します。</p>
        </div>
      </div>
      <div class="pcu-grid" style="grid-template-columns: repeat(4, minmax(120px, 1fr)); margin-bottom: 12px;">
        ${metrics.map(([label, value]) => `
          <div class="pcu-metric">
            <div class="label">${escapeHtml(label)}</div>
            <div class="value">${escapeHtml(String(value))}</div>
          </div>
        `).join("")}
      </div>
      <h3>検証結果</h3>
      ${renderMessages()}
      <h3>SiteSettings</h3>
      <div class="pcu-table-wrap">
        <table>
          <thead><tr><th>キー</th><th>種類</th><th>内容</th><th>安全</th></tr></thead>
          <tbody>
            ${Object.keys(settings).sort().map((key) => `
              <tr>
                <td>${escapeHtml(key)}</td>
                <td>${escapeHtml(valueType(settings[key]))}</td>
                <td>${escapeHtml(valueSummary(settings[key]))}</td>
                <td>${unsafeSections.has(key) ? '<span class="pcu-badge warn">unsafe</span>' : ''}</td>
              </tr>
            `).join("") || '<tr><td colspan="4">設定は未読込です。</td></tr>'}
          </tbody>
        </table>
      </div>
    `;
  }

  function renderMessages() {
    const messages = [
      ...state.validation.errors.map((message) => ({ kind: "error", message })),
      ...state.validation.warnings.map((message) => ({ kind: "warn", message }))
    ];
    if (messages.length === 0) return '<div class="pcu-empty">エラーはありません。</div>';
    return `<div class="pcu-errors">${messages.map((item) => `
      <div class="pcu-message ${item.kind}">${escapeHtml(item.message)}</div>
    `).join("")}</div>`;
  }

  function renderViews() {
    const views = ensureArray("Views");
    const modes = [
      ["Index", "一覧"],
      ["Kamban", "カンバン"],
      ["Calendar", "カレンダー"]
    ];
    return `
      <div class="pcu-section-head">
        <div>
          <h2>ビュー</h2>
          <p>一覧、カンバン、カレンダーごとの表示列、絞り込み、並び替えを編集します。</p>
        </div>
        <button data-action="add-view">ビュー追加</button>
      </div>
      <div class="pcu-message" style="margin-bottom: 10px;">
        <strong>ビュー名とヘッダーは固定表示です。</strong>
        <span class="pcu-muted">表示項目、フィルタ、ソートの対象項目は表示名付きで確認できます。</span>
      </div>
      <div class="pcu-table-wrap pcu-view-table-wrap">
        <table class="pcu-view-table">
          <thead>
            <tr>
              <th class="pcu-sticky-view">名称</th>
              <th style="width: 130px;">表示</th>
              <th style="width: 360px;">表示項目</th>
              <th style="width: 310px;">フィルタ</th>
              <th style="width: 290px;">ソート</th>
              <th style="width: 150px;">フィルタボタン</th>
              <th style="width: 170px;">操作</th>
            </tr>
          </thead>
          <tbody>
            ${views.map((view, index) => `
              <tr>
                <td class="pcu-sticky-view">
                  <div class="pcu-field-stack">
                    <input data-index="${index}" data-view-field="Name" value="${escapeAttr(view.Name || "")}">
                    <span class="pcu-key">Views[${index}]</span>
                  </div>
                </td>
                <td>
                  <select data-index="${index}" data-view-field="DefaultMode">
                    ${modes.map(([mode, label]) => `
                      <option value="${mode}" ${view.DefaultMode === mode ? "selected" : ""}>${label}</option>
                    `).join("")}
                  </select>
                </td>
                <td>
                  <textarea placeholder="項目名を1行ずつ入力" data-index="${index}" data-view-field="GridColumns">${escapeHtml(arrayToLines(view.GridColumns))}</textarea>
                  ${renderViewColumnPreview(view.GridColumns)}
                </td>
                <td>
                  <textarea placeholder='例: {"Status":"[\"300\"]"}' data-index="${index}" data-view-json-field="ColumnFilterHash">${escapeHtml(formatInlineJson(view.ColumnFilterHash || {}))}</textarea>
                  ${renderViewHashPreview(view.ColumnFilterHash)}
                </td>
                <td>
                  <textarea placeholder='例: {"UpdatedTime":"desc"}' data-index="${index}" data-view-json-field="ColumnSorterHash">${escapeHtml(formatInlineJson(view.ColumnSorterHash || {}))}</textarea>
                  ${renderViewHashPreview(view.ColumnSorterHash)}
                </td>
                <td class="pcu-narrow">
                  <label>
                    <input type="checkbox" data-index="${index}" data-view-field="UseFilterButton" ${view.UseFilterButton ? "checked" : ""}>
                    使用する
                  </label>
                </td>
                <td>
                  <div class="pcu-row-actions">
                    <button data-action="move-view" data-index="${index}" data-delta="-1" ${index === 0 ? "disabled" : ""}>上へ</button>
                    <button data-action="move-view" data-index="${index}" data-delta="1" ${index === views.length - 1 ? "disabled" : ""}>下へ</button>
                    <button class="pcu-danger" data-action="delete-view" data-index="${index}">削除</button>
                  </div>
                </td>
              </tr>
            `).join("") || '<tr><td colspan="7">ビューはありません。</td></tr>'}
          </tbody>
        </table>
      </div>
    `;
  }

  function renderViewColumnPreview(columnNames) {
    const names = Array.isArray(columnNames) ? columnNames.map(String).filter(Boolean) : [];
    if (names.length === 0) return '<div class="pcu-muted" style="margin-top: 6px;">表示項目はありません。</div>';
    const validColumns = collectValidColumnNames(state.workingSettings);
    return `
      <div class="pcu-preview-list">
        ${names.map((columnName) => {
          const valid = validColumns.has(columnName);
          return `
            <div class="pcu-preview-item ${valid ? "" : "error"}">
              <span>${escapeHtml(valid ? columnDisplayName(columnName, state.workingSettings) : "未定義項目")}</span>
              <span class="pcu-key">${escapeHtml(columnName)}</span>
            </div>
          `;
        }).join("")}
      </div>
    `;
  }

  function renderViewHashPreview(hash) {
    const entries = Object.entries(isPlainObject(hash) ? hash : {});
    if (entries.length === 0) return '<div class="pcu-muted" style="margin-top: 6px;">条件はありません。</div>';
    const validColumns = collectValidColumnNames(state.workingSettings);
    return `
      <div class="pcu-preview-list">
        ${entries.map(([columnName, value]) => {
          const valid = validColumns.has(columnName);
          return `
            <div class="pcu-preview-item ${valid ? "" : "error"}" title="${escapeAttr(previewJson(value))}">
              <span>${escapeHtml(valid ? columnDisplayName(columnName, state.workingSettings) : "未定義項目")}</span>
              <span class="pcu-key">${escapeHtml(columnName)}</span>
            </div>
          `;
        }).join("")}
      </div>
    `;
  }

  function renderEditorLayout() {
    const hash = ensureObject("EditorColumnHash");
    const entries = Object.entries(hash);
    const validColumns = collectValidColumnNames(state.workingSettings);
    const totalItems = entries.reduce((total, [, items]) => total + (Array.isArray(items) ? items.length : 0), 0);
    const missingItems = entries.flatMap(([, items]) => items || []).filter((name) => !validColumns.has(String(name)));
    return `
      <div class="pcu-section-head">
        <div>
          <h2>エディタ配置</h2>
          <p>入力画面の見出し、表示順、項目表示名をまとめて確認・編集します。</p>
        </div>
        <button data-action="add-editor-group">見出し追加</button>
      </div>
      <div class="pcu-editor-summary">
        <div class="pcu-editor-summary-item">
          <span>見出し数</span>
          <strong>${entries.length}</strong>
        </div>
        <div class="pcu-editor-summary-item">
          <span>配置済み項目</span>
          <strong>${totalItems}</strong>
        </div>
        <div class="pcu-editor-summary-item">
          <span>未定義参照</span>
          <strong>${missingItems.length}</strong>
        </div>
      </div>
      <div class="pcu-table-wrap">
        <table>
          <thead>
            <tr>
              <th style="width: 54px;">順</th>
              <th style="width: 260px;">表示名 / 項目キー</th>
              <th style="width: 110px;">種類</th>
              <th style="width: 82px;">必須</th>
              <th style="width: 128px;">入力形式</th>
              <th>設定メモ</th>
              <th style="width: 170px;">操作</th>
            </tr>
          </thead>
          <tbody>
            ${entries.map(([group, items]) => renderEditorGroupRows(group, Array.isArray(items) ? items : [])).join("") || '<tr><td colspan="7">エディタ配置はありません。</td></tr>'}
          </tbody>
        </table>
      </div>
    `;
  }

  function renderEditor() {
    const rows = editorMatrixRows(state.workingSettings);
    const fields = columnDetailFields(state.workingSettings).filter((field) => field !== "ColumnName");
    const summary = editorMatrixSummary(rows);
    return `
      <div class="pcu-section-head">
        <div>
          <h2>エディタ</h2>
          <p>見出し、順番、項目名、項目詳細を1つの表で編集します。</p>
        </div>
        <div class="pcu-row-actions">
          <button data-action="add-editor-group">見出し追加</button>
          <button data-action="add-column">項目追加</button>
          <button data-action="add-column-field">詳細列追加</button>
        </div>
      </div>
      <div class="pcu-editor-summary">
        <div class="pcu-editor-summary-item">
          <span>見出し数</span>
          <strong>${summary.groupCount}</strong>
        </div>
        <div class="pcu-editor-summary-item">
          <span>配置済み項目</span>
          <strong>${summary.placedCount}</strong>
        </div>
        <div class="pcu-editor-summary-item">
          <span>未配置項目</span>
          <strong>${summary.unplacedCount}</strong>
        </div>
      </div>
      <div class="pcu-message" style="margin-bottom: 10px;">
        <strong>ヘッダーと左3列は固定表示です。</strong>
        <span class="pcu-muted">縦横にスクロールしても、見出し、順番、項目名を見失わずに編集できます。</span>
      </div>
      <div class="pcu-table-wrap pcu-editor-matrix-wrap">
        <table class="pcu-editor-matrix">
          <thead>
            <tr>
              <th class="pcu-sticky-col pcu-sticky-group">見出し</th>
              <th class="pcu-sticky-col pcu-sticky-order">順</th>
              <th class="pcu-sticky-col pcu-sticky-item">項目</th>
              <th style="width: 96px;">種類</th>
              <th style="width: 150px;">操作</th>
              ${fields.map((field) => `<th style="width: ${columnFieldWidth(field)}px;" title="${escapeAttr(field)}">${escapeHtml(columnFieldLabel(field))}</th>`).join("")}
            </tr>
          </thead>
          <tbody>
            ${rows.map((row) => renderEditorMatrixRow(row, fields)).join("") || `<tr><td colspan="${fields.length + 5}">エディタ項目はありません。</td></tr>`}
          </tbody>
        </table>
      </div>
    `;
  }

  function renderEditorMatrixRow(row, fields) {
    const columnIndex = row.column ? findColumnIndex(state.workingSettings, row.columnName) : -1;
    return `
      <tr class="${row.placed ? "" : "pcu-unplaced"}">
        <td class="pcu-sticky-col pcu-sticky-group">${renderEditorGroupCell(row)}</td>
        <td class="pcu-sticky-col pcu-sticky-order">${row.placed ? row.index + 1 : "-"}</td>
        <td class="pcu-sticky-col pcu-sticky-item">${renderEditorItemCell(row)}</td>
        <td><span class="pcu-pill ${row.missing ? "error" : ""}">${escapeHtml(row.missing ? "未定義" : columnKindLabel(row.columnName))}</span></td>
        <td>${renderEditorMatrixActions(row)}</td>
        ${fields.map((field, fieldIndex) => renderEditorMatrixFieldCell(row, columnIndex, field, fieldIndex)).join("")}
      </tr>
    `;
  }

  function renderEditorGroupCell(row) {
    if (row.placed) {
      return `
        <div class="pcu-placement-cell">
          <input data-editor-group-name="${escapeAttr(row.group)}" value="${escapeAttr(row.group)}">
          <span class="pcu-muted">${row.groupLength} 項目</span>
        </div>
      `;
    }
    const groups = Object.keys(ensureObject("EditorColumnHash"));
    return `
      <div class="pcu-placement-cell">
        <span class="pcu-pill">未配置</span>
        <select data-place-group-for="${escapeAttr(row.columnName)}">
          ${groups.map((group) => `<option value="${escapeAttr(group)}">${escapeHtml(group)}</option>`).join("")}
        </select>
      </div>
    `;
  }

  function renderEditorItemCell(row) {
    return `
      <div class="pcu-editor-item-name">
        <strong>${escapeHtml(columnDisplayName(row.columnName, state.workingSettings))}</strong>
        ${row.placed ? `
          <select data-editor-item-group="${escapeAttr(row.group)}" data-index="${row.index}">
            ${renderColumnOptions(row.columnName, state.workingSettings)}
          </select>
          <span class="pcu-key">${escapeHtml(row.columnName)}</span>
        ` : `<span class="pcu-key">${escapeHtml(row.columnName)}</span>`}
      </div>
    `;
  }

  function renderEditorMatrixActions(row) {
    if (!row.placed) {
      return `
        <div class="pcu-row-actions">
          <button data-action="place-column" data-column-name="${escapeAttr(row.columnName)}" ${Object.keys(ensureObject("EditorColumnHash")).length ? "" : "disabled"}>配置</button>
          <button class="pcu-danger" data-action="delete-column" data-index="${findColumnIndex(state.workingSettings, row.columnName)}">削除</button>
        </div>
      `;
    }
    return `
      <div class="pcu-row-actions">
        <button data-action="move-editor-item" data-group="${escapeAttr(row.group)}" data-index="${row.index}" data-delta="-1" ${row.index === 0 ? "disabled" : ""}>上へ</button>
        <button data-action="move-editor-item" data-group="${escapeAttr(row.group)}" data-index="${row.index}" data-delta="1" ${row.index === row.groupLength - 1 ? "disabled" : ""}>下へ</button>
        <button data-action="add-editor-item" data-group="${escapeAttr(row.group)}">追加</button>
        <button class="pcu-danger" data-action="delete-editor-item" data-group="${escapeAttr(row.group)}" data-index="${row.index}">外す</button>
      </div>
    `;
  }

  function renderEditorMatrixFieldCell(row, columnIndex, field, fieldIndex) {
    if (columnIndex >= 0) return renderColumnFieldCell(row.column, columnIndex, field);
    if (fieldIndex > 0) return '<td></td>';
    return `
      <td>
        <span class="pcu-muted">項目設定なし</span>
        <div style="margin-top: 6px;">
          <button data-action="ensure-editor-column" data-column-name="${escapeAttr(row.columnName)}">項目設定を追加</button>
        </div>
      </td>
    `;
  }

  function editorMatrixRows(settings) {
    const hash = ensureObject("EditorColumnHash");
    const rows = [];
    const placedColumnNames = new Set();
    const validColumns = collectValidColumnNames(settings);

    for (const [group, items] of Object.entries(hash)) {
      const list = Array.isArray(items) ? items : [];
      list.forEach((columnName, index) => {
        const name = String(columnName || "");
        placedColumnNames.add(name);
        rows.push({
          placed: true,
          group,
          index,
          groupLength: list.length,
          columnName: name,
          column: findColumn(settings, name),
          missing: !validColumns.has(name)
        });
      });
    }

    for (const column of ensureArray("Columns")) {
      const name = String(column?.ColumnName || "");
      if (!name || placedColumnNames.has(name)) continue;
      rows.push({
        placed: false,
        group: "",
        index: -1,
        groupLength: 0,
        columnName: name,
        column,
        missing: !validColumns.has(name)
      });
    }

    return rows;
  }

  function editorMatrixSummary(rows) {
    return {
      groupCount: Object.keys(ensureObject("EditorColumnHash")).length,
      placedCount: rows.filter((row) => row.placed).length,
      unplacedCount: rows.filter((row) => !row.placed).length
    };
  }

  function renderEditorLayoutBody() {
    const hash = ensureObject("EditorColumnHash");
    const entries = Object.entries(hash);
    const validColumns = collectValidColumnNames(state.workingSettings);
    const totalItems = entries.reduce((total, [, items]) => total + (Array.isArray(items) ? items.length : 0), 0);
    const missingItems = entries.flatMap(([, items]) => items || []).filter((name) => !validColumns.has(String(name)));
    return `
      <div class="pcu-editor-summary">
        <div class="pcu-editor-summary-item">
          <span>見出し数</span>
          <strong>${entries.length}</strong>
        </div>
        <div class="pcu-editor-summary-item">
          <span>配置済み項目</span>
          <strong>${totalItems}</strong>
        </div>
        <div class="pcu-editor-summary-item">
          <span>未定義参照</span>
          <strong>${missingItems.length}</strong>
        </div>
      </div>
      <div class="pcu-table-wrap">
        <table>
          <thead>
            <tr>
              <th style="width: 54px;">順</th>
              <th style="width: 260px;">表示名 / 項目キー</th>
              <th style="width: 110px;">種類</th>
              <th style="width: 82px;">必須</th>
              <th style="width: 128px;">入力形式</th>
              <th>設定メモ</th>
              <th style="width: 170px;">操作</th>
            </tr>
          </thead>
          <tbody>
            ${entries.map(([group, items]) => renderEditorGroupRows(group, Array.isArray(items) ? items : [])).join("") || '<tr><td colspan="7">エディタ配置はありません。</td></tr>'}
          </tbody>
        </table>
      </div>
    `;
  }

  function renderEditorGroupRows(group, items) {
    return `
      <tr class="pcu-editor-group-row">
        <td colspan="7">
          <div class="pcu-editor-group-bar">
            <div class="pcu-editor-group-title">
              <label>見出し <input data-editor-group-name="${escapeAttr(group)}" value="${escapeAttr(group)}"></label>
              <span class="pcu-muted">${items.length} 項目</span>
            </div>
            <div class="pcu-row-actions">
              <button data-action="add-editor-item" data-group="${escapeAttr(group)}">項目追加</button>
              <button class="pcu-danger" data-action="delete-editor-group" data-group="${escapeAttr(group)}">見出し削除</button>
            </div>
          </div>
        </td>
      </tr>
      ${items.map((columnName, index) => renderEditorItemRow(group, columnName, index, items.length)).join("") || `
        <tr>
          <td></td>
          <td colspan="6"><span class="pcu-muted">この見出しにはまだ項目がありません。</span></td>
        </tr>
      `}
    `;
  }

  function renderEditorItemRow(group, columnName, index, groupLength) {
    const column = findColumn(state.workingSettings, columnName);
    const missing = !collectValidColumnNames(state.workingSettings).has(String(columnName));
    return `
      <tr>
        <td>${index + 1}</td>
        <td>
          <div class="pcu-editor-item-name">
            <strong>${escapeHtml(columnDisplayName(columnName, state.workingSettings))}</strong>
            <select data-editor-item-group="${escapeAttr(group)}" data-index="${index}">
              ${renderColumnOptions(columnName, state.workingSettings)}
            </select>
            <span class="pcu-key">${escapeHtml(columnName)}</span>
          </div>
        </td>
        <td><span class="pcu-pill ${missing ? "error" : ""}">${escapeHtml(missing ? "未定義" : columnKindLabel(columnName))}</span></td>
        <td>${column?.Required ? '<span class="pcu-pill warn">必須</span>' : '<span class="pcu-muted">任意</span>'}</td>
        <td>${escapeHtml(controlTypeLabel(column?.ControlType))}</td>
        <td>
          <div class="pcu-editor-note">${renderColumnNote(columnName, column)}</div>
          ${column ? "" : `<div style="margin-top: 6px;"><button data-action="ensure-editor-column" data-column-name="${escapeAttr(columnName)}">項目設定を追加</button></div>`}
        </td>
        <td>
          <div class="pcu-row-actions">
            <button data-action="move-editor-item" data-group="${escapeAttr(group)}" data-index="${index}" data-delta="-1" ${index === 0 ? "disabled" : ""}>上へ</button>
            <button data-action="move-editor-item" data-group="${escapeAttr(group)}" data-index="${index}" data-delta="1" ${index === groupLength - 1 ? "disabled" : ""}>下へ</button>
            <button class="pcu-danger" data-action="delete-editor-item" data-group="${escapeAttr(group)}" data-index="${index}">削除</button>
          </div>
        </td>
      </tr>
    `;
  }

  function renderColumns() {
    return `
      <div class="pcu-section-head">
        <div>
          <h2>項目設定</h2>
          <p>表示名、必須、選択肢、既定値、入力形式などを項目ごとに編集します。</p>
        </div>
        <div class="pcu-row-actions">
          <button data-action="add-column">項目追加</button>
          <button data-action="add-column-field">詳細列追加</button>
        </div>
      </div>
      ${renderColumnsBody()}
    `;
  }

  function renderColumnsBody() {
    const columns = ensureArray("Columns");
    const fields = columnDetailFields(state.workingSettings);
    return `
      <div class="pcu-message" style="margin-bottom: 10px;">
        <strong>横スクロールで全項目を編集できます。</strong>
        <span class="pcu-muted">サイトパッケージ内の Columns に存在するキーはすべて列として表示します。足りないキーは「詳細列追加」から追加できます。</span>
      </div>
      <div class="pcu-table-wrap">
        <table class="pcu-wide-table">
          <thead>
            <tr>
              ${fields.map((field) => `<th style="width: ${columnFieldWidth(field)}px;">${escapeHtml(columnFieldLabel(field))}<br><span class="pcu-key">${escapeHtml(field)}</span></th>`).join("")}
              <th style="width: 72px;">操作</th>
            </tr>
          </thead>
          <tbody>
            ${columns.map((column, index) => `
              <tr>
                ${fields.map((field) => renderColumnFieldCell(column, index, field)).join("")}
                <td><button class="pcu-danger" data-action="delete-column" data-index="${index}">削除</button></td>
              </tr>
            `).join("") || `<tr><td colspan="${fields.length + 1}">項目設定はありません。</td></tr>`}
          </tbody>
        </table>
      </div>
    `;
  }

  function columnDetailFields(settings) {
    const fields = new Set(preferredColumnFields);
    for (const field of state.extraColumnFields || []) fields.add(field);
    for (const column of settings.Columns || []) {
      for (const key of Object.keys(column || {})) fields.add(key);
    }
    return [...fields].filter(Boolean);
  }

  function renderColumnFieldCell(column, index, field) {
    const value = column?.[field];
    const common = `data-index="${index}" data-column-field="${escapeAttr(field)}"`;
    if (booleanColumnFields.has(field)) {
      return `<td class="pcu-narrow"><input type="checkbox" ${common} ${value ? "checked" : ""}></td>`;
    }
    if (field === "ControlType") {
      return `<td>${renderSelect(common, value, ["", "Normal", "MarkDown", "RTEditor", "Spinner"])}</td>`;
    }
    if (field === "FieldCss") {
      return `<td>${renderSelect(common, value, allowedFieldCssValues(column.ColumnName, column))}</td>`;
    }
    if (field === "TextAlign") {
      return `<td>${renderSelect(common, value, ["", "left", "center", "right"])}</td>`;
    }
    if (field === "EditorFormat") {
      return `<td>${renderSelect(common, value, ["", "Ymd", "Ymdhm", "Ymdhms"])}</td>`;
    }
    if (field === "ChoicesText" || field === "Description" || String(value || "").includes("\n") || isPlainObject(value) || Array.isArray(value)) {
      return `<td><textarea ${common} placeholder="${escapeAttr(columnFieldPlaceholder(field, value))}">${escapeHtml(columnFieldInputValue(value))}</textarea></td>`;
    }
    if (numberColumnFields.has(field) || typeof value === "number") {
      return `<td><input type="number" ${common} value="${escapeAttr(value ?? "")}"></td>`;
    }
    return `<td><input ${common} value="${escapeAttr(value ?? "")}"></td>`;
  }

  function renderSelect(commonAttributes, value, options) {
    return `
      <select ${commonAttributes}>
        ${options.map((option) => `
          <option value="${escapeAttr(option)}" ${String(value ?? "") === String(option) ? "selected" : ""}>${escapeHtml(option || "(default)")}</option>
        `).join("")}
      </select>
    `;
  }

  function columnFieldInputValue(value) {
    if (isPlainObject(value) || Array.isArray(value)) return JSON.stringify(value, null, 2);
    return value ?? "";
  }

  function columnFieldPlaceholder(field, value) {
    if (field === "ChoicesText") return "10,選択肢A\n20,選択肢B";
    if (isPlainObject(value) || Array.isArray(value)) return "JSON";
    return "";
  }

  function columnFieldWidth(field) {
    if (field === "ColumnName") return 130;
    if (field === "LabelText" || field === "GridLabelText" || field === "Description") return 180;
    if (booleanColumnFields.has(field)) return 82;
    if (field === "ChoicesText") return 250;
    if (field === "DefaultInput") return 130;
    if (field === "ControlType" || field === "FieldCss" || field === "EditorFormat") return 135;
    return 145;
  }

  function columnFieldLabel(field) {
    return settingPropertyLabel(field);
  }

  function renderRawJson() {
    return `
      <div class="pcu-section-head">
        <div>
          <h2>JSON</h2>
          <p>フォーム化していない設定を直接確認・編集します。</p>
        </div>
        <div class="pcu-row-actions">
          <button data-action="format-raw">整形</button>
          <button data-action="apply-raw">JSONを反映</button>
          <button data-action="copy-json">コピー</button>
        </div>
      </div>
      <textarea id="pcu-raw-json" class="pcu-code">${escapeHtml(JSON.stringify(state.workingSettings || {}, null, 2))}</textarea>
    `;
  }

  function renderDiff() {
    const localDiff = compareSettingsDetailed(state.sourceSettings, state.workingSettings);
    const dryOps = state.dryRun?.plan?.operations || [];
    const post = state.applyResult?.postApplyCompare;
    const postDiff = post ? detailedDifferencesFromCompareResult(post) : [];
    return `
      <div class="pcu-section-head">
        <div>
          <h2>差分確認</h2>
          <p>どの設定を、何から何へ変更するかを確認します。</p>
        </div>
      </div>
      <div class="pcu-grid three" style="margin-bottom: 12px;">
        <div class="pcu-metric"><div class="label">編集中の差分</div><div class="value">${localDiff.length}</div></div>
        <div class="pcu-metric"><div class="label">適用予定の操作</div><div class="value">${dryOps.length}</div></div>
        <div class="pcu-metric"><div class="label">適用後一致</div><div class="value">${post ? (post.equal ? "一致" : "差分あり") : "-"}</div></div>
      </div>
      <h3>編集中の変更詳細</h3>
      ${renderDetailedDiffTable(localDiff)}
      <h3>dry-run 操作</h3>
      ${renderOperationsTable(dryOps)}
      <h3>適用後比較</h3>
      ${post ? renderDetailedDiffTable(postDiff) : '<div class="pcu-empty">まだ適用していません。</div>'}
    `;
  }

  function renderSimpleDiffTable(items) {
    if (!items.length) return '<div class="pcu-empty">差分はありません。</div>';
    return `
      <div class="pcu-table-wrap">
        <table>
          <thead><tr><th>種類</th><th>セクション</th><th>元</th><th>変更後</th></tr></thead>
          <tbody>
            ${items.map((item) => `
              <tr>
                <td>${escapeHtml(item.type || "different")}</td>
                <td>${escapeHtml(item.section || item.key || "")}</td>
                <td><textarea readonly>${escapeHtml(previewJson(item.source ?? item.before))}</textarea></td>
                <td><textarea readonly>${escapeHtml(previewJson(item.target ?? item.after))}</textarea></td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>
    `;
  }

  function renderDetailedDiffTable(items) {
    if (!items.length) return '<div class="pcu-empty">差分はありません。</div>';
    return `
      <div class="pcu-table-wrap">
        <table class="pcu-diff-table">
          <thead>
            <tr>
              <th style="width: 92px;">変更</th>
              <th style="width: 270px;">場所</th>
              <th>変更前</th>
              <th>変更後</th>
            </tr>
          </thead>
          <tbody>
            ${items.map((item) => `
              <tr class="pcu-diff-row-${escapeAttr(item.type)}">
                <td>${renderChangeBadge(item.type)}</td>
                <td>
                  <div class="pcu-diff-path">
                    <strong>${escapeHtml(item.label || item.section || "")}</strong>
                    <code>${escapeHtml(item.path || item.section || "")}</code>
                  </div>
                </td>
                <td>${renderDiffValue(item.before)}</td>
                <td>${renderDiffValue(item.after)}</td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>
    `;
  }

  function renderOperationsTable(operations) {
    if (!operations.length) return '<div class="pcu-empty">dry-run の操作はありません。</div>';
    return `
      <div class="pcu-table-wrap">
        <table class="pcu-diff-table">
          <thead>
            <tr>
              <th style="width: 86px;">操作</th>
              <th style="width: 220px;">対象</th>
              <th>何が変わるか</th>
              <th style="width: 180px;">理由</th>
            </tr>
          </thead>
          <tbody>
            ${operations.map((operation) => `
              <tr class="pcu-diff-row-${escapeAttr(operation.type || "")}">
                <td>${renderChangeBadge(operation.type)}</td>
                <td>
                  <div class="pcu-diff-path">
                    <strong>${escapeHtml(operation.key || operation.section || "")}</strong>
                    <code>${escapeHtml(operation.section || "")}</code>
                  </div>
                </td>
                <td>${renderOperationChange(operation)}</td>
                <td>${escapeHtml(operation.reason || "")}</td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>
    `;
  }

  function renderChangeBadge(type) {
    const labels = {
      create: "追加",
      update: "更新",
      delete: "削除",
      skip: "除外",
      missing: "削除",
      extra: "追加",
      different: "更新"
    };
    const badgeKind = type === "delete" || type === "missing" ? "error" : type === "update" || type === "different" ? "warn" : "";
    return `<span class="pcu-pill ${badgeKind}">${escapeHtml(labels[type] || type || "変更")}</span>`;
  }

  function detailedDifferencesFromCompareResult(compareResult) {
    return (compareResult?.differences || []).flatMap((difference) => {
      const section = difference.section || difference.key || "";
      return compareSettingsDetailed(
        { [section]: difference.source ?? difference.before },
        { [section]: difference.target ?? difference.after }
      );
    });
  }

  function renderDiffValue(value) {
    if (value === undefined) return '<div class="pcu-diff-value empty">なし</div>';
    return `<div class="pcu-diff-value">${escapeHtml(previewJson(value))}</div>`;
  }

  function renderOperationChange(operation) {
    if (operation.type === "skip") return escapeHtml(operation.reason || "適用しません。");
    if (operation.before !== undefined || operation.after !== undefined) {
      const details = summarizeValueDiffs(operation.before, operation.after, 5);
      if (details.length) {
        return `<div class="pcu-change-list">${details.map((detail) => `<div>${escapeHtml(detail)}</div>`).join("")}</div>`;
      }
      return `
        <div class="pcu-grid two">
          ${renderDiffValue(operation.before)}
          ${renderDiffValue(operation.after)}
        </div>
      `;
    }
    return '<span class="pcu-muted">詳細なし</span>';
  }

  function renderLog() {
    const log = shadow.getElementById("pcu-log");
    log.innerHTML = state.log.slice(-80).map((entry) => (
      `<div class="pcu-log-line ${entry.kind}">${escapeHtml(entry.time)} ${escapeHtml(entry.message)}</div>`
    )).join("");
    log.scrollTop = log.scrollHeight;
  }

  async function loadJsonFile() {
    const file = await pickFile(".json,application/json");
    const text = await file.text();
    const sitePackage = parseJson(text);
    loadPackage(sitePackage, file.name);
    logInfo(`JSON を読み込みました: ${file.name}`);
  }

  async function loadApplierFile() {
    const file = await pickFile(".js,text/javascript,application/javascript");
    const source = await file.text();
    executeSource(source, file.name);
    if (!hasApplier()) throw new Error(`${file.name} did not expose ${applierGlobalName}.`);
    logInfo(`適用エンジンを読み込みました: ${file.name}`);
    render();
  }

  async function fetchSourceSettings() {
    syncToolbarState();
    if (!state.apiKey) throw new Error("API Key is required.");
    if (!state.sourceSiteId) throw new Error("Source SiteId is required.");
    const site = await getSite(state.sourceSiteId);
    const sitePackage = {
      PackageName: `${site.Title || `Site ${state.sourceSiteId}`} current settings`,
      Sites: [
        {
          Title: site.Title || "",
          SiteId: Number(state.sourceSiteId),
          ReferenceType: site.ReferenceType || "Results",
          SiteSettings: site.SiteSettings || {}
        }
      ]
    };
    loadPackage(sitePackage, `site-${state.sourceSiteId}-current.json`);
    logInfo(`SiteId ${state.sourceSiteId} から設定を取得しました。`);
  }

  async function dryRun() {
    syncToolbarState();
    ensureApplier();
    if (!state.apiKey) throw new Error("API Key is required.");
    if (!state.targetSiteId) throw new Error("Target SiteId is required.");
    if (state.validation.errors.length > 0) {
      state.activeSection = "Summary";
      render();
      throw new Error("Validation errors must be fixed before dry-run.");
    }

    const result = await global[applierGlobalName].applySiteSettings(buildWorkingPackage(), {
      apiKey: state.apiKey,
      tenantId: Number(state.tenantId || 1),
      targetSiteId: Number(state.targetSiteId),
      sections: "all",
      mode: state.mode,
      dryRun: true,
      allowUnsafeSections: state.allowUnsafeSections
    });
    state.dryRun = result;
    state.dirtyAfterDryRun = false;
    state.activeSection = "Diff";
    logInfo(`dry-run 完了: ${summarizeOperations(result.plan?.summary)}`);
    render();
  }

  async function apply() {
    syncToolbarState();
    ensureApplier();
    if (!state.dryRun || state.dirtyAfterDryRun) throw new Error("Run dry-run again before apply.");
    if (state.validation.errors.length > 0) throw new Error("Validation errors must be fixed before apply.");
    const unsafeInPackage = Object.keys(state.workingSettings || {}).filter((key) => unsafeSections.has(key));
    if (unsafeInPackage.length > 0 && !state.allowUnsafeSections) {
      throw new Error(`Unsafe sections are locked: ${unsafeInPackage.join(", ")}`);
    }
    if (!confirm("dry-run 済みの内容を適用しますか？")) return;

    const result = await global[applierGlobalName].applySiteSettings(buildWorkingPackage(), {
      apiKey: state.apiKey,
      tenantId: Number(state.tenantId || 1),
      targetSiteId: Number(state.targetSiteId),
      sections: "all",
      mode: state.mode,
      dryRun: false,
      allowUnsafeSections: state.allowUnsafeSections
    });
    state.applyResult = result;
    state.activeSection = "Diff";
    logInfo(`適用完了: postApplyCompare.equal=${result.postApplyCompare?.equal}`);
    render();
  }

  async function importTsvFile() {
    const file = await pickFile(".tsv,.txt,.csv,text/tab-separated-values,text/plain");
    const text = await file.text();
    const mode = prompt("取り込み先を入力してください: Columns または EditorColumnHash", state.activeSection === "Editor" ? "Columns" : "Columns");
    if (mode === "Columns") {
      state.workingSettings.Columns = mergeColumnsFromTsv(state.workingSettings.Columns || [], text);
    } else if (mode === "EditorColumnHash") {
      state.workingSettings.EditorColumnHash = editorColumnHashFromTsv(text);
    } else {
      throw new Error("Columns or EditorColumnHash must be selected.");
    }
    markDirty();
    logInfo(`TSV を取り込みました: ${file.name}`);
    render();
  }

  function exportTsvForActiveSection() {
    if (state.activeSection === "Editor") {
      const mode = prompt("書き出し対象を入力してください: Columns または EditorColumnHash", "Columns");
      if (mode === "Columns") {
        downloadText("columns.tsv", columnsToTsv(state.workingSettings.Columns || []), "text/tab-separated-values");
      } else if (mode === "EditorColumnHash") {
        downloadText("editor-column-hash.tsv", editorColumnHashToTsv(state.workingSettings.EditorColumnHash || {}), "text/tab-separated-values");
      } else {
        throw new Error("Columns or EditorColumnHash must be selected.");
      }
    } else if (state.activeSection === "Columns") {
      downloadText("columns.tsv", columnsToTsv(state.workingSettings.Columns || []), "text/tab-separated-values");
    } else {
      throw new Error("TSV export is available for Editor.");
    }
  }

  function exportWorkingPackage() {
    downloadText(
      `${safeFileName(state.siteTitle || "site-package")}.json`,
      JSON.stringify(buildWorkingPackage(), null, 2),
      "application/json"
    );
  }

  function loadPackage(sitePackage, fileName) {
    const site = extractSite(sitePackage);
    const settings = clone(site.SiteSettings || sitePackage.SiteSettings || {});
    state.sourcePackage = clone(sitePackage);
    state.sourceSettings = clone(settings);
    state.workingSettings = clone(settings);
    state.packageFileName = fileName || "";
    state.siteTitle = site.Title || sitePackage.PackageName || "";
    state.sourceSiteId = site.SiteId != null ? String(site.SiteId) : state.sourceSiteId;
    state.dirty = false;
    state.dirtyAfterDryRun = false;
    state.dryRun = null;
    state.applyResult = null;
    render();
  }

  function buildWorkingPackage() {
    const base = state.sourcePackage ? clone(state.sourcePackage) : { PackageName: "Edited site package", Sites: [{}] };
    if (!Array.isArray(base.Sites) || base.Sites.length === 0) base.Sites = [{}];
    base.Sites[0] = {
      ...base.Sites[0],
      Title: state.siteTitle || base.Sites[0].Title || "Edited Site",
      SiteId: state.sourceSiteId ? Number(state.sourceSiteId) : base.Sites[0].SiteId,
      ReferenceType: base.Sites[0].ReferenceType || "Results",
      SiteSettings: clone(state.workingSettings)
    };
    return base;
  }

  function addView() {
    const views = ensureArray("Views");
    views.push({
      Name: `New View ${views.length + 1}`,
      DefaultMode: "Index",
      GridColumns: ["ResultId", "Title", "UpdatedTime"],
      ColumnSorterHash: { UpdatedTime: "desc" }
    });
    markDirty();
    render();
  }

  function deleteView(index) {
    ensureArray("Views").splice(index, 1);
    markDirty();
    render();
  }

  function moveView(index, delta) {
    const views = ensureArray("Views");
    const nextIndex = index + delta;
    if (nextIndex < 0 || nextIndex >= views.length) return;
    const [item] = views.splice(index, 1);
    views.splice(nextIndex, 0, item);
    markDirty();
    render();
  }

  function updateViewField(index, field, value) {
    const view = ensureArray("Views")[index];
    if (!view) return;
    if (field === "GridColumns") view[field] = linesToArray(value);
    else if (field === "UseFilterButton") view[field] = Boolean(value);
    else view[field] = value;
    markDirty();
  }

  function updateViewJsonField(index, field, value) {
    const view = ensureArray("Views")[index];
    if (!view) return;
    try {
      view[field] = value.trim() ? JSON.parse(value) : {};
      markDirty();
    } catch {
      logWarn(`${field} is not valid JSON yet.`);
    }
  }

  function addEditorGroup() {
    const hash = ensureObject("EditorColumnHash");
    let name = "New Group";
    let suffix = 1;
    while (Object.prototype.hasOwnProperty.call(hash, name)) {
      suffix += 1;
      name = `New Group ${suffix}`;
    }
    hash[name] = [];
    markDirty();
    render();
  }

  function deleteEditorGroup(group) {
    delete ensureObject("EditorColumnHash")[group];
    markDirty();
    render();
  }

  function renameEditorGroup(oldName, newName) {
    const hash = ensureObject("EditorColumnHash");
    const trimmed = newName.trim();
    if (!trimmed || oldName === trimmed || Object.prototype.hasOwnProperty.call(hash, trimmed)) return;
    const next = {};
    for (const [key, value] of Object.entries(hash)) {
      next[key === oldName ? trimmed : key] = value;
    }
    state.workingSettings.EditorColumnHash = next;
    markDirty();
    render();
  }

  function setEditorGroupItems(group, value) {
    ensureObject("EditorColumnHash")[group] = linesToArray(value);
    markDirty();
  }

  function addEditorItem(group) {
    const hash = ensureObject("EditorColumnHash");
    const items = Array.isArray(hash[group]) ? hash[group] : [];
    const usedInGroup = new Set(items.map(String));
    const nextColumn =
      displayColumnNames(state.workingSettings).find((name) => !usedInGroup.has(String(name))) ||
      displayColumnNames(state.workingSettings)[0] ||
      "Title";
    hash[group] = [...items, nextColumn];
    markDirty();
    render();
  }

  function deleteEditorItem(group, index) {
    const hash = ensureObject("EditorColumnHash");
    if (!Array.isArray(hash[group]) || index < 0 || index >= hash[group].length) return;
    hash[group].splice(index, 1);
    markDirty();
    render();
  }

  function moveEditorItem(group, index, delta) {
    const hash = ensureObject("EditorColumnHash");
    const items = hash[group];
    if (!Array.isArray(items)) return;
    const nextIndex = index + delta;
    if (nextIndex < 0 || nextIndex >= items.length) return;
    const [item] = items.splice(index, 1);
    items.splice(nextIndex, 0, item);
    markDirty();
    render();
  }

  function setEditorItemColumn(group, index, columnName) {
    const hash = ensureObject("EditorColumnHash");
    if (!Array.isArray(hash[group]) || index < 0 || index >= hash[group].length) return;
    hash[group][index] = columnName;
    markDirty();
    render();
  }

  function placeColumnInEditor(columnName) {
    const hash = ensureObject("EditorColumnHash");
    let group = "";
    for (const element of shadow.querySelectorAll("[data-place-group-for]")) {
      if (element.dataset.placeGroupFor === columnName) {
        group = element.value;
        break;
      }
    }
    if (!group) group = Object.keys(hash)[0] || "基本";
    if (!Array.isArray(hash[group])) hash[group] = [];
    if (!hash[group].includes(columnName)) hash[group].push(columnName);
    markDirty();
    render();
  }

  function ensureEditorColumnSetting(columnName) {
    const columns = ensureArray("Columns");
    if (findColumn(state.workingSettings, columnName)) return;
    columns.push({
      ColumnName: columnName,
      LabelText: systemColumnLabels[columnName] || columnName
    });
    markDirty();
    render();
  }

  function addColumn() {
    ensureArray("Columns").push({ ColumnName: "ClassA", LabelText: "", FieldCss: "field-normal" });
    markDirty();
    render();
  }

  function addColumnField() {
    const field = prompt("追加する項目設定キーを入力してください。例: NoDisplay, Regex, DecimalPlaces", "");
    const normalized = String(field || "").trim();
    if (!normalized) return;
    if (!state.extraColumnFields.includes(normalized)) state.extraColumnFields.push(normalized);
    render();
  }

  function deleteColumn(index) {
    ensureArray("Columns").splice(index, 1);
    markDirty();
    render();
  }

  function updateColumnField(index, field, value) {
    const column = ensureArray("Columns")[index];
    if (!column) return;
    if (booleanColumnFields.has(field)) {
      column[field] = Boolean(value);
    } else if (field === "ColumnName") {
      column[field] = String(value || "").trim();
    } else if (value === "" && field !== "LabelText" && field !== "GridLabelText") {
      delete column[field];
    } else if (numberColumnFields.has(field)) {
      const numeric = Number(value);
      if (Number.isFinite(numeric)) column[field] = numeric;
      else delete column[field];
    } else if (isPlainObject(column[field]) || Array.isArray(column[field])) {
      try {
        column[field] = JSON.parse(value);
      } catch {
        logWarn(`${field} is not valid JSON yet.`);
      }
    } else {
      column[field] = value;
    }
    markDirty();
  }

  function formatRawJson() {
    const raw = shadow.getElementById("pcu-raw-json");
    raw.value = JSON.stringify(JSON.parse(raw.value), null, 2);
  }

  function applyRawJson() {
    const raw = shadow.getElementById("pcu-raw-json");
    state.workingSettings = JSON.parse(raw.value);
    markDirty();
    render();
  }

  function markDirty() {
    state.dirty = true;
    state.dirtyAfterDryRun = true;
    state.applyResult = null;
  }

  function ensureArray(key) {
    if (!Array.isArray(state.workingSettings[key])) state.workingSettings[key] = [];
    return state.workingSettings[key];
  }

  function ensureObject(key) {
    if (!isPlainObject(state.workingSettings[key])) state.workingSettings[key] = {};
    return state.workingSettings[key];
  }

  function validateSettings(settings) {
    const errors = [];
    const warnings = [];
    if (!isPlainObject(settings)) errors.push("SiteSettings must be an object.");
    const validColumns = collectValidColumnNames(settings);

    for (const column of settings.Columns || []) {
      if (!column?.ColumnName) {
        errors.push("Columns contains an item without ColumnName.");
        continue;
      }
      const choices = parseChoiceValues(column.ChoicesText);
      if (choices.size > 0 && column.DefaultInput != null && column.DefaultInput !== "") {
        const invalidValues = String(column.DefaultInput)
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean)
          .filter((item) => !choices.has(item));
        if (invalidValues.length) {
          errors.push(`${column.ColumnName}.DefaultInput is not in ChoicesText: ${invalidValues.join(", ")}`);
        }
      }
      if (column.FieldCss && !allowedFieldCssValues(column.ColumnName, column).includes(column.FieldCss)) {
        errors.push(`${column.ColumnName}.FieldCss is not valid for this column: ${column.FieldCss}`);
      }
      if (column.ControlType === "RTEditor" && !column.FieldCss) {
        warnings.push(`${column.ColumnName} uses RTEditor and should set FieldCss to field-wide or field-normal.`);
      }
    }

    for (const [group, items] of Object.entries(settings.EditorColumnHash || {})) {
      if (!Array.isArray(items)) {
        errors.push(`EditorColumnHash.${group} must be an array.`);
        continue;
      }
      for (const columnName of items) {
        if (!validColumns.has(String(columnName))) {
          errors.push(`EditorColumnHash.${group} references missing column: ${columnName}`);
        }
      }
    }

    for (const view of settings.Views || []) {
      for (const columnName of view.GridColumns || []) {
        if (!validColumns.has(String(columnName))) {
          errors.push(`View "${view.Name || "(unnamed)"}" GridColumns references missing column: ${columnName}`);
        }
      }
      for (const key of ["ColumnFilterHash", "ColumnSorterHash"]) {
        for (const columnName of Object.keys(view[key] || {})) {
          if (!validColumns.has(String(columnName))) {
            errors.push(`View "${view.Name || "(unnamed)"}" ${key} references missing column: ${columnName}`);
          }
        }
      }
    }

    const unsafeInPackage = Object.keys(settings || {}).filter((key) => unsafeSections.has(key));
    if (unsafeInPackage.length > 0 && !state.allowUnsafeSections) {
      warnings.push(`Unsafe sections are locked and will be skipped unless enabled: ${unsafeInPackage.join(", ")}`);
    }

    return { errors, warnings };
  }

  function collectValidColumnNames(settings) {
    const names = new Set(systemColumnNames);
    for (const prefix of ["Class", "Num", "Date", "Description", "Check", "Attachments"]) {
      for (let code = 65; code <= 90; code += 1) names.add(`${prefix}${String.fromCharCode(code)}`);
    }
    for (const column of settings.Columns || []) {
      if (column?.ColumnName) names.add(String(column.ColumnName));
    }
    return names;
  }

  function displayColumnNames(settings) {
    const configured = (settings.Columns || []).map((column) => column?.ColumnName).filter(Boolean);
    const system = ["ResultId", "Ver", "Title", "Body", "Status", "Manager", "Owner", "Comments", "UpdatedTime"];
    return [...new Set([...system, ...configured])];
  }

  function findColumn(settings, columnName) {
    return (settings.Columns || []).find((column) => String(column?.ColumnName || "") === String(columnName || "")) || null;
  }

  function findColumnIndex(settings, columnName) {
    return (settings.Columns || []).findIndex((column) => String(column?.ColumnName || "") === String(columnName || ""));
  }

  function columnDisplayName(columnName, settings) {
    const column = findColumn(settings, columnName);
    return column?.LabelText || column?.GridLabelText || systemColumnLabels[columnName] || columnName || "(未設定)";
  }

  function columnKindLabel(columnName) {
    const name = String(columnName || "");
    if (systemColumnLabels[name]) return "標準";
    if (name.startsWith("Class")) return "分類";
    if (name.startsWith("Num")) return "数値";
    if (name.startsWith("Date")) return "日付";
    if (name.startsWith("Description")) return "説明";
    if (name.startsWith("Check")) return "チェック";
    if (name.startsWith("Attachments")) return "添付";
    return "項目";
  }

  function controlTypeLabel(value) {
    return {
      "": "標準",
      Normal: "通常",
      MarkDown: "Markdown",
      RTEditor: "リッチテキスト",
      Spinner: "スピナー"
    }[String(value || "")] || String(value || "標準");
  }

  function fieldCssLabel(value) {
    return {
      "": "標準幅",
      "field-normal": "標準幅",
      "field-wide": "広幅",
      "field-markdown": "Markdown幅",
      "field-rte": "リッチテキスト幅"
    }[String(value || "")] || String(value || "");
  }

  function renderColumnOptions(selected, settings) {
    const names = displayColumnNames(settings);
    if (selected && !names.includes(selected)) names.unshift(selected);
    return names.map((name) => {
      const label = columnDisplayName(name, settings);
      const missing = !collectValidColumnNames(settings).has(String(name));
      const text = missing ? `未定義: ${name}` : `${label}（${name}）`;
      return `<option value="${escapeAttr(name)}" ${String(selected || "") === String(name) ? "selected" : ""}>${escapeHtml(text)}</option>`;
    }).join("");
  }

  function renderColumnNote(columnName, column) {
    const notes = [];
    if (!column) {
      if (systemColumnLabels[columnName]) notes.push("Pleasanter標準項目");
      else notes.push("Columnsに定義がありません");
    } else {
      if (column.FieldCss) notes.push(`幅: ${fieldCssLabel(column.FieldCss)}`);
      if (column.DefaultInput != null && column.DefaultInput !== "") notes.push(`既定値: ${column.DefaultInput}`);
      if (column.ChoicesText) notes.push(`選択肢: ${parseChoiceValues(column.ChoicesText).size}件`);
      if (column.EditorReadOnly) notes.push("読取専用");
      if (column.TextAlign) notes.push(`文字揃え: ${column.TextAlign}`);
      if (column.MaxLength) notes.push(`最大文字数: ${column.MaxLength}`);
      if (column.Min != null || column.Max != null) notes.push(`範囲: ${column.Min ?? ""}〜${column.Max ?? ""}`);
      if (column.Regex) notes.push("入力検証あり");
    }
    if (!notes.length) notes.push("追加設定なし");
    return notes.map((note) => `<span class="pcu-pill">${escapeHtml(note)}</span>`).join("");
  }

  function columnsToTsv(columns) {
    const headers = ["Section", "ColumnName", "LabelText", "Required", "ControlType", "ChoicesText", "DefaultInput", "FieldCss", "TextAlign"];
    const rows = columns.map((column) => [
      "Columns",
      column.ColumnName || "",
      column.LabelText || "",
      column.Required ? "true" : "false",
      column.ControlType || "",
      String(column.ChoicesText || "").replace(/\r?\n/g, "|"),
      column.DefaultInput ?? "",
      column.FieldCss || "",
      column.TextAlign ?? ""
    ]);
    return [headers, ...rows].map((row) => row.map(tsvCell).join("\t")).join("\n");
  }

  function mergeColumnsFromTsv(currentColumns, text) {
    const rows = parseDelimited(text);
    const headers = rows.shift() || [];
    const byName = new Map(currentColumns.map((column) => [String(column.ColumnName || ""), clone(column)]));
    for (const row of rows) {
      const record = Object.fromEntries(headers.map((header, index) => [header, row[index] ?? ""]));
      if (record.Section && record.Section !== "Columns") continue;
      const columnName = record.ColumnName;
      if (!columnName) continue;
      const column = byName.get(columnName) || { ColumnName: columnName };
      for (const key of ["LabelText", "ControlType", "DefaultInput", "FieldCss", "TextAlign"]) {
        if (record[key] !== undefined && record[key] !== "") column[key] = record[key];
      }
      if (record.Required !== undefined && record.Required !== "") column.Required = /^true$/i.test(record.Required);
      if (record.ChoicesText !== undefined) column.ChoicesText = record.ChoicesText.replace(/\|/g, "\n");
      byName.set(columnName, column);
    }
    return [...byName.values()];
  }

  function editorColumnHashToTsv(hash) {
    const rows = [["Group", "Order", "ColumnName"]];
    for (const [group, items] of Object.entries(hash || {})) {
      (items || []).forEach((columnName, index) => rows.push([group, String(index + 1), columnName]));
    }
    return rows.map((row) => row.map(tsvCell).join("\t")).join("\n");
  }

  function editorColumnHashFromTsv(text) {
    const rows = parseDelimited(text);
    const headers = rows.shift() || [];
    const result = {};
    for (const row of rows) {
      const record = Object.fromEntries(headers.map((header, index) => [header, row[index] ?? ""]));
      const group = record.Group || record.Tab || record.Section;
      const columnName = record.ColumnName;
      if (!group || !columnName) continue;
      if (!result[group]) result[group] = [];
      result[group].push(columnName);
    }
    return result;
  }

  function parseDelimited(text) {
    const source = String(text || "").replace(/^\uFEFF/, "");
    const delimiter = source.includes("\t") ? "\t" : ",";
    return source
      .replace(/^\uFEFF/, "")
      .split(/\r?\n/)
      .filter((line) => line.trim() !== "")
      .map((line) => parseDelimitedLine(line, delimiter));
  }

  function parseDelimitedLine(line, delimiter) {
    const cells = [];
    let cell = "";
    let quoted = false;
    for (let index = 0; index < line.length; index += 1) {
      const char = line[index];
      const next = line[index + 1];
      if (char === '"' && quoted && next === '"') {
        cell += '"';
        index += 1;
      } else if (char === '"') {
        quoted = !quoted;
      } else if (char === delimiter && !quoted) {
        cells.push(cell);
        cell = "";
      } else {
        cell += char;
      }
    }
    cells.push(cell);
    return cells;
  }

  function tsvCell(value) {
    const text = String(value ?? "");
    return /[\t\r\n"]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  }

  function compareSettings(source, target) {
    const keys = [...new Set([...Object.keys(source || {}), ...Object.keys(target || {})])].sort();
    const differences = [];
    for (const key of keys) {
      const sourceHas = Object.prototype.hasOwnProperty.call(source || {}, key);
      const targetHas = Object.prototype.hasOwnProperty.call(target || {}, key);
      if (!sourceHas && targetHas) differences.push({ type: "extra", section: key, target: clone(target[key]) });
      else if (sourceHas && !targetHas) differences.push({ type: "missing", section: key, source: clone(source[key]) });
      else if (stable(source[key]) !== stable(target[key])) {
        differences.push({ type: "different", section: key, source: clone(source[key]), target: clone(target[key]) });
      }
    }
    return differences;
  }

  function compareSettingsDetailed(source, target) {
    const differences = [];
    diffValue("", source || {}, target || {}, differences);
    return differences;
  }

  function diffValue(path, before, after, differences) {
    if (stable(before) === stable(after)) return;

    if (before === undefined || after === undefined || !isContainerComparable(before, after)) {
      differences.push({
        type: before === undefined ? "create" : after === undefined ? "delete" : "update",
        section: pathSection(path),
        path: path || "(root)",
        label: diffLabel(path),
        before: clone(before),
        after: clone(after)
      });
      return;
    }

    if (Array.isArray(before) && Array.isArray(after)) {
      diffArray(path, before, after, differences);
      return;
    }

    const keys = [...new Set([...Object.keys(before || {}), ...Object.keys(after || {})])].sort();
    for (const key of keys) {
      diffValue(path ? `${path}.${key}` : key, before?.[key], after?.[key], differences);
    }
  }

  function diffArray(path, before, after, differences) {
    const section = pathSection(path);
    const keyable = [...before, ...after].every((item) => arrayItemKey(section, item));
    if (keyable) {
      const beforeMap = new Map(before.map((item, index) => [arrayItemKey(section, item), { item, index }]));
      const afterMap = new Map(after.map((item, index) => [arrayItemKey(section, item), { item, index }]));
      const beforeOrder = before.map((item) => arrayItemKey(section, item));
      const afterOrder = after.map((item) => arrayItemKey(section, item));
      if (beforeOrder.join("\n") !== afterOrder.join("\n")) {
        differences.push({
          type: "update",
          section,
          path: `${path}.__order`,
          label: `${diffLabel(path)} の順序`,
          before: beforeOrder,
          after: afterOrder
        });
      }
      for (const key of [...new Set([...beforeMap.keys(), ...afterMap.keys()])].sort()) {
        const nextPath = `${path}[${key}]`;
        diffValue(nextPath, beforeMap.get(key)?.item, afterMap.get(key)?.item, differences);
      }
      return;
    }

    const length = Math.max(before.length, after.length);
    for (let index = 0; index < length; index += 1) {
      diffValue(`${path}[${index + 1}]`, before[index], after[index], differences);
    }
  }

  function summarizeValueDiffs(before, after, limit = 5) {
    const differences = [];
    diffValue("", before, after, differences);
    return differences.slice(0, limit).map((item) => {
      const beforeText = compactValue(item.before);
      const afterText = compactValue(item.after);
      return `${item.label}: ${beforeText} -> ${afterText}`;
    }).concat(differences.length > limit ? [`ほか ${differences.length - limit} 件`] : []);
  }

  function arrayItemKey(section, item) {
    if (!isPlainObject(item)) return "";
    if (section === "Columns") return item.ColumnName || "";
    return item.Name || item.Title || item.Id || item.IdHash || "";
  }

  function isContainerComparable(before, after) {
    if (Array.isArray(before) || Array.isArray(after)) return Array.isArray(before) && Array.isArray(after);
    return isPlainObject(before) && isPlainObject(after);
  }

  function pathSection(path) {
    const match = String(path || "").match(/^([^[.]+)/);
    return match?.[1] || "";
  }

  function diffLabel(path) {
    const text = String(path || "");
    const section = pathSection(text);
    if (section === "EditorColumnHash") {
      const match = text.match(/^EditorColumnHash\.([^[.]+)(?:\[(\d+)\])?/);
      if (match) return `${sectionLabel(section)} / ${match[1]}${match[2] ? ` / ${match[2]}番目` : ""}`;
    }
    const last = text.split(".").pop() || text;
    const property = last.replace(/\[[^\]]+\]/g, "");
    const propertyLabel = settingPropertyLabel(property);
    const itemMatch = text.match(/\[([^\]]+)\]/g);
    if (itemMatch?.length) {
      const item = itemMatch[itemMatch.length - 1].replace(/^\[|\]$/g, "");
      return property && property !== item ? `${sectionLabel(section)} / ${item} / ${propertyLabel}` : `${sectionLabel(section)} / ${item}`;
    }
    return propertyLabel === section ? sectionLabel(section) : `${sectionLabel(section)} / ${propertyLabel}`;
  }

  function settingPropertyLabel(property) {
    return {
      __order: "表示順",
      ColumnName: "項目名",
      LabelText: "表示名",
      GridLabelText: "一覧の表示名",
      Required: "入力必須",
      ControlType: "コントロール種別",
      ChoicesText: "選択肢一覧",
      DefaultInput: "既定値",
      FieldCss: "フィールドCSS",
      TextAlign: "配置",
      EditorReadOnly: "読取専用",
      EditorFormat: "エディタの書式",
      MaxLength: "最大文字数",
      Min: "最小値",
      Max: "最大値",
      Regex: "正規表現",
      ClientRegex: "クライアント正規表現",
      ServerRegex: "サーバ正規表現",
      Name: "名称",
      DefaultMode: "表示",
      GridColumns: "表示項目",
      ColumnFilterHash: "フィルタ",
      ColumnSorterHash: "ソート",
      UseFilterButton: "フィルタボタンを使用する"
    }[property] || property;
  }

  function compactValue(value) {
    if (value === undefined) return "なし";
    if (typeof value === "string") return value.length > 80 ? `${value.slice(0, 80)}...` : value;
    if (typeof value === "number" || typeof value === "boolean" || value == null) return String(value);
    const text = JSON.stringify(value);
    return text.length > 100 ? `${text.slice(0, 100)}...` : text;
  }

  async function getSite(siteId) {
    const response = await fetch(`${location.origin.replace(/\/+$/, "")}/api/items/${siteId}/getsite`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ApiVersion: "1.1",
        ApiKey: state.apiKey,
        TenantId: Number(state.tenantId || 1)
      })
    });
    const text = await response.text();
    const json = parseJson(text);
    if (!response.ok || json.StatusCode >= 400) throw new Error(`Pleasanter API error ${response.status}: ${text}`);
    return json.Response?.Data || json.Response || json;
  }

  function syncToolbarState() {
    for (const field of ["tenantId", "sourceSiteId", "targetSiteId", "apiKey", "mode"]) {
      const element = shadow.getElementById(`pcu-${kebab(field)}`);
      if (element) state[field] = element.value;
    }
    state.allowUnsafeSections = shadow.getElementById("pcu-unsafe")?.checked || false;
  }

  function setValue(id, value) {
    const element = shadow.getElementById(id);
    if (element && element.value !== String(value ?? "")) element.value = value ?? "";
  }

  function hasApplier() {
    return Boolean(global[applierGlobalName]?.applySiteSettings);
  }

  function ensureApplier() {
    if (!hasApplier()) throw new Error(`Load apply-site-package-settings.js first. ${applierGlobalName} was not found.`);
  }

  function executeSource(source, fileName) {
    const script = document.createElement("script");
    script.type = "text/javascript";
    script.text = `${source}\n//# sourceURL=${encodeURIComponent(fileName)}`;
    document.documentElement.appendChild(script);
    script.remove();
  }

  function pickFile(accept) {
    return new Promise((resolve, reject) => {
      const input = document.createElement("input");
      input.type = "file";
      input.accept = accept;
      input.style.position = "fixed";
      input.style.left = "-9999px";
      input.style.top = "-9999px";
      input.addEventListener("change", () => {
        const file = input.files?.[0];
        input.remove();
        if (!file) reject(new Error("No file was selected."));
        else resolve(file);
      });
      document.body.appendChild(input);
      input.click();
    });
  }

  function downloadText(fileName, text, type) {
    const blob = new Blob([text], { type });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = fileName;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  }

  async function copyText(text) {
    await navigator.clipboard.writeText(text);
    logInfo("JSON をクリップボードへコピーしました。");
  }

  function logInfo(message) {
    pushLog("info", message);
  }

  function logWarn(message) {
    pushLog("warn", message);
  }

  function logError(message) {
    pushLog("error", message);
  }

  function pushLog(kind, message) {
    state.log.push({
      kind,
      message,
      time: new Date().toLocaleTimeString()
    });
    renderLog();
  }

  function summarizeOperations(summary = {}) {
    return Object.entries(summary).map(([key, value]) => `${key}:${value}`).join(", ");
  }

  function extractSite(sitePackage) {
    if (Array.isArray(sitePackage?.Sites) && sitePackage.Sites.length > 0) return sitePackage.Sites[0];
    return sitePackage?.Site || sitePackage || {};
  }

  function valueType(value) {
    if (Array.isArray(value)) return "array";
    if (isPlainObject(value)) return "object";
    return typeof value;
  }

  function valueSummary(value) {
    if (Array.isArray(value)) return `${value.length} items`;
    if (isPlainObject(value)) return `${Object.keys(value).length} keys`;
    return String(value ?? "");
  }

  function linesToArray(value) {
    return String(value || "")
      .split(/[\r\n,]+/)
      .map((item) => item.trim())
      .filter(Boolean);
  }

  function arrayToLines(value) {
    return Array.isArray(value) ? value.join("\n") : "";
  }

  function formatInlineJson(value) {
    return JSON.stringify(value || {}, null, 2);
  }

  function previewJson(value) {
    if (value === undefined) return "";
    const text = JSON.stringify(value, null, 2);
    return text.length > 1200 ? `${text.slice(0, 1200)}\n...` : text;
  }

  function parseJson(text) {
    return JSON.parse(String(text || "").replace(/^\uFEFF/, ""));
  }

  function parseChoiceValues(choicesText) {
    const values = new Set();
    for (const line of String(choicesText || "").split(/\r?\n/)) {
      const trimmed = line.trim();
      if (trimmed) values.add(trimmed.split(",")[0].trim());
    }
    return values;
  }

  function allowedFieldCssValues(columnName, column) {
    const values = ["", "field-normal", "field-wide"];
    if (String(columnName || "").startsWith("Description") && column?.ControlType !== "RTEditor") {
      values.push("field-markdown", "field-rte");
    }
    return values;
  }

  function stable(value) {
    return JSON.stringify(canonical(value));
  }

  function canonical(value) {
    if (Array.isArray(value)) return value.map(canonical);
    if (isPlainObject(value)) {
      return Object.fromEntries(
        Object.keys(value)
          .sort()
          .map((key) => [key, canonical(value[key])])
      );
    }
    return value;
  }

  function clone(value) {
    return value == null ? value : JSON.parse(JSON.stringify(value));
  }

  function isPlainObject(value) {
    if (value == null || typeof value !== "object" || Array.isArray(value)) return false;
    const prototype = Object.getPrototypeOf(value);
    return prototype === Object.prototype || prototype === null;
  }

  function safeFileName(value) {
    return String(value || "site-package").replace(/[\\/:*?"<>|]+/g, "_");
  }

  function kebab(value) {
    return String(value).replace(/[A-Z]/g, (char) => `-${char.toLowerCase()}`);
  }

  function domValue(id) {
    return global.document?.getElementById(id)?.value || "";
  }

  function currentSiteId() {
    const domSiteId = domValue("SiteId");
    if (domSiteId && domSiteId !== "0") return domSiteId;
    const match = String(global.location?.pathname || "").match(/\/items\/(\d+)\//);
    return match?.[1] || "";
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function escapeAttr(value) {
    return escapeHtml(value);
  }

  const api = {
    version: VERSION,
    open,
    close,
    loadPackage,
    state,
    model: {
      validateSettings,
      compareSettings,
      compareSettingsDetailed,
      columnsToTsv,
      mergeColumnsFromTsv,
      editorColumnHashToTsv,
      editorColumnHashFromTsv,
      allowedFieldCssValues,
      displayColumnNames,
      columnDisplayName,
      columnKindLabel,
      columnDetailFields,
      buildWorkingPackage
    }
  };

  global.PleasanterConfigEditor = api;

  if (global.document?.body) {
    open();
  }
})(window);
