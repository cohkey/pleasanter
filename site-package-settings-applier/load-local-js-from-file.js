/*
 * Load and execute a local JavaScript file from a browser file picker.
 *
 * Usage:
 * 1. Open Pleasanter and sign in.
 * 2. Open DevTools Console.
 * 3. Paste this small loader.
 * 4. Use the launcher panel that appears.
 *
 * Select a local .js file, for example:
 *      site-package-settings-applier/apply-site-package-settings.js
 *
 * Console commands are still available:
 *      await PleasanterLocalJsLoader.pickAndRun();
 *      await PleasanterLocalJsLoader.showLauncher();
 *      await PleasanterLocalJsLoader.pickScriptAndPackageThenRunWizard();
 */
(function attachPleasanterLocalJsLoader(global) {
  const launcherId = "pleasanter-local-js-loader-launcher";

  async function pickAndRun(options = {}) {
    const file = await pickFile(options.accept || ".js,text/javascript,application/javascript");
    const source = await file.text();

    if (options.dryRun) {
      return {
        dryRun: true,
        fileName: file.name,
        size: file.size,
        preview: source.slice(0, options.previewLength || 1000)
      };
    }

    const result = executeSource(source, file.name);
    let autoRunResult = null;

    if (options.autoRunWizard) {
      const api = wizardApi();
      if (!api) throw new Error("Loaded script does not expose PleasanterSitePackageApplier.runWizard().");
      autoRunResult = await api.runWizard(options.wizardDefaults || {});
    }

    return {
      dryRun: false,
      fileName: file.name,
      size: file.size,
      result,
      autoRunResult
    };
  }

  async function pickScriptAndPackageThenRunWizard(options = {}) {
    const files = await pickFiles(".js,.json,text/javascript,application/javascript,application/json", true);
    const scriptFile = files.find((file) => /\.js$/i.test(file.name));
    const packageFile = files.find((file) => /\.json$/i.test(file.name));

    if (!scriptFile) throw new Error("Select the JavaScript file, for example apply-site-package-settings.js.");
    if (!packageFile) throw new Error("Select the site package JSON file.");

    const source = await scriptFile.text();
    executeSource(source, scriptFile.name);

    const api = wizardApi();
    if (!api) throw new Error("Loaded script does not expose PleasanterSitePackageApplier.runWizard().");

    const sitePackage = JSON.parse((await packageFile.text()).replace(/^\uFEFF/, ""));
    const result = await api.runWizard({
      ...(options.wizardDefaults || {}),
      sitePackage,
      packageFileName: packageFile.name,
      packageSize: packageFile.size
    });

    return {
      scriptFileName: scriptFile.name,
      packageFileName: packageFile.name,
      result
    };
  }

  function showLauncher(options = {}) {
    closeLauncher();

    const root = document.createElement("div");
    root.id = launcherId;
    root.style.cssText = [
      "position:fixed",
      "inset:0",
      "z-index:2147483647",
      "display:flex",
      "align-items:center",
      "justify-content:center",
      "background:rgba(20,23,28,.32)",
      "font-family:-apple-system,BlinkMacSystemFont,'Hiragino Sans','Yu Gothic',Meiryo,sans-serif"
    ].join(";");

    const panel = document.createElement("div");
    panel.style.cssText = [
      "width:min(560px,calc(100vw - 32px))",
      "background:#fff",
      "color:#1d1d1f",
      "border:1px solid #d8dbe2",
      "border-radius:12px",
      "box-shadow:0 18px 60px rgba(0,0,0,.22)",
      "overflow:hidden"
    ].join(";");

    const header = document.createElement("div");
    header.style.cssText = "padding:18px 20px;border-bottom:1px solid #e5e7eb;background:#f8f9fb";

    const title = document.createElement("div");
    title.textContent = "Pleasanter 設定適用ランチャー";
    title.style.cssText = "font-size:18px;font-weight:700;margin-bottom:4px";

    const subtitle = document.createElement("div");
    subtitle.textContent = "Console操作はここまでです。以降はボタンからファイルを選んで進めます。";
    subtitle.style.cssText = "font-size:13px;color:#6e6e73";

    header.append(title, subtitle);

    const body = document.createElement("div");
    body.style.cssText = "padding:18px 20px;display:grid;gap:14px";

    const steps = document.createElement("div");
    steps.style.cssText = "display:grid;gap:10px";

    const scriptButton = makeButton("1. メインJSを選択", "primary");
    const scriptInfo = makeInfo("未選択", "apply-site-package-settings.js を選んでください。");

    const wizardButton = makeButton("2. JSONを選択して開始", "primary");
    wizardButton.disabled = !wizardApi();
    syncButtonState(wizardButton);
    const wizardInfo = makeInfo(
      wizardButton.disabled ? "待機中" : "開始できます",
      wizardButton.disabled ? "先にメインJSを読み込んでください。" : "サイトパッケージJSONを選ぶとウィザードが始まります。"
    );
    const compareButton = makeButton("CS/SS差分比較", "secondary");
    compareButton.disabled = !compareApi();
    syncButtonState(compareButton);
    const compareInfo = makeInfo(
      compareButton.disabled ? "待機中" : "比較できます",
      compareButton.disabled ? "先にメインJSを読み込んでください。" : "比較元JSONと比較先JSONを選んで、CS/SSの差分を確認できます。"
    );

    const status = document.createElement("div");
    status.style.cssText = [
      "min-height:42px",
      "padding:10px 12px",
      "border:1px solid #d8dbe2",
      "border-radius:8px",
      "background:#f8f9fb",
      "font-size:13px",
      "white-space:pre-wrap"
    ].join(";");
    status.textContent = "準備できました。まずメインJSを選択してください。";

    const footer = document.createElement("div");
    footer.style.cssText = "display:flex;justify-content:space-between;gap:10px;align-items:center";

    const note = document.createElement("div");
    note.textContent = "Chromeの仕様で、ファイル選択はボタンクリックごとに開きます。";
    note.style.cssText = "font-size:12px;color:#6e6e73";

    const closeButton = makeButton("閉じる", "secondary");

    scriptButton.addEventListener("click", async () => {
      try {
        setStatus(status, "メインJSを選択してください。", "normal");
        const result = await pickAndRun(options.script || {});
        scriptInfo.title.textContent = result.fileName;
        scriptInfo.detail.textContent = `${result.size.toLocaleString()} bytes を読み込みました。`;
        wizardButton.disabled = !wizardApi();
        syncButtonState(wizardButton);
        compareButton.disabled = !compareApi();
        syncButtonState(compareButton);
        wizardInfo.title.textContent = wizardButton.disabled ? "読み込み失敗" : "開始できます";
        wizardInfo.detail.textContent = wizardButton.disabled
          ? "選択したJSに runWizard() がありません。apply-site-package-settings.js を選び直してください。"
          : "次にサイトパッケージJSONを選んでください。";
        compareInfo.title.textContent = compareButton.disabled ? "比較不可" : "比較できます";
        compareInfo.detail.textContent = compareButton.disabled
          ? "選択したJSに runScriptCompareWizard() がありません。最新版の apply-site-package-settings.js を選び直してください。"
          : "CS/SSだけを比較したい場合に使えます。";
        setStatus(status, `読み込み完了: ${result.fileName}`, "ok");
      } catch (error) {
        setStatus(status, errorMessage(error), "error");
      }
    });

    wizardButton.addEventListener("click", async () => {
      try {
        const api = wizardApi();
        if (!api) throw new Error("先に apply-site-package-settings.js を読み込んでください。");
        setStatus(status, "サイトパッケージJSONを選択してください。", "normal");
        const result = await api.runWizard(options.wizardDefaults || {});
        setStatus(
          status,
          result?.applied
            ? "適用が完了しました。Consoleの Applied / Verified / Post-apply compare も確認してください。"
            : "dry-run まで実行しました。適用はキャンセルされています。",
          result?.applied ? "ok" : "normal"
        );
        root.dispatchEvent(new CustomEvent("pleasanter-local-loader-result", { detail: result }));
      } catch (error) {
        setStatus(status, errorMessage(error), "error");
      }
    });

    compareButton.addEventListener("click", async () => {
      try {
        const api = compareApi();
        if (!api) throw new Error("先に最新版の apply-site-package-settings.js を読み込んでください。");
        setStatus(status, "比較元JSONと比較先JSONを選択してください。", "normal");
        const result = await api.runScriptCompareWizard(options.compareDefaults || {});
        setStatus(
          status,
          result.equal
            ? "CS/SSの差分はありません。"
            : `CS/SSの差分を検出しました。Consoleの表を確認してください。差分: ${result.differences.length}件`,
          result.equal ? "ok" : "normal"
        );
        root.dispatchEvent(new CustomEvent("pleasanter-local-loader-script-compare-result", { detail: result }));
      } catch (error) {
        setStatus(status, errorMessage(error), "error");
      }
    });

    closeButton.addEventListener("click", closeLauncher);

    steps.append(
      makeStep(scriptButton, scriptInfo),
      makeStep(wizardButton, wizardInfo),
      makeStep(compareButton, compareInfo)
    );
    footer.append(note, closeButton);
    body.append(steps, status, footer);
    panel.append(header, body);
    root.append(panel);
    document.body.append(root);

    return root;
  }

  function closeLauncher() {
    document.getElementById(launcherId)?.remove();
  }

  function wizardApi() {
    return global.PleasanterSitePackageApplier?.runWizard
      ? global.PleasanterSitePackageApplier
      : global.PleasanterViewPackageApplier?.runWizard
        ? global.PleasanterViewPackageApplier
        : null;
  }

  function compareApi() {
    const api = global.PleasanterSitePackageApplier || global.PleasanterViewPackageApplier;
    return api?.runScriptCompareWizard ? api : null;
  }

  function makeStep(button, info) {
    const row = document.createElement("div");
    row.style.cssText = [
      "display:grid",
      "grid-template-columns:190px 1fr",
      "gap:12px",
      "align-items:stretch"
    ].join(";");
    row.append(button, info.root);
    return row;
  }

  function makeButton(label, type) {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = label;
    const base = [
      "border-radius:8px",
      "border:1px solid transparent",
      "font:inherit",
      "font-weight:700",
      "padding:11px 14px",
      "cursor:pointer"
    ];
    const color = type === "primary"
      ? ["background:#0a66c2", "border-color:#0a66c2", "color:#fff"]
      : ["background:#fff", "border-color:#d8dbe2", "color:#1d1d1f"];
    button.style.cssText = [...base, ...color].join(";");
    button.addEventListener("mouseenter", () => {
      if (!button.disabled) button.style.filter = "brightness(.97)";
    });
    button.addEventListener("mouseleave", () => {
      button.style.filter = "";
    });
    return button;
  }

  function syncButtonState(button) {
    button.style.opacity = button.disabled ? ".45" : "1";
    button.style.cursor = button.disabled ? "not-allowed" : "pointer";
  }

  function makeInfo(titleText, detailText) {
    const root = document.createElement("div");
    root.style.cssText = [
      "border:1px solid #d8dbe2",
      "border-radius:8px",
      "padding:10px 12px",
      "background:#fbfbfd"
    ].join(";");
    const title = document.createElement("div");
    title.textContent = titleText;
    title.style.cssText = "font-size:13px;font-weight:700";
    const detail = document.createElement("div");
    detail.textContent = detailText;
    detail.style.cssText = "font-size:12px;color:#6e6e73;margin-top:2px";
    root.append(title, detail);
    return { root, title, detail };
  }

  function setStatus(node, message, type) {
    node.textContent = message;
    node.style.borderColor = type === "error" ? "#f2b8b5" : type === "ok" ? "#9ad0a2" : "#d8dbe2";
    node.style.background = type === "error" ? "#fff4f2" : type === "ok" ? "#f1faf2" : "#f8f9fb";
    node.style.color = type === "error" ? "#b42318" : "#1d1d1f";
  }

  function errorMessage(error) {
    return error && error.message ? error.message : String(error);
  }

  function pickFile(accept) {
    return pickFiles(accept, false).then((files) => files[0]);
  }

  function pickFiles(accept, multiple) {
    return new Promise((resolve, reject) => {
      const input = document.createElement("input");
      input.type = "file";
      input.accept = accept;
      input.multiple = Boolean(multiple);
      input.style.position = "fixed";
      input.style.left = "-9999px";
      input.style.top = "-9999px";

      input.addEventListener("change", () => {
        const files = input.files ? Array.from(input.files) : [];
        input.remove();
        if (files.length === 0) {
          reject(new Error("No file was selected."));
          return;
        }
        resolve(files);
      });

      document.body.appendChild(input);
      input.click();
    });
  }

  function executeSource(source, fileName) {
    const script = document.createElement("script");
    script.type = "text/javascript";
    script.text = `${source}\n//# sourceURL=${encodeURIComponent(fileName)}`;
    document.documentElement.appendChild(script);
    script.remove();
    return { loaded: true };
  }

  global.PleasanterLocalJsLoader = {
    pickAndRun,
    pickScriptAndPackageThenRunWizard,
    showLauncher,
    closeLauncher
  };

  setTimeout(showLauncher, 0);
})(window);
