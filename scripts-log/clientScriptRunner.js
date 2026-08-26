/*
 * common/runner
 * ClientScriptLogger を使って、CS側のイベント処理を共通実行する。
 *
 * 前提:
 * - common/logger に ClientScriptLogger が定義されている
 * - common/logger に getClientSiteId / getClientRecordId / getClientUserId / getClientDeptId が定義されている
 *
 * 変更履歴:
 * - 2026-08-24: operationName / includeServerLog を追加し、SS画面表示系ログをCS側の1操作ログへ集約できるようにした。
 * - 2026-08-26: SSログをCSイベント開始前の独立ブロックとして取り込み、CSログの階層に混ざらないようにした。
 * - 2026-08-26: SS統合時のconsole出力順を詳細ログと合わせ、SS/CSイベント境界を明確化した。
 * - 2026-08-26: 更新/削除の送信前CSログをsessionStorageへ保留し、次の画面表示ログへ束ねられるようにした。
 * - 2026-08-26: 次画面表示へ保留するCSログは、画面遷移前にsessionStorageへ保存するようにした。
 * - 2026-08-26: CS側で取り込んだSSログをhidden Logから消し、Pleasanter本体のconsole再出力を抑止した。
 * - 2026-08-26: Ajax応答でPleasanter本体がconsole出力するSSログを捕捉し、次の統合ログへ束ねるようにした。
 */

const CLIENT_SCRIPT_LOG_PENDING_KEY = 'PleasanterScriptLog.PendingClientLogs';
const CLIENT_SCRIPT_LOG_PENDING_SERVER_KEY = 'PleasanterScriptLog.PendingServerLogs';
const CLIENT_SCRIPT_LOG_PENDING_TTL_MS = 5 * 60 * 1000;

installPleasanterServerLogConsoleCapture();

/**
 * クライアントイベント処理を実行する。
 * 戻り値が不要な通常イベント用。
 *
 * 例:
 * - 画面表示後
 * - after_set
 * - click
 * - change
 *
 * @param {string} eventName イベント名
 * @param {Array<Object>} steps 実行ステップ一覧
 * @param {Object} [options] ログオプション
 * @param {string|number} [options.sourceApp] 実行元アプリID
 * @param {string|number} [options.sourceSiteId] 実行元サイトID
 * @param {number|string} [options.sourceRecordId] 実行元レコードID
 * @param {string|number} [options.userId] ユーザーID
 * @param {string|number} [options.deptId] 部署ID
 * @param {string} [options.operationName] ログレコード上の処理名。複数イベントを1操作に束ねる場合に指定する
 * @param {boolean} [options.includeServerLog=false] Pleasanterが画面へ渡したSSログを詳細ログに取り込むか
 * @param {boolean} [options.includePendingClientLog=false] 直前操作で保留したCSログを詳細ログに取り込むか
 * @param {boolean} [options.deferToNextLoad=false] trueの場合はログレコードを作成せず、次の画面表示ログへ束ねる
 * @param {string} [options.nextOperationName] deferToNextLoad時に次のログレコードへ引き継ぐ処理名
 * @param {string} [options.pendingClientLogLabel] 保留CSログ取り込みブロックのラベル
 * @param {string} [options.serverLogLabel] SSログ取り込みブロックのラベル
 * @param {boolean} [options.enableConsoleLog=true] consoleへ出力するか
 * @param {boolean} [options.enableApiSave=true] ログテーブルへ保存するか
 * @returns {Promise<ClientScriptLogger>}
 */
async function runClientEvent(eventName, steps, options) {
    options = options || {};

    const logger = createClientEventLogger(eventName, options);

    try {
        appendPendingClientLogToClientLogger(logger, options);
        appendServerLogToClientLogger(logger, options);

        logger.sectionStart('CSイベント: ' + eventName);
        logger.info('Start: ' + eventName);
        logger.info('Source ' + JSON.stringify({
            siteId: logger.sourceSiteId || '',
            recordId: logger.sourceRecordId || '',
            userId: logger.userId || '',
            deptId: logger.deptId || '',
            url: location.href
        }));

        for (let i = 0; i < steps.length; i++) {
            await runClientStep(logger, steps[i]);
        }

        logger.info('End: ' + eventName);
        logger.sectionEnd('CSイベント: ' + eventName);

    } catch (e) {
        logger.error(e.stack);
        logger.closeAllGroups();
        logger.section('abnormalEnd', 'CSイベント: ' + eventName);

        /*
         * CS側は画面を壊さないことを優先して、ここではthrowしない。
         */
        console.error(e);

    } finally {
        const shouldDeferToNextLoad =
            options.deferToNextLoad === true &&
            logger.level !== 'error';

        if (shouldDeferToNextLoad) {
            logger.enableApiSave = false;
        }

        const savePromise = logger.save({
            flushConsoleLog: !shouldDeferToNextLoad
        });

        if (shouldDeferToNextLoad) {
            savePendingClientLog(logger, options);
        }

        await savePromise;
    }

    return logger;
}

/**
 * 通常イベントの1ステップを実行する。
 *
 * @param {ClientScriptLogger} logger ロガー
 * @param {Object} step ステップ情報
 * @param {string} step.name 関数名
 * @param {string} step.label 日本語説明
 * @param {Function} step.action 実行関数
 * @returns {Promise<void>}
 */
async function runClientStep(logger, step) {
    const stepLabel = step.name + ' - ' + step.label;

    logger.group(stepLabel);

    try {
        const result = step.action(logger);

        /*
         * Promiseが返ってきた場合だけ待つ。
         */
        if (result && typeof result.then === 'function') {
            await result;
        }

    } finally {
        logger.groupEnd();
    }
}

/**
 * true / false を返すCS検証イベントを実行する。
 *
 * after_validate_Update のように、
 * return false で更新をキャンセルするイベント用。
 *
 * @param {string} eventName イベント名
 * @param {Array<Object>} steps 実行ステップ一覧
 * @param {Object} [options] ログオプション
 * @param {Object} [args] Pleasanterイベント引数
 * @returns {boolean} true: 続行 / false: キャンセル
 */
function runClientValidationEvent(eventName, steps, options, args) {
    options = options || {};

    const logger = createClientEventLogger(eventName, options);
    let validationMessage = '';

    try {
        logger.sectionStart('CS検証イベント: ' + eventName);
        logger.info('Start: ' + eventName);
        logger.info('Source ' + JSON.stringify({
            siteId: logger.sourceSiteId || '',
            recordId: logger.sourceRecordId || '',
            userId: logger.userId || '',
            deptId: logger.deptId || '',
            url: location.href
        }));

        for (let i = 0; i < steps.length; i++) {
            const result = runClientValidationStep(logger, steps[i], args);

            if (typeof result === 'string' && result) {
                validationMessage += result;
            }
        }

        if (validationMessage) {
            logger.warn('Validation Failed');
            logger.info('Validation Message ' + JSON.stringify({
                text: validationMessage
            }));

            showClientValidationErrorMessage(validationMessage);

            logger.info('End: ' + eventName);
            logger.sectionEnd('CS検証イベント: ' + eventName, 'Validation Failed');
            return false;
        }

        logger.info('Validation Passed');
        logger.info('End: ' + eventName);
        logger.sectionEnd('CS検証イベント: ' + eventName, 'Validation Passed');
        return true;

    } catch (e) {
        logger.error(e.stack);
        logger.closeAllGroups();
        logger.section('abnormalEnd', 'CS検証イベント: ' + eventName);

        showClientValidationErrorMessage(
            '更新前チェック中にエラーが発生しました。管理者に連絡してください。'
        );

        return false;

    } finally {
        /*
         * validation系イベントでは戻り値が重要なので await しない。
         * CSログ保存は非同期で投げる。
         */
        logger.save();
    }
}

/**
 * 検証イベントの1ステップを実行する。
 *
 * @param {ClientScriptLogger} logger ロガー
 * @param {Object} step ステップ情報
 * @param {string} step.name 関数名
 * @param {string} step.label 日本語説明
 * @param {Function} step.action 実行関数
 * @param {Object} [args] Pleasanterイベント引数
 * @returns {string} 検証メッセージ
 */
function runClientValidationStep(logger, step, args) {
    const stepLabel = step.name + ' - ' + step.label;

    logger.group(stepLabel);

    try {
        return step.action(logger, args) || '';

    } finally {
        logger.groupEnd();
    }
}

/**
 * ClientScriptLogger を生成する。
 *
 * @param {string} eventName イベント名
 * @param {Object} options ログオプション
 * @returns {ClientScriptLogger} ロガー
 */
function createClientEventLogger(eventName, options) {
    options = options || {};

    return new ClientScriptLogger({
        sourceApp: options.sourceApp || getClientSiteId(),
        sourceSiteId: options.sourceSiteId || getClientSiteId(),
        processName: resolveClientEventProcessName(eventName, options),
        sourceRecordId: options.sourceRecordId || getClientRecordId(),
        userId: options.userId || getClientUserId(),
        deptId: options.deptId || getClientDeptId(),
        enableConsoleLog: options.enableConsoleLog,
        enableApiSave: options.enableApiSave,
        deferConsoleLog: options.deferConsoleLog === true ||
            options.includeServerLog === true ||
            options.deferToNextLoad === true
    });
}

/**
 * CSイベントの処理名を決定する。
 * 保留中のCSログを取り込む場合は、前操作から引き継いだ処理名を優先する。
 *
 * @param {string} eventName イベント名
 * @param {Object} options ログオプション
 * @returns {string} 処理名
 */
function resolveClientEventProcessName(eventName, options) {
    const pendingOperationName =
        options.includePendingClientLog === true
            ? getPendingClientLogOperationName({
                sourceSiteId: options.sourceSiteId || getClientSiteId(),
                sourceRecordId: options.sourceRecordId || getClientRecordId()
            })
            : '';

    return pendingOperationName || options.operationName || eventName;
}

/**
 * 直前操作で保留したCSログをCSログに取り込む。
 *
 * @param {ClientScriptLogger} logger ロガー
 * @param {Object} options ログオプション
 */
function appendPendingClientLogToClientLogger(logger, options) {
    options = options || {};

    if (options.includePendingClientLog !== true) {
        return;
    }

    const pendingLogs = takePendingClientLogs(logger);

    if (pendingLogs.length === 0) {
        return;
    }

    const pendingLogLabel = detectPendingClientLogLabel(pendingLogs, options);

    logger.details.push('===== 開始: ' + pendingLogLabel + ' =====');

    for (let i = 0; i < pendingLogs.length; i++) {
        logger.details.push(pendingLogs[i].detail || '');
    }

    logger.details.push('===== 終了: ' + pendingLogLabel + ' =====');
}

/**
 * 保留CSログ取り込みブロックのラベルを決定する。
 *
 * @param {Array<Object>} pendingLogs 保留中CSログ
 * @param {Object} options ログオプション
 * @returns {string} ブロックラベル
 */
function detectPendingClientLogLabel(pendingLogs, options) {
    if (options.pendingClientLogLabel) {
        return options.pendingClientLogLabel;
    }

    for (let i = 0; i < pendingLogs.length; i++) {
        if (pendingLogs[i].label) {
            return pendingLogs[i].label;
        }
    }

    return 'CS送信前イベント';
}

/**
 * Pleasanterが画面へ渡したSSログをCSログに取り込む。
 * SS側で runEvent(..., { deferToClient: true }) を使った画面表示系ログを、
 * CS側の on_editor_load などで1操作ログに束ねるための処理。
 * SSログはすでに時刻・階層を持つため、CS loggerのinfo/groupでは包まずに
 * rawブロックとして先頭へ追加する。
 *
 * @param {ClientScriptLogger} logger ロガー
 * @param {Object} options ログオプション
 */
function appendServerLogToClientLogger(logger, options) {
    options = options || {};

    if (options.includeServerLog !== true) {
        return;
    }

    const serverLogs = takePendingServerLogs(logger);
    const serverLog = normalizeServerLogText(getPleasanterServerLogText());
    clearPleasanterServerLogText();

    if (serverLog) {
        serverLogs.push(serverLog);
    }

    if (serverLogs.length === 0) {
        return;
    }

    const serverLogDetail = serverLogs.join('\n');
    const serverLogLabel = options.serverLogLabel || detectServerLogLabel(serverLogDetail);

    logger.details.push('===== 開始: ' + serverLogLabel + ' =====');
    logger.details.push(serverLogDetail);
    logger.details.push('===== 終了: ' + serverLogLabel + ' =====');
}

/**
 * SSログ本文から取り込みブロックのラベルを決定する。
 *
 * @param {string} serverLog SSログ文字列
 * @returns {string} ブロックラベル
 */
function detectServerLogLabel(serverLog) {
    if (/SSイベント: .*(delete|削除)|ss-(before|after)-delete/i.test(serverLog)) {
        return 'SS削除・画面表示系イベント';
    }

    if (/SSイベント: .*(update|更新)|ss-(before|after)-update/i.test(serverLog)) {
        return 'SS更新・画面表示系イベント';
    }

    return 'SS画面表示系イベント';
}

/**
 * SSログの改行をCSログ内で扱いやすい形へ揃える。
 *
 * @param {string} text SSログ文字列
 * @returns {string} 正規化後のSSログ文字列
 */
function normalizeServerLogText(text) {
    return String(text || '')
        .replace(/\r\n/g, '\n')
        .replace(/\r/g, '\n')
        .replace(/\n+$/g, '');
}

/**
 * Pleasanterがhidden項目 Log に出力したSSログを取得する。
 *
 * @returns {string} SSログ文字列
 */
function getPleasanterServerLogText() {
    const log = document.getElementById('Log');

    if (!log || !log.value) {
        return '';
    }

    try {
        const parsed = JSON.parse(log.value);
        return parsed && parsed.Log ? String(parsed.Log) : '';
    } catch (e) {
        return String(log.value || '');
    }
}

/**
 * Pleasanter本体のdocument ready処理によるSSログのconsole再出力を抑止する。
 */
function clearPleasanterServerLogText() {
    const log = document.getElementById('Log');

    if (!log) {
        return;
    }

    log.value = JSON.stringify({ Log: '' });
}

/**
 * Ajax応答経由でPleasanter本体がconsole出力するSSログを捕捉する。
 * 画面表示時のhidden Logでは拾えない更新/削除SSログを、
 * 次のon_editor_loadなどの統合ログへ束ねるための処理。
 */
function installPleasanterServerLogConsoleCapture() {
    if (
        typeof window === 'undefined' ||
        !window.console ||
        window.console.__pleasanterScriptLogCaptureInstalled
    ) {
        return;
    }

    const originalLog = window.console.log.bind(window.console);

    window.console.__pleasanterScriptLogCaptureInstalled = true;
    window.console.__pleasanterScriptLogOriginalLog = originalLog;
    window.console.log = function () {
        if (
            arguments.length === 1 &&
            isPleasanterServerScriptLog(arguments[0])
        ) {
            savePendingServerLog(arguments[0]);
            return;
        }

        return originalLog.apply(window.console, arguments);
    };
}

/**
 * console出力値がスクリプトログ用SSログかを判定する。
 *
 * @param {*} value console.logに渡された値
 * @returns {boolean} true: 捕捉対象
 */
function isPleasanterServerScriptLog(value) {
    const text = normalizeServerLogText(value);
    return /^(=====|-----) 開始: SSイベント:/.test(text);
}

/**
 * Ajax応答由来のSSログを保留する。
 *
 * @param {string} serverLog SSログ文字列
 */
function savePendingServerLog(serverLog) {
    if (!window.sessionStorage) {
        return;
    }

    const sourceSiteId = getClientSiteId();
    const sourceRecordId = getClientRecordId();
    const pendingLogs = loadPendingServerLogs();

    pendingLogs.push({
        sourceSiteId: String(sourceSiteId || ''),
        sourceRecordId: String(sourceRecordId || ''),
        createdAt: Date.now(),
        detail: normalizeServerLogText(serverLog)
    });

    storePendingServerLogs(pendingLogs);
}

/**
 * 現在のログ対象に一致する保留中SSログを取り出す。
 *
 * @param {ClientScriptLogger} logger ロガー
 * @returns {Array<string>} 保留中SSログ本文
 */
function takePendingServerLogs(logger) {
    const pendingLogs = loadPendingServerLogs();
    const matchedLogs = [];
    const remainingLogs = [];

    for (let i = 0; i < pendingLogs.length; i++) {
        if (isSamePendingClientLogTarget(pendingLogs[i], logger)) {
            matchedLogs.push(pendingLogs[i].detail || '');
        } else {
            remainingLogs.push(pendingLogs[i]);
        }
    }

    storePendingServerLogs(remainingLogs);

    return matchedLogs.filter(function (detail) {
        return detail;
    });
}

/**
 * 保留中SSログを読み込む。
 *
 * @returns {Array<Object>} 保留中SSログ
 */
function loadPendingServerLogs() {
    if (!window.sessionStorage) {
        return [];
    }

    try {
        const raw = sessionStorage.getItem(CLIENT_SCRIPT_LOG_PENDING_SERVER_KEY);
        const parsed = raw ? JSON.parse(raw) : [];

        if (!Array.isArray(parsed)) {
            return [];
        }

        const nowMs = Date.now();

        return parsed.filter(function (pendingLog) {
            return !pendingLog.createdAt ||
                nowMs - pendingLog.createdAt <= CLIENT_SCRIPT_LOG_PENDING_TTL_MS;
        });
    } catch (e) {
        return [];
    }
}

/**
 * 保留中SSログを保存する。
 *
 * @param {Array<Object>} pendingLogs 保留中SSログ
 */
function storePendingServerLogs(pendingLogs) {
    if (!window.sessionStorage) {
        return;
    }

    if (pendingLogs.length === 0) {
        sessionStorage.removeItem(CLIENT_SCRIPT_LOG_PENDING_SERVER_KEY);
        return;
    }

    sessionStorage.setItem(
        CLIENT_SCRIPT_LOG_PENDING_SERVER_KEY,
        JSON.stringify(pendingLogs.slice(-10))
    );
}

/**
 * 現在のCSログを次の画面表示ログへ束ねるために保留する。
 *
 * @param {ClientScriptLogger} logger ロガー
 * @param {Object} options ログオプション
 */
function savePendingClientLog(logger, options) {
    if (!window.sessionStorage) {
        return;
    }

    const pendingLogs = loadPendingClientLogs().filter(function (pendingLog) {
        return !isSamePendingClientLogTarget(pendingLog, logger);
    });

    pendingLogs.push({
        operationName: resolveNextOperationName(logger, options),
        label: options.pendingClientLogLabel ||
            detectPendingClientLogLabelFromEvent(logger.processName),
        sourceSiteId: String(logger.sourceSiteId || ''),
        sourceRecordId: String(logger.sourceRecordId || ''),
        createdAt: Date.now(),
        detail: logger.getDetailText()
    });

    sessionStorage.setItem(
        CLIENT_SCRIPT_LOG_PENDING_KEY,
        JSON.stringify(pendingLogs.slice(-10))
    );
}

/**
 * 次の画面表示ログへ引き継ぐ処理名を決定する。
 *
 * @param {ClientScriptLogger} logger ロガー
 * @param {Object} options ログオプション
 * @returns {string} 処理名
 */
function resolveNextOperationName(logger, options) {
    return options.nextOperationName ||
        options.operationName ||
        detectOperationNameFromEvent(logger.processName) ||
        logger.processName ||
        '';
}

/**
 * イベント名から操作名を推定する。
 *
 * @param {string} eventName イベント名
 * @returns {string} 操作名
 */
function detectOperationNameFromEvent(eventName) {
    if (/delete|削除/i.test(eventName || '')) {
        return 'delete';
    }

    if (/update|更新/i.test(eventName || '')) {
        return 'update';
    }

    return '';
}

/**
 * イベント名から保留CSログのラベルを推定する。
 *
 * @param {string} eventName イベント名
 * @returns {string} ブロックラベル
 */
function detectPendingClientLogLabelFromEvent(eventName) {
    if (/delete|削除/i.test(eventName || '')) {
        return 'CS削除送信前イベント';
    }

    if (/update|更新/i.test(eventName || '')) {
        return 'CS更新送信前イベント';
    }

    return 'CS送信前イベント';
}

/**
 * 保留中CSログの処理名を返す。
 *
 * @param {Object} target 現在のログ対象
 * @param {string|number} [target.sourceSiteId] 現在のサイトID
 * @param {string|number} [target.sourceRecordId] 現在のレコードID
 * @returns {string} 処理名
 */
function getPendingClientLogOperationName(target) {
    const pendingLogs = loadPendingClientLogs();
    const loggerLike = {
        sourceSiteId: target.sourceSiteId || '',
        sourceApp: target.sourceSiteId || '',
        sourceRecordId: target.sourceRecordId || ''
    };

    for (let i = pendingLogs.length - 1; i >= 0; i--) {
        if (
            pendingLogs[i].operationName &&
            isSamePendingClientLogTarget(pendingLogs[i], loggerLike)
        ) {
            return pendingLogs[i].operationName;
        }
    }

    return '';
}

/**
 * 現在のログ対象に一致する保留中CSログを取り出す。
 *
 * @param {ClientScriptLogger} logger ロガー
 * @returns {Array<Object>} 保留中CSログ
 */
function takePendingClientLogs(logger) {
    const pendingLogs = loadPendingClientLogs();
    const matchedLogs = [];
    const remainingLogs = [];

    for (let i = 0; i < pendingLogs.length; i++) {
        if (isSamePendingClientLogTarget(pendingLogs[i], logger)) {
            matchedLogs.push(pendingLogs[i]);
        } else {
            remainingLogs.push(pendingLogs[i]);
        }
    }

    storePendingClientLogs(remainingLogs);

    return matchedLogs;
}

/**
 * 保留中CSログを読み込む。
 *
 * @returns {Array<Object>} 保留中CSログ
 */
function loadPendingClientLogs() {
    if (!window.sessionStorage) {
        return [];
    }

    try {
        const raw = sessionStorage.getItem(CLIENT_SCRIPT_LOG_PENDING_KEY);
        const parsed = raw ? JSON.parse(raw) : [];

        if (!Array.isArray(parsed)) {
            return [];
        }

        const nowMs = Date.now();

        return parsed.filter(function (pendingLog) {
            return !pendingLog.createdAt ||
                nowMs - pendingLog.createdAt <= CLIENT_SCRIPT_LOG_PENDING_TTL_MS;
        });
    } catch (e) {
        return [];
    }
}

/**
 * 保留中CSログを保存する。
 *
 * @param {Array<Object>} pendingLogs 保留中CSログ
 */
function storePendingClientLogs(pendingLogs) {
    if (!window.sessionStorage) {
        return;
    }

    if (pendingLogs.length === 0) {
        sessionStorage.removeItem(CLIENT_SCRIPT_LOG_PENDING_KEY);
        return;
    }

    sessionStorage.setItem(
        CLIENT_SCRIPT_LOG_PENDING_KEY,
        JSON.stringify(pendingLogs.slice(-10))
    );
}

/**
 * 保留中CSログが現在のログ対象と同じかを判定する。
 *
 * @param {Object} pendingLog 保留中CSログ
 * @param {ClientScriptLogger} logger ロガー
 * @returns {boolean} true: 同じ対象
 */
function isSamePendingClientLogTarget(pendingLog, logger) {
    const pendingSiteId = String(pendingLog.sourceSiteId || '');
    const currentSiteId = String(logger.sourceSiteId || logger.sourceApp || '');
    const pendingRecordId = String(pendingLog.sourceRecordId || '');
    const currentRecordId = String(logger.sourceRecordId || '');

    if (pendingSiteId && currentSiteId && pendingSiteId !== currentSiteId) {
        return false;
    }

    if (pendingRecordId && currentRecordId && pendingRecordId !== currentRecordId) {
        return false;
    }

    return true;
}

/**
 * CS入力検証エラーメッセージを表示する。
 *
 * @param {string} message メッセージ
 */
function showClientValidationErrorMessage(message) {
    $p.setMessage('#Message', JSON.stringify({
        Css: 'alert-error',
        Text: message
    }));

    if ($p.ex && typeof $p.ex.addCloseMessageButtons === 'function') {
        $p.ex.addCloseMessageButtons();
    }
}
