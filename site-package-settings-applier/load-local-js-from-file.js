/*
 * Load and execute a local JavaScript file from a browser file picker.
 *
 * Usage:
 * 1. Open Pleasanter and sign in.
 * 2. Open DevTools Console.
 * 3. Paste this small loader.
 * 4. Run:
 *      await PleasanterLocalJsLoader.pickAndRun();
 *
 * To automatically start the package apply wizard after loading:
 *      await PleasanterLocalJsLoader.pickScriptAndPackageThenRunWizard();
 * 5. Select a local .js file, for example:
 *      site-package-settings-applier/apply-site-package-settings.js
 */
(function attachPleasanterLocalJsLoader(global) {
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
      if (!global.PleasanterViewPackageApplier?.runWizard) {
        throw new Error("Loaded script does not expose PleasanterViewPackageApplier.runWizard().");
      }
      autoRunResult = await global.PleasanterViewPackageApplier.runWizard(options.wizardDefaults || {});
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

    if (!global.PleasanterViewPackageApplier?.runWizard) {
      throw new Error("Loaded script does not expose PleasanterViewPackageApplier.runWizard().");
    }

    const sitePackage = JSON.parse(await packageFile.text());
    const result = await global.PleasanterViewPackageApplier.runWizard({
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
    pickScriptAndPackageThenRunWizard
  };
})(window);
