/*
 * Apply Pleasanter site settings from a site package JSON.
 *
 * Production target:
 * - Paste this file into DevTools Console while signed in to Pleasanter.
 * - No Node.js, framework, extension, or build step is required.
 * - Pleasanter API key is still required.
 */
(function attachPleasanterViewPackageApplier(global) {
  const arraySettingKeys = [
    "Views",
    "Scripts",
    "ServerScripts",
    "Styles",
    "Htmls",
    "Processes",
    "StatusControls"
  ];

  const volatileKeys = new Set([
    "Id",
    "SiteId",
    "Ver",
    "CreatedTime",
    "UpdatedTime",
    "Creator",
    "Updator",
    "sourceId",
    "stableKey"
  ]);

  const samplePackage = {
    PackageName: "View settings sync sample",
    Sites: [
      {
        Title: "動作確認テーブル",
        SiteId: 1,
        ReferenceType: "Results",
        SiteSettings: {
          Views: [
            {
              Name: "サンプル: 作業一覧",
              DefaultMode: "Index",
              GridColumns: [
                "ResultId",
                "TitleBody",
                "Comments",
                "Status",
                "Manager",
                "Owner",
                "Updator",
                "UpdatedTime"
              ],
              ColumnSorterHash: { UpdatedTime: "desc" },
              FiltersDisplayType: 2,
              AggregationsDisplayType: 1
            },
            {
              Name: "サンプル: レビュー用",
              DefaultMode: "Index",
              GridColumns: ["ResultId", "Title", "Status", "Manager", "UpdatedTime"],
              ColumnFilterHash: { Status: "[\"400\"]" },
              ColumnSorterHash: { UpdatedTime: "desc" },
              FiltersDisplayType: 2,
              AggregationsDisplayType: 0
            },
            {
              Name: "サンプル: カンバン確認",
              DefaultMode: "Kamban",
              GridColumns: ["ResultId", "TitleBody", "Status", "Manager", "Owner", "UpdatedTime"],
              ColumnSorterHash: { UpdatedTime: "desc" },
              FiltersDisplayType: 0,
              AggregationsDisplayType: 1
            }
          ]
        }
      }
    ]
  };

  async function planViews(sitePackage, options) {
    return planSiteSettings(sitePackage, { ...options, sections: ["Views"] });
  }

  async function applyViews(sitePackage, options) {
    return applySiteSettings(sitePackage, { ...options, sections: ["Views"] });
  }

  async function pickPackageFile(options = {}) {
    const file = await pickFile(options.accept || ".json,application/json");
    const text = await file.text();
    return {
      fileName: file.name,
      size: file.size,
      package: parseJson(text)
    };
  }

  async function pickPackageAndPlan(options) {
    const picked = await pickPackageFile();
    const plan = await planSiteSettings(picked.package, options);
    return { ...picked, plan };
  }

  async function pickPackageAndApply(options) {
    const picked = await pickPackageFile();
    const result = await applySiteSettings(picked.package, options);
    return { ...picked, result };
  }

  async function runWizard(defaults = {}) {
    const picked = defaults.sitePackage
      ? {
          fileName: defaults.packageFileName || "selected-package.json",
          size: defaults.packageSize || null,
          package: defaults.sitePackage
        }
      : await pickPackageFile();
    const sourceSettings = extractSiteSettings(picked.package);
    const detectedSections = arraySettingKeys.filter((key) => Array.isArray(sourceSettings[key]));

    if (detectedSections.length === 0) {
      throw new Error("The selected JSON does not contain supported SiteSettings sections.");
    }

    const tenantId = Number(
      promptWithDefault("TenantId を入力してください。", defaults.tenantId || domValue("TenantId") || "1")
    );
    const targetSiteId = Number(
      promptWithDefault("適用先 SiteId を入力してください。", defaults.targetSiteId || domValue("SiteId") || "")
    );
    const apiKey = promptWithDefault(
      "APIキーを入力してください。",
      defaults.apiKey || sessionStorage.getItem("PleasanterViewPackageApplier.apiKey") || ""
    );

    if (!apiKey) throw new Error("API key is required.");
    if (!targetSiteId) throw new Error("Target SiteId is required.");

    if (confirm("このタブを開いている間だけ APIキーを再利用しますか？")) {
      sessionStorage.setItem("PleasanterViewPackageApplier.apiKey", apiKey);
    }

    const sectionsText = promptWithDefault(
      [
        "対象設定をカンマ区切りで入力してください。",
        `JSON内の対応済み設定: ${detectedSections.join(", ")}`,
        "例: Views または Views,Styles,Scripts または all"
      ].join("\n"),
      defaults.sections || detectedSections.join(",")
    );
    const sections = parseSections(sectionsText);

    const replace = confirm(
      [
        "適用モードを選んでください。",
        "",
        "OK: replace（JSONに合わせる。対象にしかない設定は削除対象）",
        "キャンセル: merge（追加・更新のみ。既存設定は残す）",
        "",
        "通常はキャンセルを選んで merge にしてください。"
      ].join("\n")
    );
    const mode = defaults.mode || (replace ? "replace" : "merge");

    const dryRunResult = await applySiteSettings(picked.package, {
      baseUrl: defaults.baseUrl,
      apiKey,
      tenantId,
      targetSiteId,
      sections,
      mode,
      dryRun: true
    });

    logPlan("Dry-run result", picked.fileName, dryRunResult.plan);

    if (!confirm("dry-run の内容を適用しますか？\n\nOK: 適用する\nキャンセル: 何もしない")) {
      return {
        applied: false,
        fileName: picked.fileName,
        dryRun: dryRunResult
      };
    }

    const applyResult = await applySiteSettings(picked.package, {
      baseUrl: defaults.baseUrl,
      apiKey,
      tenantId,
      targetSiteId,
      sections,
      mode,
      dryRun: false
    });

    console.log("Applied:", applyResult);
    console.log("Verified:", applyResult.verified);

    return {
      applied: true,
      fileName: picked.fileName,
      dryRun: dryRunResult,
      result: applyResult
    };
  }

  async function planSiteSettings(sitePackage, options) {
    const ctx = normalizeOptions(options);
    const currentSettings = await getSiteSettings(ctx);
    const sourceSettings = extractSiteSettings(sitePackage);
    return buildSettingsPlan(currentSettings, sourceSettings, ctx);
  }

  async function applySiteSettings(sitePackage, options) {
    const ctx = normalizeOptions(options);
    const plan = await planSiteSettings(sitePackage, ctx);

    if (ctx.dryRun) {
      return {
        dryRun: true,
        message: "No settings were changed. Run with dryRun:false to apply.",
        plan
      };
    }

    const currentSite = await getSite(ctx);
    const currentSettings = await getSiteSettings(ctx);
    const payload = {
      ...siteUpdateBase(currentSite),
      SiteSettings: plan.nextSettings
    };
    const result = await request(ctx, `/api/items/${ctx.targetSiteId}/updatesite`, payload);
    const verify = await getSiteSettings(ctx);

    return {
      dryRun: false,
      result,
      plan,
      verified: summarizeVerified(verify, ctx.sections),
      verifiedViews: Array.isArray(verify.Views) ? verify.Views.map((view) => view.Name || view.Id) : []
    };
  }

  function extractViews(sitePackage) {
    return extractSiteSettings(sitePackage).Views.map(normalizeItem);
  }

  function extractSiteSettings(sitePackage) {
    const site =
      Array.isArray(sitePackage?.Sites) && sitePackage.Sites.length > 0
        ? sitePackage.Sites[0]
        : sitePackage?.Site || sitePackage;
    return site?.SiteSettings || sitePackage?.SiteSettings || {};
  }

  function buildViewPlan(currentSettings, sourceViews, mode) {
    const settingsPlan = buildSettingsPlan(currentSettings, { Views: sourceViews }, { mode, sections: ["Views"] });
    return {
      mode: settingsPlan.mode,
      summary: settingsPlan.summary,
      operations: settingsPlan.operations,
      nextViews: settingsPlan.nextSettings.Views || [],
      viewLatestId: settingsPlan.nextSettings.ViewLatestId || 0
    };
  }

  function buildSettingsPlan(currentSettings, sourceSettings, ctx) {
    const sections = resolveSections(ctx.sections, sourceSettings);
    const nextSettings = { ...currentSettings };
    const operations = [];

    for (const section of sections) {
      if (!arraySettingKeys.includes(section)) {
        operations.push({
          type: "skip",
          section,
          key: section,
          reason: "Unsupported section for this pure-JS applier."
        });
        continue;
      }

      const sectionPlan = buildArraySectionPlan(section, currentSettings[section], sourceSettings[section], ctx.mode);
      operations.push(...sectionPlan.operations);
      nextSettings[section] = sectionPlan.nextItems;

      if (section === "Views") {
        nextSettings.ViewLatestId = sectionPlan.nextItems.reduce(
          (max, item) => Math.max(max, Number(item.Id || 0)),
          0
        );
      }
    }

    return {
      mode: ctx.mode,
      sections,
      summary: summarize(operations),
      operations,
      nextSettings
    };
  }

  function buildArraySectionPlan(section, currentValue = [], sourceValue = [], mode) {
    if (!Array.isArray(sourceValue)) {
      return {
        operations: [{ type: "skip", section, key: section, reason: `${section} is not an array.` }],
        nextItems: Array.isArray(currentValue) ? currentValue : []
      };
    }

    const currentItems = Array.isArray(currentValue) ? currentValue : [];
    const sourceItems = sourceValue.map(normalizeItem);
    const currentByKey = new Map(currentItems.map((item) => [stableKey(item, section), item]));
    const usedKeys = new Set();
    const operations = [];
    const nextItems = mode === "replace" ? [] : currentItems.map((item) => ({ ...item }));

    for (const sourceItem of sourceItems) {
      const key = stableKey(sourceItem, section);
      usedKeys.add(key);
      const currentItem = currentByKey.get(key);
      const normalizedSource = normalizeItem(sourceItem);

      if (currentItem) {
        const merged = { ...currentItem, ...normalizedSource, Id: currentItem.Id };
        operations.push({
          type: sameItem(currentItem, merged, section) ? "skip" : "update",
          section,
          key,
          before: currentItem,
          after: merged
        });
        replaceOrAppend(nextItems, merged, section);
      } else {
        const created = { ...normalizedSource };
        operations.push({ type: "create", section, key, after: created });
        nextItems.push(created);
      }
    }

    if (mode === "replace") {
      for (const currentItem of currentItems) {
        const key = stableKey(currentItem, section);
        if (!usedKeys.has(key)) operations.push({ type: "delete", section, key, before: currentItem });
      }
    }

    assignIds(nextItems);
    return { operations, nextItems };
  }

  async function getSiteSettings(ctx) {
    const response = await request(ctx, `/api/items/${ctx.targetSiteId}/getsite`, {});
    return response?.Response?.Data?.SiteSettings || response?.SiteSettings || response || {};
  }

  async function getSite(ctx) {
    const response = await request(ctx, `/api/items/${ctx.targetSiteId}/get`, {});
    return response?.Response?.Data || response?.Response || response || {};
  }

  async function request(ctx, path, payload) {
    const body = {
      ApiVersion: ctx.apiVersion,
      ApiKey: ctx.apiKey,
      TenantId: ctx.tenantId,
      ...payload
    };
    const response = await fetch(`${ctx.baseUrl}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
    const text = await response.text();
    const json = text ? JSON.parse(text) : {};
    if (!response.ok || json.StatusCode >= 400) {
      throw new Error(`Pleasanter API error ${response.status}: ${text}`);
    }
    return json;
  }

  function normalizeOptions(options = {}) {
    if (!options.apiKey) throw new Error("options.apiKey is required.");
    if (!options.targetSiteId) throw new Error("options.targetSiteId is required.");
    const sections = Array.isArray(options.sections)
      ? options.sections
      : typeof options.sections === "string"
        ? options.sections.split(",").map((item) => item.trim()).filter(Boolean)
        : ["Views"];

    return {
      baseUrl: (options.baseUrl || location.origin).replace(/\/+$/, ""),
      apiKey: options.apiKey,
      tenantId: options.tenantId || 1,
      targetSiteId: options.targetSiteId,
      apiVersion: options.apiVersion || "1.1",
      mode: options.mode || "merge",
      dryRun: options.dryRun !== false,
      sections
    };
  }

  function normalizeItem(view) {
    const normalized = {};
    for (const [key, value] of Object.entries(view || {})) {
      if (!volatileKeys.has(key)) normalized[key] = clone(value);
    }
    return normalized;
  }

  function siteUpdateBase(site) {
    const base = {};
    for (const key of ["Title", "ReferenceType", "ParentId", "InheritPermission"]) {
      if (site && site[key] != null) base[key] = site[key];
    }
    return base;
  }

  function comparableItem(item, section) {
    const comparable = normalizeItem(item);

    if (section !== "Views") {
      delete comparable.Name;
      if (comparable.Disabled === false) delete comparable.Disabled;
    }

    if (section === "Views") {
      for (const key of [
        "FiltersDisplayType",
        "AggregationsDisplayType",
        "ApiColumnKeyDisplayType",
        "ApiColumnValueDisplayType",
        "CalendarSiteId",
        "ApiDataType"
      ]) {
        if (comparable[key] === 0) delete comparable[key];
      }
    }

    return comparable;
  }

  function stableKey(view, section) {
    if (section === "Views") {
      return String(view?.Name || view?.Guid || view?.Title || view?.DisplayName || view?.Id || "");
    }
    return String(view?.Title || view?.Name || view?.Guid || view?.DisplayName || view?.Id || "");
  }

  function sameItem(a, b, section) {
    return JSON.stringify(comparableItem(a, section)) === JSON.stringify(comparableItem(b, section));
  }

  function replaceOrAppend(views, view, section) {
    const index = views.findIndex((item) => stableKey(item, section) === stableKey(view, section));
    if (index >= 0) views[index] = view;
    else views.push(view);
  }

  function assignIds(views) {
    let nextId = 1;
    for (const view of views) {
      view.Id = nextId;
      nextId += 1;
    }
  }

  function summarize(operations) {
    return operations.reduce(
      (summary, operation) => {
        summary[operation.type] = (summary[operation.type] || 0) + 1;
        return summary;
      },
      { create: 0, update: 0, delete: 0, skip: 0 }
    );
  }

  function resolveSections(requestedSections, sourceSettings) {
    if (requestedSections.includes("all")) {
      return arraySettingKeys.filter((key) => Array.isArray(sourceSettings[key]));
    }
    return requestedSections;
  }

  function summarizeVerified(settings, sections) {
    const result = {};
    for (const section of sections) {
      const value = settings[section];
      result[section] = Array.isArray(value) ? value.map((item) => item.Name || item.Title || item.Id) : null;
    }
    return result;
  }

  function promptWithDefault(message, defaultValue) {
    const value = prompt(message, defaultValue == null ? "" : String(defaultValue));
    if (value == null) throw new Error("Canceled.");
    return value.trim();
  }

  function parseSections(value) {
    return String(value || "")
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  }

  function domValue(id) {
    return document.getElementById(id)?.value || "";
  }

  function logPlan(label, fileName, plan) {
    console.log(label, {
      fileName,
      mode: plan.mode,
      sections: plan.sections,
      summary: plan.summary
    });
    console.table(
      plan.operations.map((operation) => ({
        type: operation.type,
        section: operation.section,
        key: operation.key,
        reason: operation.reason || ""
      }))
    );
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
        const file = input.files && input.files[0];
        input.remove();
        if (!file) {
          reject(new Error("No file was selected."));
          return;
        }
        resolve(file);
      });

      document.body.appendChild(input);
      input.click();
    });
  }

  function clone(value) {
    return value == null ? value : JSON.parse(JSON.stringify(value));
  }

  function parseJson(text) {
    return JSON.parse(String(text).replace(/^\uFEFF/, ""));
  }

  const api = {
    samplePackage,
    planViews,
    applyViews,
    planSiteSettings,
    applySiteSettings,
    pickPackageFile,
    pickPackageAndPlan,
    pickPackageAndApply,
    runWizard
  };

  global.PleasanterSitePackageApplier = api;
  global.PleasanterViewPackageApplier = api;
})(window);
