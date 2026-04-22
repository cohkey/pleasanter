/*
 * スクリプトログ起動用設定
 */
const SCRIPT_LOG_CONFIG = {
    logSiteId: 1234, // ← ログテーブルのサイトID
    triggerKey: 'run-script-log'
};

/*
 * ログテーブルへ起動レコードを作成する。
 *
 * @param {Object} context サーバスクリプトのcontext
 * @param {Object} options ログ引数
 * @param {string} options.action 処理名
 * @param {string} options.message 概要メッセージ
 * @param {string} [options.detail] 詳細
 * @param {string} [options.level] info / warn / error / debug
 * @param {string} [options.status] success / error / running
 * @param {number|string} [options.sourceRecordId] 実行元レコードID
 * @param {string} [options.sourceSiteTitle] 実行元サイト名
 * @param {number|string} [options.userId] 実行ユーザーID
 * @param {string} [options.startedAt] 開始日時
 * @param {Object|string} [options.data] 補足データ
 * @returns {boolean} 作成結果
 */
function invokeScriptLog(context, options) {
    const item = items.NewResult();

    item.Title = 'log-trigger';
    item.ClassA = SCRIPT_LOG_CONFIG.triggerKey;
    item.ClassB = options.action || '';
    item.ClassC = options.level || 'info';
    item.ClassD = options.status || 'success';

    item.NumA = toNumberOrNull(context.SiteId);
    item.NumB = toNumberOrNull(options.sourceRecordId);
    item.NumC = toNumberOrNull(options.userId || context.UserId);

    item.DescriptionA = options.message || '';
    item.DescriptionB = options.detail || '';
    item.DescriptionC = formatLogData(options.data);
    item.DescriptionD = options.sourceSiteTitle || context.SiteTitle || '';

    item.DateA = options.startedAt || getCurrentTimestamp();

    return items.Create(SCRIPT_LOG_CONFIG.logSiteId, item);
}

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

function getCurrentTimestamp() {
    const now = new Date();
    const yyyy = now.getFullYear();
    const MM = ('0' + (now.getMonth() + 1)).slice(-2);
    const dd = ('0' + now.getDate()).slice(-2);
    const hh = ('0' + now.getHours()).slice(-2);
    const mm = ('0' + now.getMinutes()).slice(-2);
    const ss = ('0' + now.getSeconds()).slice(-2);

    return yyyy + '/' + MM + '/' + dd + ' ' + hh + ':' + mm + ':' + ss;
}

function toNumberOrNull(value) {
    if (value == null || value === '') {
        return null;
    }

    const num = Number(value);
    return isNaN(num) ? null : num;
}