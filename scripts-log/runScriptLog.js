/*
 * スクリプトログテーブル側
 * サイト設定の読み込み時
 * UserDataのログ依頼を受け取り、ログレコードを作成する。
 */

const SCRIPT_LOG_TRIGGER_KEY = 'run-script-log';

runScriptLogBySiteLoad(context);

/**
 * ログ依頼を受け取り、ログレコードを作成する。
 *
 * @param {Object} context サーバスクリプトのcontext
 */
function runScriptLogBySiteLoad(context) {
    const request = getScriptLogRequest(context);

    if (!request) {
        return;
    }

    if (request.triggerKey !== SCRIPT_LOG_TRIGGER_KEY) {
        return;
    }

    /*
     * 再入対策として先に消す
     */
    context.UserData.ScriptLogRequest = null;

    const item = buildScriptLogItem(request);
    items.Create(context.SiteId, item);
}

/**
 * UserDataからログ依頼を取得する。
 *
 * @param {Object} context サーバスクリプトのcontext
 * @returns {Object|null} ログ依頼
 */
function getScriptLogRequest(context) {
    if (!context.UserData) {
        return null;
    }

    if (!context.UserData.ScriptLogRequest) {
        return null;
    }

    return context.UserData.ScriptLogRequest;
}

/**
 * ログ保存用レコードを組み立てる。
 *
 * @param {Object} request ログ依頼
 * @returns {Object} 保存用レコード
 */
function buildScriptLogItem(request) {
    const item = items.NewResult();

    item.Title = buildLogTitle(request);
    item.ClassA = request.level || 'info';
    item.ClassB = request.action || '';
    item.ClassC = request.processKey || '';
    item.ClassD = request.controlId || '';

    item.NumA = toNumberOrNull(request.sourceSiteId);
    item.NumB = toNumberOrNull(request.sourceRecordId);
    item.NumC = toNumberOrNull(request.userId);

    item.DescriptionA = request.message || '';
    item.DescriptionB = request.detail || '';
    item.DescriptionC = request.data || '';
    item.DescriptionD = request.sourceSiteTitle || '';

    item.DateA = getCurrentTimestamp();

    return item;
}

/**
 * ログタイトルを生成する。
 *
 * @param {Object} request ログ依頼
 * @returns {string} タイトル
 */
function buildLogTitle(request) {
    return (request.action || 'script') +
        ' / ' +
        (request.processKey || '') +
        ' / ' +
        (request.level || 'info') +
        ' / ' +
        (request.sourceRecordId || '');
}

/**
 * 現在日時を返す。
 *
 * @returns {string} 現在日時
 */
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

/**
 * 数値変換できる場合のみ数値を返す。
 *
 * @param {string|number} value 値
 * @returns {number|null} 数値またはnull
 */
function toNumberOrNull(value) {
    if (value == null || value === '') {
        return null;
    }

    const num = Number(value);
    return isNaN(num) ? null : num;
}