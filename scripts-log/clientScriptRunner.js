/*
 * common/runner
 * ClientScriptLogger を使って、CS側のイベント処理を共通実行する。
 *
 * 前提:
 * - common/logger に ClientScriptLogger が定義されている
 * - common/logger に getClientSiteId / getClientRecordId / getClientUserId / getClientDeptId が定義されている
 */

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
 * @param {boolean} [options.enableConsoleLog=true] consoleへ出力するか
 * @param {boolean} [options.enableApiSave=true] ログテーブルへ保存するか
 * @returns {Promise<ClientScriptLogger>}
 */
async function runClientEvent(eventName, steps, options) {
    options = options || {};

    const logger = createClientEventLogger(eventName, options);

    try {
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

    } catch (e) {
        logger.error(e.stack);
        logger.closeAllGroups();

        /*
         * CS側は画面を壊さないことを優先して、ここではthrowしない。
         */
        console.error(e);

    } finally {
        await logger.save();
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
            return false;
        }

        logger.info('Validation Passed');
        logger.info('End: ' + eventName);
        return true;

    } catch (e) {
        logger.error(e.stack);
        logger.closeAllGroups();

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
        processName: eventName,
        sourceRecordId: options.sourceRecordId || getClientRecordId(),
        userId: options.userId || getClientUserId(),
        deptId: options.deptId || getClientDeptId(),
        enableConsoleLog: options.enableConsoleLog,
        enableApiSave: options.enableApiSave
    });
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