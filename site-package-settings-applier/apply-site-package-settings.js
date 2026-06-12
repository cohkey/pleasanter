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
    "FilterColumns",
    "LinkColumns",
    "HistoryColumns",
    "MoveTargets",
    "Summaries",
    "Formulas",
    "Imports",
    "Aggregations",
    "Notifications",
    "Reminders",
    "Scripts",
    "ServerScripts",
    "Styles",
    "Htmls",
    "Processes",
    "StatusControls",
    "Exports",
    "Sections",
    "CreateColumnAccessControls",
    "ReadColumnAccessControls",
    "UpdateColumnAccessControls"
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
  const unsafeSectionKeys = new Set([
    ...unsafeSettingKeys,
    "Site.ReferenceType",
    "Site.ParentId",
    "Site.InheritPermission",
    "Package.Permissions",
    "Package.PermissionIdList",
    "Package.Data"
  ]);
  const sectionCatalog = [
    { key: "Version", label: "バージョン", group: "全般", description: "サイト設定のバージョン情報" },
    { key: "ReferenceType", label: "参照種別", group: "全般", description: "テーブル種別。通常は変更しません。" },
    { key: "GeneralTabLabelText", label: "全般タブ名", group: "全般", description: "エディタ画面の全般タブ表示名" },
    { key: "NoDisplayIfReadOnly", label: "読取専用時は非表示", group: "全般", description: "読取専用の項目を画面に表示しない設定" },
    { key: "NotInheritPermissionsWhenCreatingSite", label: "サイト作成時に権限を継承しない", group: "全般", description: "新規サイト作成時の権限継承設定" },
    { key: "AllowApiUpdate", label: "API更新を許可", group: "全般", description: "APIによる更新を許可する設定" },
    { key: "AllowApiDelete", label: "API削除を許可", group: "全般", description: "APIによる削除を許可する設定" },
    { key: "AllowBulkUpdate", label: "一括更新を許可", group: "全般", description: "一覧からの一括更新を許可する設定" },
    { key: "AllowExport", label: "エクスポートを許可", group: "全般", description: "データのエクスポート可否" },
    { key: "AllowImport", label: "インポートを許可", group: "全般", description: "データのインポート可否" },
    { key: "AllowCopy", label: "コピーを許可", group: "全般", description: "レコードやサイトのコピー可否" },
    { key: "AllowMove", label: "移動を許可", group: "全般", description: "レコードやサイトの移動可否" },
    { key: "AllowReferenceFromAnotherSite", label: "他サイトからの参照を許可", group: "全般", description: "他サイトから参照されることを許可する設定" },
    { key: "TitleColumns", label: "タイトル項目", group: "全般", description: "タイトル表示に使う項目" },
    { key: "TitleSeparator", label: "タイトル区切り文字", group: "全般", description: "複数タイトル項目の区切り文字" },
    { key: "GridColumns", label: "一覧項目", group: "一覧", description: "一覧に表示する項目" },
    { key: "GridView", label: "一覧表示", group: "一覧", description: "一覧表示の基本設定" },
    { key: "UseGridHeaderFilters", label: "列ヘッダーフィルタを使用", group: "一覧", description: "一覧列ヘッダーのフィルタ表示設定" },
    { key: "FilterColumns", label: "フィルタ項目", group: "フィルタ", description: "フィルタに表示する項目" },
    { key: "UseFilterButton", label: "フィルタボタンを使用", group: "フィルタ", description: "一覧のフィルタボタン表示設定" },
    { key: "UseNegativeFilters", label: "否定フィルタを使用", group: "フィルタ", description: "フィルタで否定条件を使う設定" },
    { key: "Aggregations", label: "集計", group: "集計", description: "集計設定" },
    { key: "Columns", label: "項目設定", group: "エディタ", description: "各項目の表示名、入力制御、検証などの詳細設定" },
    { key: "EditorColumnHash", label: "エディタ", group: "エディタ", description: "エディタ画面のタブ/見出しと項目配置" },
    { key: "EditorColumns", label: "エディタ項目", group: "エディタ", description: "エディタに配置する項目の一覧" },
    { key: "Sections", label: "セクション", group: "エディタ", description: "エディタのセクション設定" },
    { key: "SectionLatestId", label: "セクションID採番", group: "エディタ", description: "セクション設定の内部ID採番値" },
    { key: "LinkColumns", label: "リンク項目", group: "リンク", description: "リンクタブに表示する項目" },
    { key: "HistoryColumns", label: "履歴項目", group: "履歴", description: "履歴タブに表示する項目" },
    { key: "MoveTargets", label: "移動先", group: "移動", description: "レコード移動先サイトの設定" },
    { key: "Summaries", label: "サマリ", group: "サマリ", description: "サマリ設定" },
    { key: "Formulas", label: "計算式", group: "計算式", description: "計算式設定" },
    { key: "Processes", label: "プロセス", group: "プロセス", description: "プロセス設定" },
    { key: "StatusControls", label: "状況による制御", group: "状況による制御", description: "状況ごとの制御設定" },
    { key: "DefaultViewName", label: "既定の表示", group: "ビュー", description: "既定で開く表示名" },
    { key: "ViewLatestId", label: "表示ID採番", group: "ビュー", description: "表示設定の内部ID採番値。通常は表示と一緒に調整されます。" },
    { key: "Views", label: "ビュー", group: "ビュー", description: "一覧、カンバン、カレンダーなどのビュー設定" },
    { key: "Notifications", label: "通知", group: "通知", description: "通知設定" },
    { key: "Reminders", label: "リマインダー", group: "リマインダー", description: "リマインダー設定" },
    { key: "NearCompletionTimeBeforeDays", label: "期限前通知日数", group: "リマインダー", description: "期限前通知の基準日数" },
    { key: "NearCompletionTimeAfterDays", label: "期限後通知日数", group: "リマインダー", description: "期限後通知の基準日数" },
    { key: "Imports", label: "インポート", group: "インポート", description: "インポート設定" },
    { key: "Export", label: "エクスポート", group: "エクスポート", description: "エクスポート設定" },
    { key: "Exports", label: "エクスポート", group: "エクスポート", description: "エクスポート設定" },
    { key: "Calendar", label: "カレンダー", group: "カレンダー", description: "カレンダー表示の設定" },
    { key: "EnableCalendar", label: "カレンダーを有効化", group: "カレンダー", description: "カレンダー機能の有効化設定" },
    { key: "Crosstab", label: "クロス集計", group: "クロス集計", description: "クロス集計設定" },
    { key: "EnableCrosstab", label: "クロス集計を有効化", group: "クロス集計", description: "クロス集計機能の有効化設定" },
    { key: "Gantt", label: "ガントチャート", group: "ガントチャート", description: "ガントチャート設定" },
    { key: "EnableGantt", label: "ガントチャートを有効化", group: "ガントチャート", description: "ガントチャート機能の有効化設定" },
    { key: "ShowGanttProgressRate", label: "進捗率を表示", group: "ガントチャート", description: "ガントチャートの進捗率表示設定" },
    { key: "BurnDown", label: "バーンダウンチャート", group: "バーンダウンチャート", description: "バーンダウンチャート設定" },
    { key: "EnableBurnDown", label: "バーンダウンチャートを有効化", group: "バーンダウンチャート", description: "バーンダウンチャート機能の有効化設定" },
    { key: "TimeSeries", label: "時系列チャート", group: "時系列チャート", description: "時系列チャート設定" },
    { key: "EnableTimeSeries", label: "時系列チャートを有効化", group: "時系列チャート", description: "時系列チャート機能の有効化設定" },
    { key: "Analy", label: "分析チャート", group: "分析チャート", description: "分析チャート設定" },
    { key: "Kamban", label: "カンバン", group: "カンバン", description: "カンバン設定" },
    { key: "EnableKamban", label: "カンバンを有効化", group: "カンバン", description: "カンバン機能の有効化設定" },
    { key: "ImageLib", label: "画像ライブラリ", group: "画像ライブラリ", description: "画像ライブラリ設定" },
    { key: "Search", label: "検索", group: "検索", description: "検索設定" },
    { key: "Mail", label: "メール", group: "メール", description: "メール設定" },
    { key: "SiteIntegration", label: "サイト統合", group: "サイト統合", description: "サイト統合設定" },
    { key: "Styles", label: "スタイル", group: "スタイル", description: "スタイル設定" },
    { key: "Scripts", label: "スクリプト", group: "スクリプト", description: "クライアントスクリプト" },
    { key: "ServerScripts", label: "サーバスクリプト", group: "サーバスクリプト", description: "サーバスクリプト" },
    { key: "Htmls", label: "HTML", group: "HTML", description: "HTML設定" },
    { key: "PermissionForCreating", label: "レコード作成のアクセス制御", group: "レコードのアクセス制御", description: "レコード作成時のアクセス制御" },
    { key: "PermissionForUpdating", label: "レコード更新のアクセス制御", group: "レコードのアクセス制御", description: "レコード更新時のアクセス制御" },
    { key: "CreateColumnAccessControls", label: "作成時の項目アクセス制御", group: "項目のアクセス制御", description: "作成時の項目アクセス制御" },
    { key: "ReadColumnAccessControls", label: "読取時の項目アクセス制御", group: "項目のアクセス制御", description: "読取時の項目アクセス制御" },
    { key: "UpdateColumnAccessControls", label: "更新時の項目アクセス制御", group: "項目のアクセス制御", description: "更新時の項目アクセス制御" },
    { key: "ChangeHistoryList", label: "変更履歴の一覧", group: "変更履歴の一覧", description: "変更履歴一覧の設定" },
    { key: "Dashboard", label: "ダッシュボード", group: "ダッシュボード", description: "ダッシュボード設定" },
    { key: "DashboardParts", label: "ダッシュボードパーツ", group: "ダッシュボード", description: "ダッシュボードパーツ設定" },
    { key: "Comments", label: "コメント", group: "その他", description: "コメント設定。レコードのコメント本文は対象外です。" }
  ];
  const sitePropertyCatalog = [
    { key: "Title", label: "タイトル", group: "全般", description: "管理画面のタイトル" },
    { key: "SiteName", label: "サイト名", group: "全般", description: "管理画面のサイト名" },
    { key: "SiteGroupName", label: "サイトグループ名", group: "全般", description: "管理画面のサイトグループ名" },
    { key: "Body", label: "内容", group: "全般", description: "管理画面の内容" },
    { key: "GridGuide", label: "一覧の説明", group: "ガイド", description: "一覧画面に表示する説明" },
    { key: "EditorGuide", label: "エディタの説明", group: "ガイド", description: "エディタ画面に表示する説明" },
    { key: "CalendarGuide", label: "カレンダーの説明", group: "ガイド", description: "カレンダー画面に表示する説明" },
    { key: "CrosstabGuide", label: "クロス集計の説明", group: "ガイド", description: "クロス集計画面に表示する説明" },
    { key: "GanttGuide", label: "ガントチャートの説明", group: "ガイド", description: "ガントチャート画面に表示する説明" },
    { key: "BurnDownGuide", label: "バーンダウンチャートの説明", group: "ガイド", description: "バーンダウンチャート画面に表示する説明" },
    { key: "TimeSeriesGuide", label: "時系列チャートの説明", group: "ガイド", description: "時系列チャート画面に表示する説明" },
    { key: "AnalyGuide", label: "分析チャートの説明", group: "ガイド", description: "分析チャート画面に表示する説明" },
    { key: "KambanGuide", label: "カンバンの説明", group: "ガイド", description: "カンバン画面に表示する説明" },
    { key: "ImageLibGuide", label: "画像ライブラリの説明", group: "ガイド", description: "画像ライブラリ画面に表示する説明" },
    { key: "SiteImage", label: "サイト画像", group: "サイト画像", description: "サイト画像設定" },
    { key: "SiteImageId", label: "サイト画像ID", group: "サイト画像", description: "サイト画像の内部ID" },
    { key: "ReferenceType", label: "サイト参照種別", group: "全般", description: "サイト本体の参照種別。通常は変更しません。" },
    { key: "ParentId", label: "親サイトID", group: "全般", description: "親サイトID" },
    { key: "InheritPermission", label: "権限継承", group: "全般", description: "権限の継承設定" },
    { key: "Publish", label: "公開", group: "全般", description: "公開設定" },
    { key: "DisableCrossSearch", label: "横断検索を無効化", group: "検索", description: "横断検索の対象外にする設定" },
    { key: "Comments", label: "管理コメント", group: "全般", description: "管理画面のコメント欄。レコードコメント本文ではありません。" }
  ];
  const packageSectionCatalog = [
    { key: "Package.Permissions", label: "サイトのアクセス制御", group: "サイトのアクセス制御", description: "サイトパッケージ最上位の権限情報。updatesite では適用しません。", unsupported: true },
    { key: "Package.PermissionIdList", label: "権限ID一覧", group: "サイトのアクセス制御", description: "サイトパッケージ最上位の権限ID一覧。updatesite では適用しません。", unsupported: true },
    { key: "Package.Data", label: "レコードデータ", group: "データ", description: "サイトパッケージ内のレコードデータ。設定同期の対象外です。", unsupported: true }
  ];
  const excludedSitePropertyKeys = new Set(["TenantId", "SiteId", "SiteSettings"]);
  const sectionDefinitionByKey = new Map(sectionCatalog.map((section) => [section.key, section]));
  const sitePropertyDefinitionByKey = new Map(sitePropertyCatalog.map((section) => [`Site.${section.key}`, {
    ...section,
    key: `Site.${section.key}`
  }]));
  const packageSectionDefinitionByKey = new Map(packageSectionCatalog.map((section) => [section.key, section]));
  const sectionAliases = new Map();

  for (const section of sectionCatalog) {
    sectionAliases.set(section.key.toLowerCase(), section.key);
    sectionAliases.set(section.label.toLowerCase(), section.key);
  }
  for (const section of sitePropertyCatalog) {
    sectionAliases.set(`site.${section.key}`.toLowerCase(), `Site.${section.key}`);
    sectionAliases.set(section.label.toLowerCase(), `Site.${section.key}`);
  }
  for (const section of packageSectionCatalog) {
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
    ["全般", "Site.Body"],
    ["ビュー", "Views"],
    ["表示", "Views"],
    ["一覧", "GridColumns"],
    ["一覧項目", "GridColumns"],
    ["フィルタ", "FilterColumns"],
    ["フィルター", "FilterColumns"],
    ["リンク", "LinkColumns"],
    ["履歴", "HistoryColumns"],
    ["移動", "MoveTargets"],
    ["サマリ", "Summaries"],
    ["計算式", "Formulas"],
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
    ["インポート", "Imports"],
    ["スクリプト", "Scripts"],
    ["サーバースクリプト", "ServerScripts"],
    ["サーバスクリプト", "ServerScripts"],
    ["html", "Htmls"],
    ["html設定", "Htmls"],
    ["スタイル", "Styles"],
    ["プロセス", "Processes"],
    ["状況制御", "StatusControls"],
    ["状況による制御", "StatusControls"],
    ["集計", "Aggregations"],
    ["エクスポート", "Exports"],
    ["カレンダー", "Calendar"],
    ["クロス集計", "Crosstab"],
    ["ガントチャート", "Gantt"],
    ["バーンダウンチャート", "BurnDown"],
    ["時系列チャート", "TimeSeries"],
    ["分析チャート", "Analy"],
    ["カンバン", "Kamban"],
    ["画像ライブラリ", "ImageLib"],
    ["検索", "Search"],
    ["メール", "Mail"],
    ["サイト統合", "SiteIntegration"],
    ["サイトのアクセス制御", "Package.Permissions"],
    ["レコードのアクセス制御", "PermissionForUpdating"],
    ["項目のアクセス制御", "UpdateColumnAccessControls"],
    ["変更履歴の一覧", "ChangeHistoryList"],
    ["タイトル", "Site.Title"],
    ["内容", "Site.Body"],
    ["説明", "Site.Body"],
    ["ガイド", "Site.GridGuide"],
    ["サイト画像", "Site.SiteImage"],
    ["一覧の説明", "Site.GridGuide"],
    ["エディタの説明", "Site.EditorGuide"],
    ["カレンダーの説明", "Site.CalendarGuide"],
    ["カンバンの説明", "Site.KambanGuide"],
    ["公開", "Site.Publish"],
    ["横断検索", "Site.DisableCrossSearch"],
    ["横断検索を無効化", "Site.DisableCrossSearch"],
    ["管理コメント", "Site.Comments"],
    ["管理画面コメント", "Site.Comments"],
    ["管理画面のコメント", "Site.Comments"],
    ["コメント欄", "Site.Comments"],
    ["コメント", "Site.Comments"]
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
    const sourceSite = extractSite(picked.package);
    const sourceSettings = extractSiteSettings(picked.package);
    const detectedSections = selectableSections(picked.package).map((section) => section.key);

    if (detectedSections.length === 0) {
      throw new Error("The selected JSON does not contain site settings.");
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

    const mode = defaults.mode || (
      confirm(
        [
          "適用モードを選んでください。",
          "",
          "OK: replace（JSONに合わせる。対象にしかない設定は削除対象）",
          "キャンセル: merge（追加・更新のみ。既存設定は残す）",
          "",
          "通常はキャンセルを選んで merge にしてください。"
        ].join("\n")
      ) ? "replace" : "merge"
    );
    const preflightCtx = normalizeOptions({
      baseUrl: defaults.baseUrl,
      apiKey,
      tenantId,
      targetSiteId,
      sections: "all",
      mode,
      dryRun: true,
      allowUnsafeSections: true
    });
    const targetSite = defaults.targetSite || await getSite(preflightCtx);
    const preflight = buildPreflightComparison(picked.package, targetSite, { mode });
    logPreflightComparison("Preflight comparison", picked.fileName, preflight, mode);

    const sections = await pickSections(
      { site: sourceSite, settings: sourceSettings },
      defaults.sections == null ? preflight.recommendedSections : defaults.sections,
      { preflight, mode }
    );
    const unsafeSections = expandRequestedSections(sections, extractSiteProperties(sourceSite), sourceSettings)
      .filter((section) => unsafeSectionKeys.has(section));
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
    const currentSite = await getSite(ctx);
    const currentSettings = currentSite.SiteSettings || {};
    const sourceSite = extractSite(sitePackage);
    const sourceSettings = extractSiteSettings(sitePackage);
    const packagePlan = buildPackageSectionsPlan(sitePackage, ctx);
    const settingsPlan = buildSettingsPlan(currentSettings, sourceSettings, {
      ...ctx,
      sections: settingSectionsFor(ctx.sections, sourceSettings)
    });
    const sitePlan = buildSitePropertiesPlan(currentSite, sourceSite, ctx);
    const operations = [...sitePlan.operations, ...settingsPlan.operations, ...packagePlan.operations];

    return {
      mode: ctx.mode,
      sections: [...sitePlan.sections, ...settingsPlan.sections, ...packagePlan.sections],
      summary: summarize(operations),
      operations,
      nextSiteProperties: sitePlan.nextSiteProperties,
      nextSettings: settingsPlan.nextSettings,
      nextViews: settingsPlan.nextSettings.Views || [],
      viewLatestId: settingsPlan.nextSettings.ViewLatestId || 0
    };
  }

  function compareSitePackages(sourcePackage, targetPackage, options = {}) {
    const requestedSections = parseSections(options.sections || "all");
    const sourceSite = extractSite(sourcePackage);
    const targetSite = extractSite(targetPackage);
    const sourceSettings = extractSiteSettings(sourcePackage);
    const targetSettings = extractSiteSettings(targetPackage);
    const siteCompare = compareSiteProperties(sourceSite, targetSite, requestedSections, options);
    const settingsCompare = compareSiteSettings(sourceSettings, targetSettings, {
      ...options,
      sections: compareSettingSectionsFor(requestedSections, sourceSettings, targetSettings)
    });
    const differences = [...siteCompare.differences, ...settingsCompare.differences];

    return {
      equal: differences.length === 0,
      summary: summarize(differences),
      sections: [...siteCompare.sections, ...settingsCompare.sections],
      differences
    };
  }

  function buildPreflightComparison(sourcePackage, targetSite, options = {}) {
    const sourceSite = extractSite(sourcePackage);
    const sourceSettings = extractSiteSettings(sourcePackage);
    const targetSettings = targetSite?.SiteSettings || {};
    const sourceProperties = extractSiteProperties(sourceSite);
    const targetProperties = extractSiteProperties(targetSite || {});
    const compare = compareSitePackages(
      { Site: { ...sourceSite, SiteSettings: sourceSettings } },
      { Site: { ...(targetSite || {}), SiteSettings: targetSettings } },
      { sections: "all" }
    );
    const rows = compare.differences.map((difference) => {
      const section = difference.section;
      const sourceHas = sectionExists(section, sourceProperties, sourceSettings);
      const targetHas = sectionExists(section, targetProperties, targetSettings);
      const targetOnly = !sourceHas && targetHas;
      const deleteRisk = targetOnly && !isSiteSection(section);
      return {
        section,
        label: sectionLabel(section),
        type: difference.type,
        status: preflightStatusLabel(difference.type, deleteRisk),
        source: sourceHas ? "あり" : "なし",
        target: targetHas ? "あり" : "なし",
        recommended: sourceHas,
        deleteRisk,
        reason: preflightReason(difference.type, section, deleteRisk)
      };
    });

    return {
      mode: options.mode || "merge",
      compare,
      rows,
      recommendedSections: rows.filter((row) => row.recommended).map((row) => row.section),
      deleteRiskSections: rows.filter((row) => row.deleteRisk).map((row) => row.section),
      targetOnlySections: rows.filter((row) => !row.recommended).map((row) => row.section)
    };
  }

  function sectionExists(section, siteProperties, settings) {
    if (isSiteSection(section)) {
      return Object.prototype.hasOwnProperty.call(siteProperties || {}, sitePropertyKey(section));
    }
    return Object.prototype.hasOwnProperty.call(settings || {}, section);
  }

  function preflightStatusLabel(type, deleteRisk) {
    if (deleteRisk) return "replaceで削除候補";
    return {
      different: "変更あり",
      missing: "適用元のみ",
      extra: "適用先のみ"
    }[type] || type || "";
  }

  function preflightReason(type, section, deleteRisk) {
    if (deleteRisk) return "適用元JSONにないため、replaceで選ぶと適用先から削除されます。";
    if (type === "different") return "適用元と適用先の値が異なります。";
    if (type === "missing") return "適用元JSONにあり、適用先にはありません。";
    if (type === "extra") {
      return isSiteSection(section)
        ? "適用先にだけあります。サイト本体項目は自動削除しません。"
        : "適用先にだけあります。mergeでは残ります。";
    }
    return "";
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

  function compareSiteProperties(sourceSite, targetSite, requestedSections, options = {}) {
    const sourceProperties = extractSiteProperties(sourceSite);
    const targetProperties = extractSiteProperties(targetSite);
    const sections = resolveCompareSiteSections(requestedSections, sourceProperties, targetProperties);
    const ignoreKeys = new Set(options.ignoreKeys || defaultCompareIgnoreKeys);
    const differences = [];

    for (const section of sections) {
      const key = sitePropertyKey(section);
      if (ignoreKeys.has(section) || ignoreKeys.has(key)) continue;
      const sourceHas = Object.prototype.hasOwnProperty.call(sourceProperties, key);
      const targetHas = Object.prototype.hasOwnProperty.call(targetProperties, key);

      if (!sourceHas && targetHas) {
        differences.push({ type: "extra", section, target: clone(targetProperties[key]) });
      } else if (sourceHas && !targetHas) {
        differences.push({ type: "missing", section, source: clone(sourceProperties[key]) });
      } else if (!sameValue(sourceProperties[key], targetProperties[key])) {
        differences.push({
          type: "different",
          section,
          source: clone(sourceProperties[key]),
          target: clone(targetProperties[key])
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
    const payload = {
      ...siteUpdateBase(currentSite),
      ...plan.nextSiteProperties,
      SiteSettings: plan.nextSettings
    };
    const result = await request(ctx, `/api/items/${ctx.targetSiteId}/updatesite`, payload);
    const verifySite = await getSite(ctx);
    const verify = verifySite.SiteSettings || {};
    const postApplyCompare = compareSitePackages(
      { Site: { ...plan.nextSiteProperties, SiteSettings: plan.nextSettings } },
      { Site: verifySite },
      { sections: ctx.sections }
    );

    return {
      dryRun: false,
      result,
      plan,
      postApplyCompare,
      verifiedSiteProperties: summarizeVerifiedSiteProperties(
        verifySite,
        resolveSiteSections(ctx.sections, extractSiteProperties(verifySite))
      ),
      verified: summarizeVerified(verify, resolveSections(settingSectionsFor(ctx.sections, verify), verify)),
      verifiedViews: Array.isArray(verify.Views) ? verify.Views.map((view) => view.Name || view.Id) : []
    };
  }

  function extractViews(sitePackage) {
    return extractSiteSettings(sitePackage).Views.map(normalizeItem);
  }

  function extractSite(sitePackage) {
    return Array.isArray(sitePackage?.Sites) && sitePackage.Sites.length > 0
      ? sitePackage.Sites[0]
      : sitePackage?.Site || sitePackage;
  }

  function extractSiteSettings(sitePackage) {
    const site = extractSite(sitePackage);
    return site?.SiteSettings || sitePackage?.SiteSettings || {};
  }

  function extractSiteProperties(site) {
    const source = extractSite(site) || {};
    const properties = {};
    const keys = uniqueStrings([
      ...sitePropertyCatalog.map((property) => property.key),
      ...Object.keys(source)
    ]);

    for (const key of keys) {
      if (excludedSitePropertyKeys.has(key)) continue;
      if (Object.prototype.hasOwnProperty.call(source, key)) properties[key] = clone(source[key]);
    }
    return properties;
  }

  function extractPackageSections(sitePackage) {
    const site = extractSite(sitePackage) || {};
    const sections = {};

    for (const section of packageSectionCatalog) {
      const key = packageSectionKey(section.key);
      if (Object.prototype.hasOwnProperty.call(sitePackage || {}, key)) {
        sections[section.key] = clone(sitePackage[key]);
      } else if (Object.prototype.hasOwnProperty.call(site, key)) {
        sections[section.key] = clone(site[key]);
      }
    }

    return sections;
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

  function buildSitePropertiesPlan(currentSite, sourceSite, ctx) {
    const currentProperties = extractSiteProperties(currentSite);
    const sourceProperties = extractSiteProperties(sourceSite);
    const sections = resolveSiteSections(ctx.sections, sourceProperties);
    const operations = [];
    const nextSiteProperties = {};

    for (const section of sections) {
      const key = sitePropertyKey(section);
      if (isUnsafeSection(section, ctx)) {
        if (Object.prototype.hasOwnProperty.call(currentProperties, key)) {
          nextSiteProperties[key] = clone(currentProperties[key]);
        }
        operations.push({
          type: "skip",
          section,
          key: section,
          reason: `${section} is unsafe and was not changed. Set allowUnsafeSections:true to apply it.`
        });
        continue;
      }
      const sourceHas = Object.prototype.hasOwnProperty.call(sourceProperties, key);
      const currentHas = Object.prototype.hasOwnProperty.call(currentProperties, key);

      if (!sourceHas) {
        operations.push({ type: "skip", section, key: section, reason: `${section} is not in source site.` });
        continue;
      }

      const before = currentHas ? currentProperties[key] : undefined;
      const after = sourceProperties[key];
      nextSiteProperties[key] = clone(after);
      operations.push({
        type: currentHas ? (sameValue(before, after) ? "skip" : "update") : "create",
        section,
        key: section,
        before: clone(before),
        after: clone(after)
      });
    }

    return {
      sections,
      operations,
      nextSiteProperties
    };
  }

  function buildPackageSectionsPlan(sitePackage, ctx) {
    const sourceSections = extractPackageSections(sitePackage);
    const sections = resolvePackageSections(ctx.sections, sourceSections);
    const operations = sections.map((section) => ({
      type: "skip",
      section,
      key: section,
      before: clone(sourceSections[section]),
      reason: `${section} is a top-level site-package section and is not applied by updatesite.`
    }));

    return {
      sections,
      operations
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
    return unsafeSectionKeys.has(section) && ctx.allowUnsafeSections !== true;
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
    if (![
      "Views",
      "Scripts",
      "ServerScripts",
      "Styles",
      "Htmls",
      "Processes",
      "StatusControls",
      "Exports",
      "Imports",
      "Notifications",
      "Reminders",
      "Aggregations",
      "Summaries",
      "Formulas",
      "Sections",
      "CreateColumnAccessControls",
      "ReadColumnAccessControls",
      "UpdateColumnAccessControls"
    ].includes(section)) {
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
    return requestedSections.filter((section) => !isSiteSection(section));
  }

  function resolveCompareSections(requestedSections, sourceSettings, targetSettings) {
    const parsed = Array.isArray(requestedSections) ? requestedSections : parseSections(requestedSections);
    if (parsed.includes("all")) {
      return [...new Set([...Object.keys(sourceSettings), ...Object.keys(targetSettings)])].sort();
    }
    return parsed.filter((section) => !isSiteSection(section));
  }

  function settingSectionsFor(requestedSections, sourceSettings) {
    const parsed = parseSections(requestedSections);
    if (parsed.includes("all")) return ["all"];
    return parsed.filter((section) => !isSiteSection(section) && !isPackageSection(section));
  }

  function compareSettingSectionsFor(requestedSections, sourceSettings, targetSettings) {
    const parsed = parseSections(requestedSections);
    if (parsed.includes("all")) return "all";
    return parsed.filter((section) => !isSiteSection(section) && !isPackageSection(section));
  }

  function resolveSiteSections(requestedSections, sourceProperties) {
    const parsed = parseSections(requestedSections);
    if (parsed.includes("all")) {
      return Object.keys(sourceProperties || {}).map((key) => `Site.${key}`);
    }
    return parsed.filter((section) => isSiteSection(section));
  }

  function resolveCompareSiteSections(requestedSections, sourceProperties, targetProperties) {
    const parsed = parseSections(requestedSections);
    if (parsed.includes("all")) {
      return [...new Set([
        ...Object.keys(sourceProperties || {}).map((key) => `Site.${key}`),
        ...Object.keys(targetProperties || {}).map((key) => `Site.${key}`)
      ])].sort();
    }
    return parsed.filter((section) => isSiteSection(section));
  }

  function resolvePackageSections(requestedSections, sourceSections) {
    const parsed = parseSections(requestedSections);
    if (parsed.includes("all")) {
      return Object.keys(sourceSections || {});
    }
    return parsed.filter((section) => isPackageSection(section));
  }

  function expandRequestedSections(requestedSections, sourceProperties, sourceSettings) {
    const parsed = parseSections(requestedSections);
    if (parsed.includes("all")) {
      return [
        ...Object.keys(sourceProperties || {}).map((key) => `Site.${key}`),
        ...Object.keys(sourceSettings || {})
      ];
    }
    return parsed;
  }

  function isSiteSection(section) {
    return String(section || "").startsWith("Site.");
  }

  function sitePropertyKey(section) {
    return String(section || "").replace(/^Site\./, "");
  }

  function isPackageSection(section) {
    return String(section || "").startsWith("Package.");
  }

  function packageSectionKey(section) {
    return String(section || "").replace(/^Package\./, "");
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

  function summarizeVerifiedSiteProperties(site, sections) {
    const result = {};
    for (const section of sections) {
      const key = sitePropertyKey(section);
      const value = site?.[key];
      result[section] = Array.isArray(value) ? value.length : value ?? null;
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
    if (isSiteSection(section)) return sitePropertyDefinitionByKey.get(section)?.label || section;
    if (isPackageSection(section)) return packageSectionDefinitionByKey.get(section)?.label || section;
    return sectionDefinitionByKey.get(section)?.label || section;
  }

  function sectionGroup(section) {
    if (isSiteSection(section)) return sitePropertyDefinitionByKey.get(section)?.group || "サイト";
    if (isPackageSection(section)) return packageSectionDefinitionByKey.get(section)?.group || "パッケージ";
    return sectionDefinitionByKey.get(section)?.group || "その他";
  }

  function sectionDescription(section) {
    if (isSiteSection(section)) return sitePropertyDefinitionByKey.get(section)?.description || "サイト本体の設定";
    if (isPackageSection(section)) return packageSectionDefinitionByKey.get(section)?.description || "サイトパッケージ最上位の設定";
    return sectionDefinitionByKey.get(section)?.description || "サイトパッケージ JSON に含まれる設定";
  }

  function formatSectionNames(sections) {
    return parseSections(sections)
      .map((section) => (section === "all" ? "すべて (all)" : `${sectionLabel(section)} (${section})`))
      .join(", ");
  }

  function selectableSections(sourceSettings) {
    const catalogOrder = new Map(sectionCatalog.map((section, index) => [section.key, index]));
    const siteOrder = new Map(sitePropertyCatalog.map((section, index) => [`Site.${section.key}`, index]));
    const packageOrder = new Map(packageSectionCatalog.map((section, index) => [section.key, index]));
    const hasPackageShape = sourceSettings?.SiteSettings || sourceSettings?.Sites || sourceSettings?.Site;
    const sourceSite = sourceSettings?.site || (hasPackageShape ? extractSite(sourceSettings) : {});
    const packageSections = hasPackageShape ? extractPackageSections(sourceSettings) : {};
    const settings = sourceSettings?.settings || (
      hasPackageShape
        ? extractSiteSettings(sourceSettings)
        : sourceSettings
    );
    const siteProperties = extractSiteProperties(sourceSite || {});
    const siteKeys = uniqueStrings([
      ...sitePropertyCatalog.map((property) => property.key),
      ...Object.keys(siteProperties || {})
    ]);
    const settingKeys = uniqueStrings([
      ...sectionCatalog.map((section) => section.key),
      ...Object.keys(settings || {})
    ]);
    const packageKeys = hasPackageShape
      ? uniqueStrings([
          ...packageSectionCatalog.map((section) => section.key),
          ...Object.keys(packageSections || {})
        ])
      : [];

    const siteSections = siteKeys.map((key) => {
      const sectionKey = `Site.${key}`;
      return {
        key: sectionKey,
        label: sectionLabel(sectionKey),
        group: sectionGroup(sectionKey),
        description: sectionDescription(sectionKey),
        unsafe: unsafeSectionKeys.has(sectionKey),
        known: sitePropertyDefinitionByKey.has(sectionKey),
        inSource: Object.prototype.hasOwnProperty.call(siteProperties, key),
        order: siteOrder.has(sectionKey) ? siteOrder.get(sectionKey) : Number.MAX_SAFE_INTEGER
      };
    });
    const settingSections = settingKeys
      .map((key) => ({
        key,
        label: sectionLabel(key),
        group: sectionGroup(key),
        description: sectionDescription(key),
        unsafe: unsafeSectionKeys.has(key),
        known: sectionDefinitionByKey.has(key),
        inSource: Object.prototype.hasOwnProperty.call(settings || {}, key),
        order: 1000 + (catalogOrder.has(key) ? catalogOrder.get(key) : Number.MAX_SAFE_INTEGER)
      }));
    const topLevelSections = packageKeys.map((key) => ({
      key,
      label: sectionLabel(key),
      group: sectionGroup(key),
      description: sectionDescription(key),
      unsafe: true,
      unsupported: true,
      known: packageSectionDefinitionByKey.has(key),
      inSource: Object.prototype.hasOwnProperty.call(packageSections || {}, key),
      order: 2000 + (packageOrder.has(key) ? packageOrder.get(key) : Number.MAX_SAFE_INTEGER)
    }));

    return [...siteSections, ...settingSections, ...topLevelSections]
      .sort((a, b) => a.order - b.order || a.group.localeCompare(b.group, "ja") || a.label.localeCompare(b.label, "ja") || a.key.localeCompare(b.key));
  }

  async function pickSections(sourceSettings, defaultSections, options = {}) {
    const choices = decorateSectionChoices(selectableSections(sourceSettings), options.preflight);
    const hasDefaultSections = defaultSections != null;
    const initialSections = parseSections(defaultSections);
    const defaultText = initialSections.includes("all")
      ? "all"
      : (initialSections.length > 0
          ? initialSections
          : (hasDefaultSections ? [] : choices.map((choice) => choice.key))
        ).join(",");

    if (!global.document?.body) {
      const sectionsText = promptWithDefault(
        [
          "対象設定を入力してください。",
          "日本語名、英語キー、カンマ、読点、改行区切りが使えます。",
          `差分ありの推奨設定: ${formatSectionNames(choices.filter((choice) => choice.recommended).map((choice) => choice.key)) || "なし"}`,
          `replaceで削除候補: ${formatSectionNames(choices.filter((choice) => choice.deleteRisk).map((choice) => choice.key)) || "なし"}`,
          "例: 表示,項目設定,エディタ または all"
        ].join("\n"),
        defaultText
      );
      return parseSections(sectionsText);
    }

    return showSectionPickerDialog(choices, initialSections, options);
  }

  function decorateSectionChoices(choices, preflight) {
    if (!preflight) return choices;
    const bySection = new Map(preflight.rows.map((row) => [row.section, row]));
    return choices.map((choice) => {
      const row = bySection.get(choice.key);
      return row
        ? {
            ...choice,
            diffStatus: row.status,
            diffReason: row.reason,
            recommended: row.recommended,
            deleteRisk: row.deleteRisk
          }
        : {
            ...choice,
            recommended: false,
            deleteRisk: false
          };
    });
  }

  function showSectionPickerDialog(choices, initialSections, options = {}) {
    return new Promise((resolve, reject) => {
      const initialSet = initialSections.includes("all")
        ? new Set(choices.map((choice) => choice.key))
        : new Set(initialSections);
      const overlay = document.createElement("div");
      overlay.className = "psa-section-picker";
      overlay.innerHTML = sectionPickerHtml(choices, initialSet, initialSections.includes("all"), options.preflight);

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
          checkbox.checked = predicate(checkbox.dataset.sectionKey, checkbox);
        });
        updateSummary();
      };
      const updateSummary = () => {
        const selected = checkboxItems().filter((checkbox) => checkbox.checked);
        const unsafeCount = selected.filter((checkbox) => checkbox.dataset.unsafe === "true").length;
        const unsupportedCount = selected.filter((checkbox) => checkbox.dataset.unsupported === "true").length;
        const deleteRiskCount = selected.filter((checkbox) => checkbox.dataset.deleteRisk === "true").length;
        const allText = allMode()?.checked ? " / 完全同期(all)" : "";
        summary().textContent = `${selected.length}件を選択中${deleteRiskCount ? ` / 削除候補 ${deleteRiskCount}件` : ""}${unsafeCount ? ` / 注意 ${unsafeCount}件` : ""}${unsupportedCount ? ` / 未対応 ${unsupportedCount}件` : ""}${allText}`;
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
          setChecked((key) => !unsafeSectionKeys.has(key) && !packageSectionDefinitionByKey.has(key));
          if (allMode()) allMode().checked = false;
        }
        if (action === "changed") {
          setChecked((key, checkbox) => checkbox.dataset.recommended === "true");
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

  function sectionPickerHtml(choices, initialSet, allMode, preflight) {
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

    const preflightText = preflight
      ? [
          `差分あり ${preflight.recommendedSections.length}件`,
          `replace削除候補 ${preflight.deleteRiskSections.length}件`
        ].join(" / ")
      : "適用対象を選択してください。";

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
        .psa-section-badges {
          display: flex;
          flex-wrap: wrap;
          gap: 4px;
          justify-content: flex-end;
        }
        .psa-section-badge.neutral {
          background: #f8fafc;
          color: #64748b;
          border-color: #e2e8f0;
        }
        .psa-section-badge.changed {
          background: #eff6ff;
          color: #1d4ed8;
          border-color: #bfdbfe;
        }
        .psa-section-badge.danger {
          background: #fef2f2;
          color: #b91c1c;
          border-color: #fecaca;
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
          <p>適用先の現在設定と比較し、差分がある設定を初期選択しています。${escapeHtml(preflightText)}。</p>
        </header>
        <div class="psa-section-toolbar">
          <input class="psa-section-search" data-search type="search" placeholder="設定名、英語キー、説明で絞り込み">
          <div class="psa-section-actions">
            <button class="psa-section-button" type="button" data-action="changed">差分ありだけ</button>
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
              <span>all として適用する。replace の場合、JSONに存在しない設定も削除対象になります。削除候補は必ずdry-runで確認してください。</span>
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
      choice.unsafe ? "注意 unsafe" : "",
      choice.unsupported ? "未対応 unsupported" : "",
      choice.inSource === false ? "未設定 not-in-source" : "",
      choice.diffStatus || "",
      choice.diffReason || "",
      choice.deleteRisk ? "削除候補 delete-risk" : ""
    ].join(" ").toLowerCase();
    return `
      <label class="psa-section-row" data-section-row data-search-text="${escapeHtml(searchText)}">
        <input
          type="checkbox"
          data-section-key="${escapeHtml(choice.key)}"
          data-unsafe="${choice.unsafe ? "true" : "false"}"
          data-unsupported="${choice.unsupported ? "true" : "false"}"
          data-recommended="${choice.recommended ? "true" : "false"}"
          data-delete-risk="${choice.deleteRisk ? "true" : "false"}"
          ${checked ? "checked" : ""}
        >
        <span>
          <span class="psa-section-name">${escapeHtml(choice.label)}</span>
          <span class="psa-section-key">${escapeHtml(choice.key)}</span>
        </span>
        <span class="psa-section-description">${escapeHtml(choice.description)}</span>
        <span class="psa-section-badges">
          ${choice.diffStatus ? `<span class="psa-section-badge ${choice.deleteRisk ? "danger" : "changed"}">${escapeHtml(choice.diffStatus)}</span>` : ""}
          ${choice.unsupported ? '<span class="psa-section-badge">未対応</span>' : ""}
          ${choice.unsafe ? '<span class="psa-section-badge">注意</span>' : ""}
          ${choice.inSource === false ? '<span class="psa-section-badge neutral">未設定</span>' : ""}
        </span>
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
    console.table(formatOperationRows(plan.operations));
  }

  function logPreflightComparison(label, fileName, preflight, mode) {
    console.log(label, {
      fileName,
      mode,
      changedSections: preflight.recommendedSections,
      deleteRiskSections: preflight.deleteRiskSections,
      summary: preflight.compare.summary
    });
    if (preflight.rows.length > 0) {
      console.table(formatPreflightRows(preflight.rows));
    } else {
      console.log("Preflight comparison: 差分はありません。");
    }
  }

  function formatPreflightRows(rows) {
    return rows.map((row) => ({
      "状態": row.status,
      "設定": formatSectionForLog(row.section),
      "適用元": row.source,
      "適用先": row.target,
      "推奨": row.recommended ? "選択" : "未選択",
      "理由": row.reason
    }));
  }

  function formatOperationRows(operations) {
    return operations.map((operation) => ({
      "処理": operationTypeLabel(operation.type),
      "設定": formatSectionForLog(operation.section),
      "キー": operation.key,
      "理由": reasonLabel(operation.reason, operation)
    }));
  }

  function operationTypeLabel(type) {
    return {
      create: "作成",
      update: "更新",
      delete: "削除",
      skip: "スキップ"
    }[type] || type || "";
  }

  function formatSectionForLog(section) {
    const label = sectionLabel(section);
    return label === section ? label : `${label} (${section})`;
  }

  function reasonLabel(reason, operation = {}) {
    if (!reason) return "";
    const section = operation.section;
    const sectionText = formatSectionForLog(section);

    if (reason.includes("is unsafe and was preserved")) {
      return `${sectionText} は安全確認が必要なため保持しました。削除するには allowUnsafeSections:true を指定してください。`;
    }
    if (reason.includes("is unsafe and was not changed")) {
      return `${sectionText} は安全確認が必要なため変更しませんでした。適用するには allowUnsafeSections:true を指定してください。`;
    }
    if (reason.includes("is not in source settings")) {
      return `${sectionText} は適用元の SiteSettings に存在しません。`;
    }
    if (reason.includes("is not in source site")) {
      return `${sectionText} は適用元のサイト情報に存在しません。`;
    }
    if (reason.includes("is a top-level site-package section and is not applied by updatesite")) {
      return `${sectionText} はサイトパッケージ最上位の情報のため、updatesite では適用しません。`;
    }
    if (reason.includes("is not an array")) {
      return `${sectionText} は配列形式ではないため適用しません。`;
    }
    if (reason.includes("is not an object")) {
      return `${sectionText} はオブジェクト形式ではないため適用しません。`;
    }
    if (reason === "column reference does not exist in the target table") {
      return "適用先テーブルに存在しない項目を参照しているため除外しました。";
    }
    if (reason === "column does not exist in the target table") {
      return "適用先テーブルに存在しない項目のため除外しました。";
    }
    if (reason.startsWith("default value is not in ChoicesText:")) {
      return `既定値が選択肢に存在しないため除外しました: ${reason.split(":").slice(1).join(":").trim()}`;
    }
    if (reason === "value is not available in the target UI options") {
      return "適用先の画面で選択できない値のため除外しました。";
    }
    if (reason === "RTEditor requires a valid FieldCss; normalized to field-rte") {
      return "リッチテキストエディタには有効な表示形式が必要なため、field-rte に補正しました。";
    }
    return reason;
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
    buildPreflightComparison,
    planSiteSettings,
    applySiteSettings,
    pickPackageFile,
    pickPackageAndPlan,
    pickPackageAndApply,
    runWizard,
    parseSections,
    sectionLabel,
    formatPreflightRows,
    formatOperationRows,
    selectableSections
  };

  global.PleasanterSitePackageApplier = api;
  global.PleasanterViewPackageApplier = api;
})(window);
