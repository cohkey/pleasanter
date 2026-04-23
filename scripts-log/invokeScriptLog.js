/*
 * 業務テーブル側
 * UserDataにログ依頼を積み、ログテーブルのサイト設定読み込み時SSを起動する。
 */

const SCRIPT_LOG_CONFIG = {
    logSiteId: 1234,               // ← スクリプトログテーブルのサイトID
    triggerKey: 'run-script-log'
};

/**
 * スクリプトログ処理を起動する。
 *
 * @param {Object} context サーバスクリプトのcontext
 * @param {Object} options ログ引数
 * @param {string} options.action 処理分類
 * @param {string} options.processKey 処理識別キー
 * @param {string} options.message 概要メッセージ
 * @param {string} [options.detail] 詳細
 * @param {string} [options.level] info / warn / error / debug
 * @param {number|string} [options.sourceRecordId] 実行元レコードID
 * @param {string} [options.sourceSiteTitle] 実行元サイト名
 * @param {number|string} [options.userId] 実行ユーザーID
 * @param {string} [options.controlId] 操作元コントロールID
 * @param {Object|string} [options.data] 補足データ
 */
function invokeScriptLogBySiteLoad(context, options) {
    context.UserData.ScriptLogRequest = {
        triggerKey: SCRIPT_LOG_CONFIG.triggerKey,
        level: options.level || 'info',
        action: options.action || '',
        processKey: options.processKey || '',
        controlId: options.controlId || context.ControlId || '',
        message: options.message || '',
        detail: options.detail || '',
        sourceSiteId: context.SiteId || '',
        sourceSiteTitle: options.sourceSiteTitle || context.SiteTitle || '',
        sourceRecordId: options.sourceRecordId || context.Id || '',
        userId: options.userId || context.UserId || '',
        data: formatLogData(options.data)
    };

    items.GetSite(SCRIPT_LOG_CONFIG.logSiteId);

    /*
     * 残留防止
     */
    context.UserData.ScriptLogRequest = null;
}

/**
 * 補足データを文字列化する。
 *
 * @param {Object|string} data 補足データ
 * @returns {string} 文字列化後データ
 */
function formatLogData(data) {
    if (data == null) {
        return '';
    }

    if (typeof data === 'string') {
        return data;
    }

    try {
        return JSON.stringify(data);
    } catch (e) {
        return '[data stringify failed]';
    }
}