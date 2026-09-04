/*
 * スクリプトログテーブル側
 * サイト設定の読み込み時
 * UserData のログ依頼を受け取り、ログレコードを作成する。
 *
 * 変更履歴:
 * - 2026-08-24: ClassHash / DescriptionHash / NumHash / DateHash も設定し、SSログ詳細をDescriptionBへ保存できるようにした。
 * - 2026-08-26: ファイル名をserverScriptLogReceiver.jsへ変更し、ログテーブル側の受信処理であることを明確化した。
 * - 2026-09-03: ログ作成先サイトIDは依頼値または配置先ログテーブルのcontext.SiteIdから決定するようにした。
 */

const RUN_SCRIPT_LOG_CONFIG = {
    logSiteId: 1234,               // context.SiteId が取れない場合の既定スクリプトログテーブルサイトID
    triggerKey: 'run-script-log'
};

receiveScriptLogBySiteLoad(context);

/**
 * ログ依頼を受け取り、ログレコードを作成する。
 *
 * @param {Object} context サーバスクリプトのcontext
 */
function receiveScriptLogBySiteLoad(context) {
    const request = getScriptLogRequest(context);

    if (!request) {
        return;
    }

    if (request.triggerKey !== RUN_SCRIPT_LOG_CONFIG.triggerKey) {
        return;
    }

    context.UserData.ScriptLogRequest = null;

    const item = buildScriptLogItem(request);
    items.Create(resolveReceiverLogSiteId(context, request), item);
}

/**
 * ログテーブル側でレコード作成先サイトIDを決定する。
 *
 * @param {Object} context サーバスクリプトのcontext
 * @param {Object} request ログ依頼
 * @returns {string|number} スクリプトログテーブルのサイトID
 */
function resolveReceiverLogSiteId(context, request) {
    if (request && request.logSiteId) {
        return request.logSiteId;
    }

    if (context && context.SiteId) {
        return context.SiteId;
    }

    return RUN_SCRIPT_LOG_CONFIG.logSiteId;
}

/**
 * UserData からログ依頼を取得する。
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
    const classHash = {
        ClassA: String(request.sourceApp || ''),
        ClassB: request.level || 'info',
        ClassC: String(request.userId || ''),
        ClassD: String(request.deptId || '')
    };
    const descriptionHash = {
        DescriptionA: request.processName || '',
        DescriptionB: request.detail || ''
    };
    const numHash = {
        NumA: toNumberOrNull(request.sourceSiteId),
        NumB: toNumberOrNull(request.sourceRecordId)
    };
    const dateHash = {
        DateA: getCurrentTimestamp()
    };

    item.Title = buildLogTitle(request);

    item.ClassA = classHash.ClassA;
    item.ClassB = classHash.ClassB;
    item.ClassC = classHash.ClassC;
    item.ClassD = classHash.ClassD;
    item.ClassHash = classHash;

    item.DescriptionA = descriptionHash.DescriptionA;
    item.DescriptionB = descriptionHash.DescriptionB;
    item.DescriptionHash = descriptionHash;

    item.NumA = numHash.NumA;
    item.NumB = numHash.NumB;
    item.NumHash = numHash;

    item.DateA = dateHash.DateA;
    item.DateHash = dateHash;

    return item;
}

/**
 * ログタイトルを生成する。
 *
 * @param {Object} request ログ依頼
 * @returns {string} タイトル
 */
function buildLogTitle(request) {
    return (request.sourceApp || 'site') +
        ' / ' +
        (request.processName || 'process') +
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
 * @returns {number|null} 数値または null
 */
function toNumberOrNull(value) {
    if (value == null || value === '') {
        return null;
    }

    const num = Number(value);
    return isNaN(num) ? null : num;
}
