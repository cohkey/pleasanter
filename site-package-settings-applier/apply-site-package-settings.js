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
    "Columns",
    "EditorColumns",
    "GridColumns",
    "Scripts",
    "ServerScripts",
    "Styles",
    "Htmls",
    "Processes",
    "StatusControls",
    "Exports"
  ];
  const objectSettingKeys = ["EditorColumnHash"];
  const supportedSettingKeys = [...arraySettingKeys, ...objectSettingKeys];
  const defaultCompareIgnoreKeys = ["Timestamp"];
  const pseudoColumnNames = new Set(["TitleBody", "SiteTitle"]);
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
    "UpdatedTime"
  ]);
  const columnArrayKeys = new Set([
    "GridColumns",
    "EditorColumns",
    "FilterColumns",
    "LinkColumns",
    "HistoryColumns",
    "MoveTargets",
    "BulkUpdateColumns",
    "ExportColumns",
    "Columns"
  ]);
  const columnHashKeys = new Set([
    "ColumnFilterHash",
    "ColumnSorterHash",
    "ColumnStyles",
    "ColumnAccessControls",
    "ColumnAggregationHash",
    "ColumnWidthHash"
  ]);
  const columnReferenceKeys = new Set([
    "Column",
    "ColumnName",
    "ColumnName1",
    "ColumnName2",
    "DateColumn",
    "GroupBy",
    "KambanGroupBy",
    "CalendarColumn",
    "StartDateColumn",
    "EndDateColumn",
    "CompletionColumn",
    "ValueColumn",
    "TargetColumn",
    "SourceColumn",
    "DestinationColumn"
  ]);
  const enumValueSets = {
    ChoicesControlType: ["", "DropDown", "Radio", "Checkbox"],
    ControlType: ["", "Normal", "MarkDown", "RTEditor", "Spinner"],
    HtmlPositionType: ["1000", "1010", "9000", "9010"],
    ExportType: ["0", "1", 0, 1],
    DelimiterType: ["0", "1", 0, 1],
    ExecutionType: ["0", "1", 0, 1],
    ProcessScreenType: ["10", "20", 10, 20],
    ProcessExecutionType: ["0", "10", "20", 0, 10, 20],
    ProcessActionType: ["0", "10", "90", 0, 10, 90],
    ProcessValidationType: ["0", "10", "90", 0, 10, 90],
    TextAlign: ["", "0", "10", "15", "20", "30", 0, 10, 15, 20, 30],
    ViewerSwitchingType: ["", "0", "1", "2", 0, 1, 2]
  };
  const unsafeSettingKeys = new Set([
    "Notifications",
    "Reminders",
    "Scripts",
    "ServerScripts",
    "Htmls",
    "Processes",
    "StatusControls",
    "Aggregations"
  ]);
  const sectionCatalog = [
    { key: "Version", label: "バージョン", group: "基本", description: "サイト設定のバージョン情報" },
    { key: "ReferenceType", label: "参照種別", group: "基本", description: "テーブル種別。通常は変更しません。" },
    { key: "GeneralTabLabelText", label: "全般タブ名", group: "基本", description: "エディタ画面の全般タブ表示名" },
    { key: "NoDisplayIfReadOnly", label: "読取専用時は非表示", group: "基本", description: "読取専用の項目を画面に表示しない設定" },
    { key: "NotInheritPermissionsWhenCreatingSite", label: "サイト作成時に権限を継承しない", group: "基本", description: "新規サイト作成時の権限継承設定" },
    { key: "AllowApiUpdate", label: "API更新を許可", group: "基本", description: "APIによる更新を許可する設定" },
    { key: "AllowApiDelete", label: "API削除を許可", group: "基本", description: "APIによる削除を許可する設定" },
    { key: "AllowBulkUpdate", label: "一括更新を許可", group: "基本", description: "一覧からの一括更新を許可する設定" },
    { key: "AllowExport", label: "エクスポートを許可", group: "基本", description: "データのエクスポート可否" },
    { key: "AllowImport", label: "インポートを許可", group: "基本", description: "データのインポート可否" },
    { key: "AllowCopy", label: "コピーを許可", group: "基本", description: "レコードやサイトのコピー可否" },
    { key: "AllowMove", label: "移動を許可", group: "基本", description: "レコードやサイトの移動可否" },
    { key: "AllowReferenceFromAnotherSite", label: "他サイトからの参照を許可", group: "基本", description: "他サイトから参照されることを許可する設定" },
    { key: "DefaultViewName", label: "既定の表示", group: "表示", description: "既定で開く表示名" },
    { key: "ViewLatestId", label: "表示ID採番", group: "表示", description: "表示設定の内部ID採番値。通常は表示と一緒に調整されます。" },
    { key: "Views", label: "表示", group: "表示", description: "一覧、カンバン、カレンダーなどのビュー設定" },
    { key: "UseFilterButton", label: "フィルタボタンを使用", group: "表示", description: "一覧のフィルタボタン表示設定" },
    { key: "UseGridHeaderFilters", label: "列ヘッダーフィルタを使用", group: "表示", description: "一覧列ヘッダーのフィルタ表示設定" },
    { key: "UseNegativeFilters", label: "否定フィルタを使用", group: "表示", description: "フィルタで否定条件を使う設定" },
    { key: "GridColumns", label: "一覧項目", group: "表示", description: "一覧に表示する項目" },
    { key: "Calendar", label: "カレンダー", group: "表示", description: "カレンダー表示の設定" },
    { key: "Dashboard", label: "ダッシュボード", group: "表示", description: "ダッシュボード設定" },
    { key: "Columns", label: "項目設定", group: "項目", description: "各項目の表示名、入力制御、検証などの詳細設定" },
    { key: "EditorColumnHash", label: "エディタ", group: "項目", description: "エディタ画面のタブ/見出しと項目配置" },
    { key: "EditorColumns", label: "エディタ項目", group: "項目", description: "エディタに配置する項目の一覧" },
    { key: "Styles", label: "スタイル", group: "拡張", description: "スタイル設定" },
    { key: "Scripts", label: "スクリプト", group: "拡張", description: "クライアントスクリプト" },
    { key: "ServerScripts", label: "サーバスクリプト", group: "拡張", description: "サーバスクリプト" },
    { key: "Htmls", label: "HTML", group: "拡張", description: "HTML設定" },
    { key: "Processes", label: "プロセス", group: "ワークフロー", description: "プロセス設定" },
    { key: "StatusControls", label: "状況制御", group: "ワークフロー", description: "状況ごとの制御設定" },
    { key: "Notifications", label: "通知", group: "自動処理", description: "通知設定" },
    { key: "Reminders", label: "リマインダー", group: "自動処理", description: "リマインダー設定" },
    { key: "NearCompletionTimeBeforeDays", label: "期限前通知日数", group: "自動処理", description: "期限前通知の基準日数" },
    { key: "NearCompletionTimeAfterDays", label: "期限後通知日数", group: "自動処理", description: "期限後通知の基準日数" },
    { key: "Aggregations", label: "集計", group: "出力", description: "集計設定" },
    { key: "Mail", label: "メール", group: "出力", description: "メール設定" },
    { key: "Export", label: "エクスポート", group: "出力", description: "エクスポート設定" },
    { key: "Exports", label: "エクスポート", group: "出力", description: "エクスポート設定" },
    { key: "Comments", label: "コメント", group: "その他", description: "コメント設定。レコードのコメント本文は対象外です。" }
  ];
  const sectionDefinitionByKey = new Map(sectionCatalog.map((section) => [section.key, section]));
  const sectionAliases = new Map();

  for (const section of sectionCatalog) {
    sectionAliases.set(section.key.toLowerCase(), section.key);
    sectionAliases.set(section.label.toLowerCase(), section.key);
  }

  [
    ["all", "all"],
    ["すべて", "all"],
    ["全て", "all"],
    ["全部", "all"],
    ["全設定", "all"],
    ["完全同期", "all"],
    ["ビュー", "Views"],
    ["表示", "Views"],
    ["一覧", "GridColumns"],
    ["一覧項目", "GridColumns"],
    ["項目", "Columns"],
    ["項目設定", "Columns"],
    ["エディタ", "EditorColumnHash"],
    ["エディター", "EditorColumnHash"],
    ["エディタ配置", "EditorColumnHash"],
    ["エディター配置", "EditorColumnHash"],
    ["エディタ項目", "EditorColumns"],
    ["エディター項目", "EditorColumns"],
    ["通知", "Notifications"],
    ["リマインダー", "Reminders"],
    ["スクリプト", "Scripts"],
    ["サーバースクリプト", "ServerScripts"],
    ["サーバスクリプト", "ServerScripts"],
    ["html", "Htmls"],
    ["html設定", "Htmls"],
    ["スタイル", "Styles"],
    ["プロセス", "Processes"],
    ["状況制御", "StatusControls"],
    ["集計", "Aggregations"],
    ["エクスポート", "Exports"],
    ["メール", "Mail"],
    ["コメント", "Comments"]
  ].forEach(([alias, key]) => sectionAliases.set(alias.toLowerCase(), key));

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

  function planEditorColumnsInCurrentPage(sitePackage, options = {}) {
    return applyEditorColumnsInCurrentPage(sitePackage, { ...options, dryRun: true });
  }

  function applyEditorColumnsInCurrentPage(sitePackage, options = {}) {
    const sourceSettings = extractSiteSettings(sitePackage);
    const desiredColumns = extractEditorColumns(sourceSettings, options);
    const currentColumns = readSelectableValues("EditorColumns");
    const operations = diffPrimitiveArray("EditorColumnHash", currentColumns, desiredColumns);
    const plan = {
      mode: "replace",
      sections: ["EditorColumnHash"],
      summary: summarize(operations),
      operations,
      currentColumns,
      nextColumns: desiredColumns
    };

    if (options.dryRun !== false) {
      return {
        dryRun: true,
        message: "No settings were changed. Run with dryRun:false on the table management page to apply.",
        plan
      };
    }

    renderEditorColumns(desiredColumns);
    if (options.save !== false) saveCurrentPageEditorSettings();

    return {
      dryRun: false,
      message: options.save === false
        ? "Editor columns were updated in the current page. Click Update to save."
        : "Editor columns were sent through the current table management page.",
      plan,
      verified: {
        EditorColumns: readSelectableValues("EditorColumns")
      }
    };
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
    const detectedSections = Object.keys(sourceSettings);

    if (detectedSections.length === 0) {
      throw new Error("The selected JSON does not contain SiteSettings sections.");
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

    const sections = await pickSections(sourceSettings, defaults.sections || detectedSections);

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
    const unsafeSections = resolveSections(sections, sourceSettings)
      .filter((section) => unsafeSettingKeys.has(section));
    const allowUnsafeSections = defaults.allowUnsafeSections === true || (
      unsafeSections.length > 0 && confirm(
        [
          "安全確認が必要な設定が含まれています。",
          "",
          `対象: ${formatSectionNames(unsafeSections)}`,
          "",
          "OK: Pleasanter からエクスポートした JSON と確認済みなので適用対象に含める",
          "キャンセル: これらの設定は変更しない"
        ].join("\n")
      )
    );

    const dryRunResult = await applySiteSettings(picked.package, {
      baseUrl: defaults.baseUrl,
      apiKey,
      tenantId,
      targetSiteId,
      sections,
      mode,
      dryRun: true,
      allowUnsafeSections
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
      dryRun: false,
      allowUnsafeSections
    });

    console.log("Applied:", applyResult);
    console.log("Verified:", applyResult.verified);
    console.log("Post-apply compare:", {
      equal: applyResult.postApplyCompare.equal,
      summary: applyResult.postApplyCompare.summary,
      sections: applyResult.postApplyCompare.sections
    });
    if (!applyResult.postApplyCompare.equal) {
      console.table(
        applyResult.postApplyCompare.differences.map((difference) => ({
          type: difference.type,
          section: difference.section
        }))
      );
    }

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

  function compareSitePackages(sourcePackage, targetPackage, options = {}) {
    const sourceSettings = extractSiteSettings(sourcePackage);
    const targetSettings = extractSiteSettings(targetPackage);
    return compareSiteSettings(sourceSettings, targetSettings, options);
  }

  function compareSiteSettings(sourceSettings, targetSettings, options = {}) {
    const sections = resolveCompareSections(options.sections || "all", sourceSettings, targetSettings);
    const ignoreKeys = new Set(options.ignoreKeys || defaultCompareIgnoreKeys);
    const differences = [];

    for (const section of sections) {
      if (ignoreKeys.has(section)) continue;
      const sourceHas = Object.prototype.hasOwnProperty.call(sourceSettings, section);
      const targetHas = Object.prototype.hasOwnProperty.call(targetSettings, section);

      if (!sourceHas && targetHas) {
        differences.push({ type: "extra", section, target: clone(targetSettings[section]) });
      } else if (sourceHas && !targetHas) {
        differences.push({ type: "missing", section, source: clone(sourceSettings[section]) });
      } else if (!sameValue(sourceSettings[section], targetSettings[section])) {
        differences.push({
          type: "different",
          section,
          source: clone(sourceSettings[section]),
          target: clone(targetSettings[section])
        });
      }
    }

    return {
      equal: differences.length === 0,
      summary: summarize(differences),
      sections,
      differences
    };
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
    const postApplyCompare = compareSiteSettings(plan.nextSettings, verify, { sections: ctx.sections });

    return {
      dryRun: false,
      result,
      plan,
      postApplyCompare,
      verified: summarizeVerified(verify, resolveSections(ctx.sections, verify)),
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

  function extractEditorColumns(sourceSettings, options = {}) {
    if (Array.isArray(sourceSettings.EditorColumns)) return uniqueStrings(sourceSettings.EditorColumns);

    const hash = sourceSettings.EditorColumnHash;
    if (!isPlainObject(hash)) throw new Error("SiteSettings.EditorColumnHash or EditorColumns is required.");

    if (options.editorTab && Array.isArray(hash[options.editorTab])) {
      return uniqueStrings(hash[options.editorTab]);
    }

    const preferredKeys = ["General", "全般"];
    const preferredKey = preferredKeys.find((key) => Array.isArray(hash[key]));
    if (preferredKey && options.flattenEditorColumnHash !== true) {
      return uniqueStrings(hash[preferredKey]);
    }

    return uniqueStrings(Object.values(hash).flatMap((items) => (Array.isArray(items) ? items : [])));
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
    const sanitizeResult = sanitizeSourceSettings(sourceSettings, currentSettings, ctx);
    sourceSettings = sanitizeResult.sourceSettings;
    const sections = resolveSections(ctx.sections, sourceSettings);
    const replaceAll = ctx.mode === "replace" && ctx.sections.includes("all");
    const nextSettings = replaceAll ? {} : { ...currentSettings };
    const operations = [...sanitizeResult.operations];

    if (replaceAll) {
      for (const key of Object.keys(currentSettings)) {
        if (!Object.prototype.hasOwnProperty.call(sourceSettings, key)) {
          if (isUnsafeSection(key, ctx)) {
            nextSettings[key] = clone(currentSettings[key]);
            operations.push({
              type: "skip",
              section: key,
              key,
              reason: `${key} is unsafe and was preserved. Set allowUnsafeSections:true to delete it.`
            });
            continue;
          }
          operations.push({ type: "delete", section: key, key, before: currentSettings[key] });
        }
      }
    }

    for (const section of sections) {
      if (isUnsafeSection(section, ctx)) {
        if (Object.prototype.hasOwnProperty.call(currentSettings, section)) {
          nextSettings[section] = clone(currentSettings[section]);
        }
        operations.push({
          type: "skip",
          section,
          key: section,
          reason: `${section} is unsafe and was not changed. Set allowUnsafeSections:true to apply it.`
        });
        continue;
      }

      if (!Object.prototype.hasOwnProperty.call(sourceSettings, section)) {
        if (ctx.mode === "replace" && Object.prototype.hasOwnProperty.call(nextSettings, section)) {
          if (isUnsafeSection(section, ctx)) {
            operations.push({
              type: "skip",
              section,
              key: section,
              reason: `${section} is unsafe and was preserved. Set allowUnsafeSections:true to delete it.`
            });
            continue;
          }
          operations.push({ type: "delete", section, key: section, before: nextSettings[section] });
          delete nextSettings[section];
        } else {
          operations.push({ type: "skip", section, key: section, reason: `${section} is not in source settings.` });
        }
        continue;
      }

      if (arraySettingKeys.includes(section)) {
        const sectionPlan = buildArraySectionPlan(section, currentSettings[section], sourceSettings[section], ctx.mode);
        operations.push(...sectionPlan.operations);
        nextSettings[section] = sectionPlan.nextItems;

        if (section === "Views") {
          nextSettings.ViewLatestId = sectionPlan.nextItems.reduce(
            (max, item) => Math.max(max, Number(item.Id || 0)),
            0
          );
        }
      } else if (objectSettingKeys.includes(section)) {
        const sectionPlan = buildObjectSectionPlan(
          section,
          currentSettings[section],
          sourceSettings[section],
          ctx.mode
        );
        operations.push(...sectionPlan.operations);
        nextSettings[section] = sectionPlan.nextValue;
      } else {
        const sectionPlan = buildRawSectionPlan(section, currentSettings[section], sourceSettings[section]);
        operations.push(...sectionPlan.operations);
        nextSettings[section] = sectionPlan.nextValue;
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
    const sourceItems = sourceValue.map((item) => normalizeArrayItem(item, section));
    const currentByKey = new Map(currentItems.map((item) => [stableKey(item, section), item]));
    const usedKeys = new Set();
    const operations = [];
    const nextItems = mode === "replace" ? [] : currentItems.map((item) => clone(item));

    for (const sourceItem of sourceItems) {
      const key = stableKey(sourceItem, section);
      usedKeys.add(key);
      const currentItem = currentByKey.get(key);
      const normalizedSource = normalizeArrayItem(sourceItem, section);

      if (currentItem) {
        const merged = ctxMergeItem(currentItem, normalizedSource, section, mode);
        operations.push({
          type: sameItem(currentItem, merged, section) ? "skip" : "update",
          section,
          key,
          before: currentItem,
          after: merged
        });
        replaceOrAppend(nextItems, merged, section);
      } else {
        const created = isObjectItem(normalizedSource) ? { ...normalizedSource } : normalizedSource;
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

    assignIds(nextItems, section);
    return { operations, nextItems };
  }

  function diffPrimitiveArray(section, currentItems, sourceItems) {
    const currentSet = new Set(currentItems);
    const sourceSet = new Set(sourceItems);
    const operations = [];

    for (const key of sourceItems) {
      operations.push({
        type: currentSet.has(key) ? "skip" : "create",
        section,
        key,
        after: key
      });
    }

    for (const key of currentItems) {
      if (!sourceSet.has(key)) operations.push({ type: "delete", section, key, before: key });
    }

    if (
      operations.every((operation) => operation.type === "skip") &&
      JSON.stringify(currentItems) !== JSON.stringify(sourceItems)
    ) {
      operations.push({
        type: "update",
        section,
        key: `${section}:order`,
        before: currentItems,
        after: sourceItems
      });
    }

    return operations;
  }

  function buildObjectSectionPlan(section, currentValue = {}, sourceValue = {}, mode) {
    if (!isPlainObject(sourceValue)) {
      return {
        operations: [{ type: "skip", section, key: section, reason: `${section} is not an object.` }],
        nextValue: isPlainObject(currentValue) ? clone(currentValue) : {}
      };
    }

    const currentObject = isPlainObject(currentValue) ? currentValue : {};
    const sourceObject = clone(sourceValue);
    const nextValue = mode === "replace" ? {} : clone(currentObject);
    const operations = [];
    const sourceKeys = new Set(Object.keys(sourceObject));

    for (const [key, sourceItem] of Object.entries(sourceObject)) {
      const currentItem = currentObject[key];
      const exists = Object.prototype.hasOwnProperty.call(currentObject, key);
      const nextItem = clone(sourceItem);
      nextValue[key] = nextItem;
      operations.push({
        type: exists ? (sameValue(currentItem, nextItem) ? "skip" : "update") : "create",
        section,
        key,
        before: exists ? currentItem : undefined,
        after: nextItem
      });
    }

    if (mode === "replace") {
      for (const key of Object.keys(currentObject)) {
        if (!sourceKeys.has(key)) {
          operations.push({ type: "delete", section, key, before: currentObject[key] });
        }
      }
    }

    return { operations, nextValue };
  }

  function buildRawSectionPlan(section, currentValue, sourceValue) {
    const nextValue = clone(sourceValue);
    const exists = currentValue !== undefined;
    return {
      operations: [
        {
          type: exists ? (sameValue(currentValue, nextValue) ? "skip" : "update") : "create",
          section,
          key: section,
          before: exists ? currentValue : undefined,
          after: nextValue
        }
      ],
      nextValue
    };
  }

  function sanitizeSourceSettings(sourceSettings, currentSettings, ctx) {
    if (ctx.validateReferences === false) {
      return {
        sourceSettings: clone(sourceSettings),
        operations: []
      };
    }

    const validColumns = collectValidColumnNames(currentSettings, ctx);
    const operations = [];
    const sanitized = {};

    for (const [section, value] of Object.entries(sourceSettings || {})) {
      sanitized[section] = sanitizeSettingValue(value, {
        section,
        path: section,
        validColumns,
        operations
      });
    }

    return {
      sourceSettings: sanitized,
      operations
    };
  }

  function sanitizeSettingValue(value, ctx) {
    if (Array.isArray(value)) {
      if (ctx.section === "Columns") {
        return value.flatMap((item) => sanitizeColumnDefinition(item, ctx));
      }
      if (isColumnArrayPath(ctx.path)) {
        return sanitizeColumnArray(value, ctx);
      }
      return value
        .map((item, index) => sanitizeSettingValue(item, { ...ctx, path: `${ctx.path}[${index}]` }))
        .filter((item) => item !== undefined);
    }

    if (!isPlainObject(value)) return clone(value);

    if (ctx.section === "EditorColumnHash" || ctx.path.endsWith(".EditorColumnHash")) {
      return sanitizeEditorColumnHash(value, ctx);
    }

    const sanitized = {};
    for (const [key, item] of Object.entries(value)) {
      const itemPath = `${ctx.path}.${key}`;

      if (columnHashKeys.has(key) && isPlainObject(item)) {
        sanitized[key] = sanitizeColumnHash(item, { ...ctx, path: itemPath });
        continue;
      }

      if (isColumnReferenceKey(key) && typeof item === "string") {
        if (isBlankColumnReference(item) || isValidColumnReference(item, ctx.validColumns)) {
          sanitized[key] = item;
        } else {
          addSanitizeSkip(ctx, itemPath, item, "column reference does not exist in the target table");
        }
        continue;
      }

      if (Object.prototype.hasOwnProperty.call(enumValueSets, key) && !enumValueSets[key].includes(item)) {
        addSanitizeSkip(ctx, itemPath, item, "value is not available in the target UI options");
        continue;
      }

      sanitized[key] = sanitizeSettingValue(item, { ...ctx, path: itemPath });
    }

    return sanitized;
  }

  function sanitizeColumnDefinition(item, ctx) {
    if (!isObjectItem(item)) return [clone(item)];
    const columnName = item.ColumnName;
    if (!isValidColumnReference(columnName, ctx.validColumns)) {
      addSanitizeSkip(ctx, `${ctx.path}.${columnName || "(blank)"}`, columnName, "column does not exist in the target table");
      return [];
    }

    const sanitized = sanitizeSettingValue(item, { ...ctx, path: `${ctx.path}.${columnName}` });
    normalizeFieldCss(sanitized, ctx, columnName);
    const choices = parseChoiceValues(sanitized.ChoicesText);
    if (choices.size > 0 && sanitized.DefaultInput != null && sanitized.DefaultInput !== "") {
      const values = String(sanitized.DefaultInput)
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean);
      const invalidValues = values.filter((value) => !choices.has(value));
      if (invalidValues.length > 0) {
        addSanitizeSkip(
          ctx,
          `${ctx.path}.${columnName}.DefaultInput`,
          sanitized.DefaultInput,
          `default value is not in ChoicesText: ${invalidValues.join(", ")}`
        );
        delete sanitized.DefaultInput;
      }
    }

    return [sanitized];
  }

  function normalizeFieldCss(column, ctx, columnName) {
    const value = column.FieldCss;
    if (value != null && value !== "" && !allowedFieldCssValues(columnName, column).has(value)) {
      addSanitizeSkip(
        ctx,
        `${ctx.path}.${columnName}.FieldCss`,
        value,
        "value is not available in the target UI options"
      );
      delete column.FieldCss;
    }

    if (column.ControlType === "RTEditor" && !column.FieldCss) {
      column.FieldCss = "field-rte";
      ctx.operations.push({
        type: "update",
        section: ctx.section,
        key: `${ctx.path}.${columnName}.FieldCss`,
        after: "field-rte",
        reason: "RTEditor requires a valid FieldCss; normalized to field-rte"
      });
    }
  }

  function allowedFieldCssValues(columnName, column) {
    const values = new Set(["", "field-normal", "field-wide", "field-title", "field-radio", "field-markdown", "field-rte"]);
    return values;
  }

  function sanitizeEditorColumnHash(value, ctx) {
    const sanitized = {};
    for (const [key, items] of Object.entries(value)) {
      if (Array.isArray(items)) {
        sanitized[key] = sanitizeColumnArray(items, { ...ctx, path: `${ctx.path}.${key}` });
      } else {
        sanitized[key] = clone(items);
      }
    }
    return sanitized;
  }

  function sanitizeColumnArray(items, ctx) {
    const sanitized = [];
    for (const item of items) {
      if (typeof item === "string") {
        if (isValidColumnReference(item, ctx.validColumns)) {
          sanitized.push(item);
        } else {
          addSanitizeSkip(ctx, ctx.path, item, "column reference does not exist in the target table");
        }
      } else if (isObjectItem(item) && typeof item.ColumnName === "string") {
        const columnName = item.ColumnName;
        if (isValidColumnReference(columnName, ctx.validColumns)) {
          sanitized.push(sanitizeSettingValue(item, { ...ctx, path: `${ctx.path}.${columnName}` }));
        } else {
          addSanitizeSkip(ctx, `${ctx.path}.${columnName}`, columnName, "column reference does not exist in the target table");
        }
      } else {
        sanitized.push(sanitizeSettingValue(item, ctx));
      }
    }
    return uniqueByJson(sanitized);
  }

  function sanitizeColumnHash(hash, ctx) {
    const sanitized = {};
    for (const [key, value] of Object.entries(hash)) {
      if (isValidColumnReference(key, ctx.validColumns)) {
        sanitized[key] = sanitizeSettingValue(value, { ...ctx, path: `${ctx.path}.${key}` });
      } else {
        addSanitizeSkip(ctx, `${ctx.path}.${key}`, key, "column hash key does not exist in the target table");
      }
    }
    return sanitized;
  }

  function addSanitizeSkip(ctx, key, value, reason) {
    ctx.operations.push({
      type: "skip",
      section: ctx.section,
      key,
      before: value,
      reason
    });
  }

  function collectValidColumnNames(currentSettings, ctx) {
    const names = new Set([...systemColumnNames, ...pseudoColumnNames]);
    for (const prefix of ["Class", "Num", "Date", "Description", "Check", "Attachments"]) {
      for (let code = 65; code <= 90; code += 1) {
        names.add(`${prefix}${String.fromCharCode(code)}`);
      }
    }

    collectColumnNamesFromSettings(currentSettings, names);
    for (const name of ctx.extraValidColumns || []) {
      if (name) names.add(String(name));
    }
    return names;
  }

  function collectColumnNamesFromSettings(settings, names) {
    for (const item of settings?.Columns || []) {
      if (item?.ColumnName) names.add(item.ColumnName);
    }
    for (const item of settings?.GridColumns || []) {
      if (typeof item === "string") names.add(item);
      else if (item?.ColumnName) names.add(item.ColumnName);
    }
    if (isPlainObject(settings?.EditorColumnHash)) {
      for (const items of Object.values(settings.EditorColumnHash)) {
        for (const item of Array.isArray(items) ? items : []) {
          if (typeof item === "string") names.add(item);
          else if (item?.ColumnName) names.add(item.ColumnName);
        }
      }
    }
  }

  function isColumnArrayPath(path) {
    const key = String(path || "").split(".").pop().replace(/\[\d+\]$/, "");
    return columnArrayKeys.has(key);
  }

  function isColumnReferenceKey(key) {
    return columnReferenceKeys.has(key) || /ColumnName$/.test(key);
  }

  function isBlankColumnReference(value) {
    return value == null || value === "" || value === "*";
  }

  function isValidColumnReference(value, validColumns) {
    if (isBlankColumnReference(value)) return true;
    return validColumns.has(String(value));
  }

  function parseChoiceValues(choicesText) {
    const values = new Set();
    for (const line of String(choicesText || "").split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      values.add(trimmed.split(",")[0].trim());
    }
    return values;
  }

  function uniqueByJson(items) {
    const seen = new Set();
    return items.filter((item) => {
      const key = JSON.stringify(item);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  async function getSiteSettings(ctx) {
    const response = await request(ctx, `/api/items/${ctx.targetSiteId}/getsite`, {});
    return response?.Response?.Data?.SiteSettings || response?.SiteSettings || response || {};
  }

  async function getSite(ctx) {
    const response = await request(ctx, `/api/items/${ctx.targetSiteId}/getsite`, {});
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
    const json = parseApiResponseJson(text, response, path);
    if (!response.ok || json.StatusCode >= 400) {
      throw new Error(`Pleasanter API error ${response.status}: ${text}`);
    }
    return json;
  }

  function parseApiResponseJson(text, response, path) {
    if (!text) return {};
    try {
      return JSON.parse(text);
    } catch (error) {
      const preview = text
        .replace(/<[^>]*>/g, " ")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 240);
      throw new Error(
        [
          `Pleasanter API returned a non-JSON response for ${path}.`,
          `HTTP ${response.status} ${response.statusText || ""}`.trim(),
          response.url ? `URL: ${response.url}` : "",
          preview ? `Preview: ${preview}` : "",
          "This usually means updatesite rejected one of the SiteSettings values."
        ].filter(Boolean).join("\n")
      );
    }
  }

  function normalizeOptions(options = {}) {
    if (!options.apiKey) throw new Error("options.apiKey is required.");
    if (!options.targetSiteId) throw new Error("options.targetSiteId is required.");
    const sections = parseSections(options.sections == null ? "Views" : options.sections);

    return {
      baseUrl: (options.baseUrl || location.origin).replace(/\/+$/, ""),
      apiKey: options.apiKey,
      tenantId: options.tenantId || 1,
      targetSiteId: options.targetSiteId,
      apiVersion: options.apiVersion || "1.1",
      mode: options.mode || "merge",
      dryRun: options.dryRun !== false,
      allowUnsafeSections: options.allowUnsafeSections === true,
      validateReferences: options.validateReferences !== false,
      extraValidColumns: Array.isArray(options.extraValidColumns) ? options.extraValidColumns : [],
      sections
    };
  }

  function isUnsafeSection(section, ctx) {
    return unsafeSettingKeys.has(section) && ctx.allowUnsafeSections !== true;
  }

  function ctxMergeItem(currentItem, normalizedSource, section, mode) {
    if (mode === "replace") return clone(normalizedSource);
    if (isObjectItem(currentItem) && isObjectItem(normalizedSource)) {
      const merged = { ...currentItem, ...normalizedSource };
      if (section !== "Columns" && currentItem.Id != null) merged.Id = currentItem.Id;
      return merged;
    }
    return normalizedSource;
  }

  function normalizeItem(view) {
    const normalized = {};
    for (const [key, value] of Object.entries(view || {})) {
      if (!volatileKeys.has(key)) normalized[key] = clone(value);
    }
    return normalized;
  }

  function normalizeArrayItem(item, section) {
    return isObjectItem(item) ? normalizeItem(item) : item;
  }

  function siteUpdateBase(site) {
    const base = {};
    for (const key of ["Title", "ReferenceType", "ParentId", "InheritPermission"]) {
      if (site && site[key] != null) base[key] = site[key];
    }
    return base;
  }

  function comparableItem(item, section) {
    if (!isObjectItem(item)) return clone(item);

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
    if (!isObjectItem(view)) return String(view ?? "");
    if (section === "Views") {
      return String(view?.Name || view?.Guid || view?.Title || view?.DisplayName || view?.Id || "");
    }
    if (section === "Columns") {
      return String(view?.ColumnName || view?.Name || view?.Id || "");
    }
    return String(view?.Title || view?.Name || view?.Guid || view?.DisplayName || view?.Id || "");
  }

  function sameItem(a, b, section) {
    return sameValue(comparableItem(a, section), comparableItem(b, section));
  }

  function replaceOrAppend(views, view, section) {
    const index = views.findIndex((item) => stableKey(item, section) === stableKey(view, section));
    if (index >= 0) views[index] = view;
    else views.push(view);
  }

  function assignIds(views, section) {
    if (!["Views", "Scripts", "ServerScripts", "Styles", "Htmls", "Processes", "StatusControls", "Exports"].includes(section)) {
      return;
    }
    let nextId = 1;
    for (const view of views) {
      if (isObjectItem(view)) {
        view.Id = nextId;
        nextId += 1;
      }
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
      return Object.keys(sourceSettings);
    }
    return requestedSections;
  }

  function resolveCompareSections(requestedSections, sourceSettings, targetSettings) {
    const parsed = Array.isArray(requestedSections) ? requestedSections : parseSections(requestedSections);
    if (parsed.includes("all")) {
      return [...new Set([...Object.keys(sourceSettings), ...Object.keys(targetSettings)])].sort();
    }
    return parsed;
  }

  function summarizeVerified(settings, sections) {
    const result = {};
    for (const section of sections) {
      const value = settings[section];
      if (Array.isArray(value)) {
        result[section] = value.map((item) => isObjectItem(item) ? item.ColumnName || item.Name || item.Title || item.Id : item);
      } else if (isPlainObject(value)) {
        result[section] = Object.fromEntries(
          Object.entries(value).map(([key, item]) => [key, Array.isArray(item) ? item.length : item])
        );
      } else {
        result[section] = null;
      }
    }
    return result;
  }

  function readSelectableValues(id) {
    const element = document.getElementById(id);
    if (!element) throw new Error(`#${id} was not found. Open the table management editor page first.`);
    return Array.from(element.querySelectorAll("li"))
      .map((item) => item.getAttribute("data-value") || item.textContent.trim())
      .filter(Boolean);
  }

  function renderEditorColumns(columnNames) {
    const editorColumns = document.getElementById("EditorColumns");
    const sourceColumns = document.getElementById("EditorSourceColumns");
    if (!editorColumns) throw new Error("#EditorColumns was not found. Open the table management editor page first.");

    const existingItems = new Map(
      Array.from(document.querySelectorAll("#EditorColumns > li, #EditorSourceColumns > li")).map((item) => [
        item.getAttribute("data-value") || item.textContent.trim(),
        item
      ])
    );

    editorColumns.replaceChildren(
      ...columnNames.map((columnName, index) => {
        const existing = existingItems.get(columnName);
        const item = existing ? existing.cloneNode(true) : document.createElement("li");
        item.classList.remove("ui-selected", "ui-selectee", "selected", "is-selected");
        item.setAttribute("data-value", columnName);
        item.setAttribute("data-order", String(index));
        if (!existing) item.textContent = columnName;
        return item;
      })
    );

    if (sourceColumns) {
      const enabled = new Set(columnNames);
      Array.from(sourceColumns.querySelectorAll("li")).forEach((item) => {
        const value = item.getAttribute("data-value") || item.textContent.trim();
        if (enabled.has(value)) item.remove();
      });
    }

    if (global.jQuery && global.$p?.setData) global.$p.setData(global.jQuery(editorColumns));
  }

  function saveCurrentPageEditorSettings() {
    if (!global.jQuery || !global.$p?.send) {
      throw new Error("Pleasanter page helpers were not found. Click Update manually or run on the table management page.");
    }
    const updateCommand = global.jQuery("#UpdateCommand");
    if (updateCommand.length !== 1) throw new Error("#UpdateCommand was not found. Click Update manually.");
    global.$p.send(updateCommand);
  }

  function hasSupportedSection(settings, key) {
    if (arraySettingKeys.includes(key)) return Array.isArray(settings[key]);
    if (objectSettingKeys.includes(key)) return isPlainObject(settings[key]);
    return false;
  }

  function isObjectItem(value) {
    return value != null && typeof value === "object" && !Array.isArray(value);
  }

  function isPlainObject(value) {
    if (!isObjectItem(value)) return false;
    const prototype = Object.getPrototypeOf(value);
    return prototype === Object.prototype || prototype === null;
  }

  function sameValue(a, b) {
    return JSON.stringify(canonicalize(a)) === JSON.stringify(canonicalize(b));
  }

  function canonicalize(value) {
    if (Array.isArray(value)) return value.map(canonicalize);
    if (isPlainObject(value)) {
      return Object.fromEntries(
        Object.keys(value)
          .sort()
          .map((key) => [key, canonicalize(value[key])])
      );
    }
    return value;
  }

  function uniqueStrings(items) {
    return [...new Set(items.map((item) => String(item || "").trim()).filter(Boolean))];
  }

  function sectionLabel(section) {
    return sectionDefinitionByKey.get(section)?.label || section;
  }

  function sectionGroup(section) {
    return sectionDefinitionByKey.get(section)?.group || "その他";
  }

  function sectionDescription(section) {
    return sectionDefinitionByKey.get(section)?.description || "サイトパッケージ JSON に含まれる設定";
  }

  function formatSectionNames(sections) {
    return parseSections(sections)
      .map((section) => (section === "all" ? "すべて (all)" : `${sectionLabel(section)} (${section})`))
      .join(", ");
  }

  function selectableSections(sourceSettings) {
    const catalogOrder = new Map(sectionCatalog.map((section, index) => [section.key, index]));
    return Object.keys(sourceSettings || {})
      .map((key) => ({
        key,
        label: sectionLabel(key),
        group: sectionGroup(key),
        description: sectionDescription(key),
        unsafe: unsafeSettingKeys.has(key),
        known: sectionDefinitionByKey.has(key),
        order: catalogOrder.has(key) ? catalogOrder.get(key) : Number.MAX_SAFE_INTEGER
      }))
      .sort((a, b) => a.order - b.order || a.group.localeCompare(b.group, "ja") || a.label.localeCompare(b.label, "ja") || a.key.localeCompare(b.key));
  }

  async function pickSections(sourceSettings, defaultSections) {
    const choices = selectableSections(sourceSettings);
    const initialSections = parseSections(defaultSections);
    const defaultText = initialSections.includes("all")
      ? "all"
      : (initialSections.length > 0 ? initialSections : choices.map((choice) => choice.key)).join(",");

    if (!global.document?.body) {
      const sectionsText = promptWithDefault(
        [
          "対象設定を入力してください。",
          "日本語名、英語キー、カンマ、読点、改行区切りが使えます。",
          `JSON内の設定: ${formatSectionNames(choices.map((choice) => choice.key))}`,
          "例: 表示,項目設定,エディタ または all"
        ].join("\n"),
        defaultText
      );
      return parseSections(sectionsText);
    }

    return showSectionPickerDialog(choices, initialSections);
  }

  function showSectionPickerDialog(choices, initialSections) {
    return new Promise((resolve, reject) => {
      const initialSet = initialSections.includes("all")
        ? new Set(choices.map((choice) => choice.key))
        : new Set(initialSections);
      const overlay = document.createElement("div");
      overlay.className = "psa-section-picker";
      overlay.innerHTML = sectionPickerHtml(choices, initialSet, initialSections.includes("all"));

      const cleanup = () => {
        document.removeEventListener("keydown", onKeyDown);
        overlay.remove();
      };
      const finish = (sections) => {
        cleanup();
        resolve(sections);
      };
      const cancel = () => {
        cleanup();
        reject(new Error("Canceled."));
      };
      const checkboxItems = () => Array.from(overlay.querySelectorAll("input[data-section-key]"));
      const allMode = () => overlay.querySelector("[data-all-mode]");
      const summary = () => overlay.querySelector("[data-summary]");
      const setChecked = (predicate) => {
        checkboxItems().forEach((checkbox) => {
          checkbox.checked = predicate(checkbox.dataset.sectionKey);
        });
        updateSummary();
      };
      const updateSummary = () => {
        const selected = checkboxItems().filter((checkbox) => checkbox.checked);
        const unsafeCount = selected.filter((checkbox) => checkbox.dataset.unsafe === "true").length;
        const allText = allMode()?.checked ? " / 完全同期(all)" : "";
        summary().textContent = `${selected.length}件を選択中${unsafeCount ? ` / 注意 ${unsafeCount}件` : ""}${allText}`;
      };
      const applyFilter = () => {
        const term = String(overlay.querySelector("[data-search]")?.value || "").trim().toLowerCase();
        const rows = Array.from(overlay.querySelectorAll("[data-section-row]"));
        rows.forEach((row) => {
          const text = row.dataset.searchText || "";
          row.hidden = term !== "" && !text.includes(term);
        });
        Array.from(overlay.querySelectorAll("[data-section-group]")).forEach((group) => {
          const visibleRows = Array.from(group.querySelectorAll("[data-section-row]")).filter((row) => !row.hidden);
          group.hidden = visibleRows.length === 0;
        });
      };
      const onKeyDown = (event) => {
        if (event.key === "Escape") cancel();
      };

      overlay.addEventListener("click", (event) => {
        const action = event.target?.closest?.("[data-action]")?.dataset.action;
        if (!action) return;
        if (action === "cancel") cancel();
        if (action === "all") {
          setChecked(() => true);
          if (allMode()) allMode().checked = false;
        }
        if (action === "safe") {
          setChecked((key) => !unsafeSettingKeys.has(key));
          if (allMode()) allMode().checked = false;
        }
        if (action === "none") {
          setChecked(() => false);
          if (allMode()) allMode().checked = false;
        }
        if (action === "sync") {
          setChecked(() => true);
          if (allMode()) allMode().checked = true;
        }
        if (action === "apply") {
          const selected = checkboxItems()
            .filter((checkbox) => checkbox.checked)
            .map((checkbox) => checkbox.dataset.sectionKey);
          if (selected.length === 0) {
            summary().textContent = "対象設定を1件以上選択してください。";
            return;
          }
          finish(allMode()?.checked ? ["all"] : selected);
        }
        updateSummary();
      });

      overlay.addEventListener("change", (event) => {
        if (event.target?.matches?.("input[data-section-key], [data-all-mode]")) updateSummary();
      });
      overlay.querySelector("[data-search]")?.addEventListener("input", applyFilter);
      document.addEventListener("keydown", onKeyDown);
      document.body.appendChild(overlay);
      overlay.querySelector("[data-search]")?.focus();
      updateSummary();
    });
  }

  function sectionPickerHtml(choices, initialSet, allMode) {
    const groups = [];
    for (const choice of choices) {
      let group = groups.find((item) => item.name === choice.group);
      if (!group) {
        group = { name: choice.group, choices: [] };
        groups.push(group);
      }
      group.choices.push(choice);
    }
    const rows = groups.map((group) => `
      <section class="psa-section-group" data-section-group>
        <h3>${escapeHtml(group.name)}</h3>
        ${group.choices.map((choice) => sectionPickerRowHtml(choice, initialSet.has(choice.key))).join("")}
      </section>
    `).join("");

    return `
      <style>
        .psa-section-picker {
          position: fixed;
          inset: 0;
          z-index: 2147483647;
          display: grid;
          place-items: center;
          background: rgba(20, 25, 33, 0.38);
          color: #1f2937;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        }
        .psa-section-dialog {
          width: min(920px, calc(100vw - 40px));
          max-height: min(780px, calc(100vh - 40px));
          display: grid;
          grid-template-rows: auto auto minmax(260px, 1fr) auto;
          background: #f7f8fa;
          border: 1px solid #d6dbe3;
          border-radius: 14px;
          box-shadow: 0 24px 80px rgba(15, 23, 42, 0.28);
          overflow: hidden;
        }
        .psa-section-header,
        .psa-section-toolbar,
        .psa-section-footer {
          padding: 16px 20px;
          background: rgba(255, 255, 255, 0.86);
          backdrop-filter: blur(14px);
        }
        .psa-section-header h2 {
          margin: 0 0 4px;
          font-size: 20px;
          font-weight: 700;
        }
        .psa-section-header p,
        .psa-section-footer p {
          margin: 0;
          color: #5f6b7a;
          font-size: 13px;
          line-height: 1.5;
        }
        .psa-section-toolbar {
          display: grid;
          grid-template-columns: minmax(220px, 1fr) auto;
          gap: 12px;
          border-top: 1px solid #e2e6ed;
          border-bottom: 1px solid #e2e6ed;
        }
        .psa-section-search {
          width: 100%;
          box-sizing: border-box;
          padding: 10px 12px;
          border: 1px solid #cfd6df;
          border-radius: 8px;
          font-size: 14px;
          background: #fff;
        }
        .psa-section-actions,
        .psa-section-footer-actions {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          align-items: center;
          justify-content: flex-end;
        }
        .psa-section-button {
          border: 1px solid #c9d1dc;
          border-radius: 8px;
          background: #fff;
          color: #263241;
          padding: 8px 12px;
          font-size: 13px;
          cursor: pointer;
        }
        .psa-section-button.primary {
          border-color: #2563eb;
          background: #2563eb;
          color: #fff;
          font-weight: 700;
        }
        .psa-section-button.warning {
          border-color: #c2410c;
          color: #9a3412;
        }
        .psa-section-list {
          padding: 8px 20px 20px;
          overflow: auto;
        }
        .psa-section-group {
          margin-top: 14px;
        }
        .psa-section-group h3 {
          position: sticky;
          top: -8px;
          z-index: 1;
          margin: 0;
          padding: 10px 0 8px;
          background: #f7f8fa;
          color: #374151;
          font-size: 13px;
          font-weight: 700;
        }
        .psa-section-row {
          display: grid;
          grid-template-columns: auto 170px minmax(180px, 1fr) auto;
          gap: 12px;
          align-items: start;
          min-height: 44px;
          padding: 10px 12px;
          border: 1px solid #e2e6ed;
          border-radius: 8px;
          background: #fff;
        }
        .psa-section-row + .psa-section-row {
          margin-top: 6px;
        }
        .psa-section-row input {
          margin-top: 3px;
        }
        .psa-section-name {
          font-weight: 700;
          color: #111827;
        }
        .psa-section-key {
          color: #64748b;
          font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
          font-size: 12px;
          word-break: break-all;
        }
        .psa-section-description {
          color: #4b5563;
          font-size: 12px;
          line-height: 1.5;
        }
        .psa-section-badge {
          justify-self: end;
          border-radius: 999px;
          padding: 3px 8px;
          background: #fff7ed;
          color: #c2410c;
          border: 1px solid #fed7aa;
          font-size: 12px;
          font-weight: 700;
        }
        .psa-section-footer {
          display: grid;
          grid-template-columns: minmax(220px, 1fr) auto;
          gap: 12px;
          border-top: 1px solid #e2e6ed;
        }
        .psa-section-allmode {
          display: flex;
          gap: 8px;
          align-items: flex-start;
          margin-top: 6px;
          color: #475569;
          font-size: 12px;
          line-height: 1.5;
        }
        @media (max-width: 720px) {
          .psa-section-toolbar,
          .psa-section-footer,
          .psa-section-row {
            grid-template-columns: 1fr;
          }
          .psa-section-actions,
          .psa-section-footer-actions {
            justify-content: flex-start;
          }
        }
      </style>
      <div class="psa-section-dialog" role="dialog" aria-modal="true" aria-label="対象設定を選択">
        <header class="psa-section-header">
          <h2>対象設定を選択</h2>
          <p>サイトパッケージ JSON に含まれている設定だけを表示しています。注意マークの設定は dry-run 前に追加確認します。</p>
        </header>
        <div class="psa-section-toolbar">
          <input class="psa-section-search" data-search type="search" placeholder="設定名、英語キー、説明で絞り込み">
          <div class="psa-section-actions">
            <button class="psa-section-button" type="button" data-action="all">全選択</button>
            <button class="psa-section-button" type="button" data-action="safe">安全な設定だけ</button>
            <button class="psa-section-button" type="button" data-action="none">解除</button>
            <button class="psa-section-button warning" type="button" data-action="sync">完全同期(all)</button>
          </div>
        </div>
        <main class="psa-section-list">${rows}</main>
        <footer class="psa-section-footer">
          <div>
            <p data-summary></p>
            <label class="psa-section-allmode">
              <input type="checkbox" data-all-mode ${allMode ? "checked" : ""}>
              <span>all として適用する。replace の場合、JSONに存在しない設定も削除対象になります。</span>
            </label>
          </div>
          <div class="psa-section-footer-actions">
            <button class="psa-section-button" type="button" data-action="cancel">キャンセル</button>
            <button class="psa-section-button primary" type="button" data-action="apply">選択して進む</button>
          </div>
        </footer>
      </div>
    `;
  }

  function sectionPickerRowHtml(choice, checked) {
    const searchText = [
      choice.key,
      choice.label,
      choice.group,
      choice.description,
      choice.unsafe ? "注意 unsafe" : ""
    ].join(" ").toLowerCase();
    return `
      <label class="psa-section-row" data-section-row data-search-text="${escapeHtml(searchText)}">
        <input
          type="checkbox"
          data-section-key="${escapeHtml(choice.key)}"
          data-unsafe="${choice.unsafe ? "true" : "false"}"
          ${checked ? "checked" : ""}
        >
        <span>
          <span class="psa-section-name">${escapeHtml(choice.label)}</span>
          <span class="psa-section-key">${escapeHtml(choice.key)}</span>
        </span>
        <span class="psa-section-description">${escapeHtml(choice.description)}</span>
        ${choice.unsafe ? '<span class="psa-section-badge">注意</span>' : ""}
      </label>
    `;
  }

  function promptWithDefault(message, defaultValue) {
    const value = prompt(message, defaultValue == null ? "" : String(defaultValue));
    if (value == null) throw new Error("Canceled.");
    return value.trim();
  }

  function parseSections(value) {
    const items = Array.isArray(value) ? value : String(value || "").split(/[,\n、，]/);
    return uniqueStrings(
      items
        .map((item) => normalizeSectionName(item))
        .filter(Boolean)
    );
  }

  function normalizeSectionName(value) {
    const text = String(value || "").replace(/\u3000/g, " ").trim();
    if (!text) return "";
    return sectionAliases.get(text.toLowerCase()) || text;
  }

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, (char) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    }[char]));
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
    planEditorColumnsInCurrentPage,
    applyEditorColumnsInCurrentPage,
    compareSitePackages,
    compareSiteSettings,
    planSiteSettings,
    applySiteSettings,
    pickPackageFile,
    pickPackageAndPlan,
    pickPackageAndApply,
    runWizard,
    parseSections,
    sectionLabel,
    selectableSections
  };

  global.PleasanterSitePackageApplier = api;
  global.PleasanterViewPackageApplier = api;
})(window);
