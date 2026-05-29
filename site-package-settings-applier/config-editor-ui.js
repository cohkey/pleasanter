/*
 * Browser-based SiteSettings editor for Pleasanter site packages.
 *
 * Production target:
 * - Paste load-local-js-from-file.js into DevTools Console.
 * - Run PleasanterLocalJsLoader.pickAndRun() and select this file.
 * - No Node.js, build step, or external library is required.
 */
(function attachPleasanterConfigEditor(global) {
  const VERSION = "0.3.0";
  const rootId = "pleasanter-config-editor-root";
  const applierGlobalName = "PleasanterSitePackageApplier";
  const sections = ["Summary", "Views", "Editor Layout", "Columns", "Raw JSON", "Diff"];
  const sectionLabels = {
    Summary: "概要",
    Views: "ビュー",
    "Editor Layout": "エディタ配置",
    Columns: "項目設定",
    "Raw JSON": "JSON",
    Diff: "差分確認"
  };
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
      updateViewField(Number(element.dataset.index), element.dataset.viewField, element.value);
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
      "Editor Layout": "入力画面の並び",
      Columns: "項目名・必須・選択肢",
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
    if (section === "Editor Layout") return countBadge(Object.keys(state.workingSettings.EditorColumnHash || {}));
    if (section === "Columns") return countBadge(state.workingSettings.Columns);
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
    else if (state.activeSection === "Editor Layout") panel.innerHTML = renderEditorLayout();
    else if (state.activeSection === "Columns") panel.innerHTML = renderColumns();
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
    return `
      <div class="pcu-section-head">
        <div>
          <h2>ビュー</h2>
          <p>一覧、カンバン、カレンダーごとの表示列、絞り込み、並び替えを編集します。</p>
        </div>
        <button data-action="add-view">ビュー追加</button>
      </div>
      <div class="pcu-table-wrap">
        <table>
          <thead>
            <tr>
              <th style="width: 170px;">ビュー名</th>
              <th style="width: 120px;">表示形式</th>
              <th>表示列</th>
              <th>絞り込み</th>
              <th>並び替え</th>
              <th style="width: 120px;">操作</th>
            </tr>
          </thead>
          <tbody>
            ${views.map((view, index) => `
              <tr>
                <td><input data-index="${index}" data-view-field="Name" value="${escapeAttr(view.Name || "")}"></td>
                <td>
                  <select data-index="${index}" data-view-field="DefaultMode">
                    ${[
                      ["Index", "一覧"],
                      ["Kamban", "カンバン"],
                      ["Calendar", "カレンダー"]
                    ].map(([mode, label]) => `
                      <option value="${mode}" ${view.DefaultMode === mode ? "selected" : ""}>${label}</option>
                    `).join("")}
                  </select>
                </td>
                <td><textarea placeholder="列名を1行ずつ入力" data-index="${index}" data-view-field="GridColumns">${escapeHtml(arrayToLines(view.GridColumns))}</textarea></td>
                <td><textarea placeholder='例: {"Status":"[\"300\"]"}' data-index="${index}" data-view-json-field="ColumnFilterHash">${escapeHtml(formatInlineJson(view.ColumnFilterHash || {}))}</textarea></td>
                <td><textarea placeholder='例: {"UpdatedTime":"desc"}' data-index="${index}" data-view-json-field="ColumnSorterHash">${escapeHtml(formatInlineJson(view.ColumnSorterHash || {}))}</textarea></td>
                <td>
                  <div class="pcu-row-actions">
                    <button data-action="move-view" data-index="${index}" data-delta="-1" ${index === 0 ? "disabled" : ""}>上へ</button>
                    <button data-action="move-view" data-index="${index}" data-delta="1" ${index === views.length - 1 ? "disabled" : ""}>下へ</button>
                    <button class="pcu-danger" data-action="delete-view" data-index="${index}">削除</button>
                  </div>
                </td>
              </tr>
            `).join("") || '<tr><td colspan="6">ビューはありません。</td></tr>'}
          </tbody>
        </table>
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
        <td><div class="pcu-editor-note">${renderColumnNote(columnName, column)}</div></td>
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
    const columns = ensureArray("Columns");
    return `
      <div class="pcu-section-head">
        <div>
          <h2>項目設定</h2>
          <p>表示名、必須、選択肢、既定値、入力形式を項目ごとに編集します。</p>
        </div>
        <button data-action="add-column">項目追加</button>
      </div>
      <div class="pcu-table-wrap">
        <table>
          <thead>
            <tr>
              <th style="width: 120px;">項目コード</th>
              <th style="width: 150px;">表示名</th>
              <th style="width: 70px;">必須</th>
              <th style="width: 105px;">入力形式</th>
              <th>選択肢</th>
              <th style="width: 110px;">既定値</th>
              <th style="width: 105px;">表示幅</th>
              <th style="width: 92px;">文字揃え</th>
              <th style="width: 72px;">操作</th>
            </tr>
          </thead>
          <tbody>
            ${columns.map((column, index) => `
              <tr>
                <td><input data-index="${index}" data-column-field="ColumnName" value="${escapeAttr(column.ColumnName || "")}"></td>
                <td><input data-index="${index}" data-column-field="LabelText" value="${escapeAttr(column.LabelText || "")}"></td>
                <td><input type="checkbox" data-index="${index}" data-column-field="Required" ${column.Required ? "checked" : ""}></td>
                <td>
                  <select data-index="${index}" data-column-field="ControlType">
                    ${["", "Normal", "MarkDown", "RTEditor", "Spinner"].map((value) => `
                      <option value="${value}" ${String(column.ControlType || "") === value ? "selected" : ""}>${value || "(default)"}</option>
                    `).join("")}
                  </select>
                </td>
                <td><textarea placeholder="10,選択肢A&#10;20,選択肢B" data-index="${index}" data-column-field="ChoicesText">${escapeHtml(column.ChoicesText || "")}</textarea></td>
                <td><input data-index="${index}" data-column-field="DefaultInput" value="${escapeAttr(column.DefaultInput ?? "")}"></td>
                <td>
                  <select data-index="${index}" data-column-field="FieldCss">
                    ${allowedFieldCssValues(column.ColumnName, column).map((value) => `
                      <option value="${value}" ${String(column.FieldCss || "") === value ? "selected" : ""}>${value || "(default)"}</option>
                    `).join("")}
                  </select>
                </td>
                <td><input data-index="${index}" data-column-field="TextAlign" value="${escapeAttr(column.TextAlign ?? "")}"></td>
                <td><button class="pcu-danger" data-action="delete-column" data-index="${index}">削除</button></td>
              </tr>
            `).join("") || '<tr><td colspan="9">項目設定はありません。</td></tr>'}
          </tbody>
        </table>
      </div>
    `;
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
    const localDiff = compareSettings(state.sourceSettings, state.workingSettings);
    const dryOps = state.dryRun?.plan?.operations || [];
    const post = state.applyResult?.postApplyCompare;
    return `
      <div class="pcu-section-head">
        <div>
          <h2>差分確認</h2>
          <p>編集前との差分、dry-run の操作、適用後の一致確認を見ます。</p>
        </div>
      </div>
      <div class="pcu-grid three" style="margin-bottom: 12px;">
        <div class="pcu-metric"><div class="label">編集中の差分</div><div class="value">${localDiff.length}</div></div>
        <div class="pcu-metric"><div class="label">適用予定の操作</div><div class="value">${dryOps.length}</div></div>
        <div class="pcu-metric"><div class="label">適用後一致</div><div class="value">${post ? (post.equal ? "一致" : "差分あり") : "-"}</div></div>
      </div>
      <h3>元JSON と編集中JSON</h3>
      ${renderSimpleDiffTable(localDiff)}
      <h3>dry-run 操作</h3>
      ${renderOperationsTable(dryOps)}
      <h3>適用後比較</h3>
      ${post ? renderSimpleDiffTable(post.differences || []) : '<div class="pcu-empty">まだ適用していません。</div>'}
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

  function renderOperationsTable(operations) {
    if (!operations.length) return '<div class="pcu-empty">dry-run の操作はありません。</div>';
    return `
      <div class="pcu-table-wrap">
        <table>
          <thead><tr><th style="width: 80px;">種類</th><th style="width: 140px;">セクション</th><th>対象</th><th>理由</th></tr></thead>
          <tbody>
            ${operations.map((operation) => `
              <tr>
                <td>${escapeHtml(operation.type)}</td>
                <td>${escapeHtml(operation.section || "")}</td>
                <td>${escapeHtml(operation.key || "")}</td>
                <td>${escapeHtml(operation.reason || "")}</td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>
    `;
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
    const mode = prompt("取り込み先を入力してください: Columns または EditorColumnHash", state.activeSection === "Editor Layout" ? "EditorColumnHash" : "Columns");
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
    if (state.activeSection === "Columns") {
      downloadText("columns.tsv", columnsToTsv(state.workingSettings.Columns || []), "text/tab-separated-values");
    } else if (state.activeSection === "Editor Layout") {
      downloadText("editor-column-hash.tsv", editorColumnHashToTsv(state.workingSettings.EditorColumnHash || {}), "text/tab-separated-values");
    } else {
      throw new Error("TSV export is available for Columns or Editor Layout.");
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

  function addColumn() {
    ensureArray("Columns").push({ ColumnName: "ClassA", LabelText: "", FieldCss: "field-normal" });
    markDirty();
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
    if (field === "Required") column[field] = Boolean(value);
    else if (value === "" && ["TextAlign", "DefaultInput", "FieldCss", "ControlType"].includes(field)) delete column[field];
    else column[field] = value;
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
      columnsToTsv,
      mergeColumnsFromTsv,
      editorColumnHashToTsv,
      editorColumnHashFromTsv,
      allowedFieldCssValues,
      displayColumnNames,
      columnDisplayName,
      columnKindLabel,
      buildWorkingPackage
    }
  };

  global.PleasanterConfigEditor = api;

  if (global.document?.body) {
    open();
  }
})(window);
