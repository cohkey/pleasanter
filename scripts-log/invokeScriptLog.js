/*
 * 業務テーブル側
 * ScriptLogger でログ内容を蓄積し、最後にログテーブルへ保存依頼を出す。
 */

const SCRIPT_LOG_CONFIG = {
    logSiteId: 1234,               // ← スクリプトログテーブルのサイトIDに変更
    triggerKey: 'run-script-log'
};

/**
 * スクリプトログ保存依頼を起動する。
 *
 * @param {Object} context サーバスクリプトのcontext
 * @param {Object} options ログ引数
 * @param {string} options.appName アプリ名
 * @param {string} options.processName 処理名
 * @param {string} options.level ログレベル
 * @param {string} options.detail 詳細ログ
 * @param {number|string} [options.sourceRecordId] 実行元レコードID
 */
function invokeScriptLogBySiteLoad(context, options) {
    context.UserData.ScriptLogRequest = {
        triggerKey: SCRIPT_LOG_CONFIG.triggerKey,
        appName: options.appName || context.SiteTitle || '',
        level: options.level || 'info',
        processName: options.processName || '',
        sourceSiteId: context.SiteId || '',
        sourceRecordId: options.sourceRecordId || context.Id || '',
        userId: context.UserId || '',
        deptId: context.DeptId || '',
        controlId: context.ControlId || '',
        detail: options.detail || ''
    };

    // 実環境で GetSite によりログテーブル側の「サイト設定の読み込み時」SSを起動する前提
    items.GetSite(SCRIPT_LOG_CONFIG.logSiteId);

    // 後続処理への影響防止
    context.UserData.ScriptLogRequest = null;
}

/**
 * スクリプトログ管理クラス
 */
class ScriptLogger {
    /**
     * @param {Object} context サーバスクリプトのcontext
     * @param {Object} options 共通ログ情報
     * @param {string} options.appName アプリ名
     * @param {string} options.processName 処理名
     * @param {number|string} [options.sourceRecordId] 実行元レコードID
     * @param {boolean} [options.enableConsoleLog=true] context.Logへ出力するか
     */
    constructor(context, options) {
        this.context = context;
        this.appName = options.appName || context.SiteTitle || '';
        this.processName = options.processName || '';
        this.sourceRecordId = options.sourceRecordId || context.Id || '';
        this.enableConsoleLog = options.enableConsoleLog !== false;

        this.details = [];
        this.level = 'info';

        this.startedAtMs = Date.now();
        this.lastLogAtMs = this.startedAtMs;
    }

    /**
     * ログを追加する。
     * detail には全行レベル付きで保存する。
     *
     * @param {string} message ログメッセージ
     * @param {string} [level] ログレベル
     */
    add(message, level) {
        const logLevel = level || 'info';
        const nowMs = Date.now();
        const elapsedMs = nowMs - this.startedAtMs;
        const deltaMs = nowMs - this.lastLogAtMs;

        const prefix =
            '[' + logLevel + '] ' +
            '[' + this.getCurrentTimeText() +
            ' / ' + elapsedMs + 'ms / Δ' + deltaMs + 'ms] ';

        const detailLine = this.formatPrefixedMultilineMessage(prefix, String(message || ''));

        this.details.push(detailLine);

        if (this.enableConsoleLog) {
            this.context.Log(detailLine);
        }

        this.lastLogAtMs = nowMs;
        this.raiseLevel(logLevel);
    }

    /**
     * 警告ログを追加する。
     *
     * @param {string} message ログメッセージ
     */
    warn(message) {
        this.add(message, 'warn');
    }

    /**
     * エラーログを追加する。
     *
     * @param {string} message ログメッセージ
     */
    error(message) {
        this.add(message, 'error');
    }

    /**
     * 現在のログ内容を保存する。
     */
    save() {
        const totalMs = Date.now() - this.startedAtMs;
        this.details.push('総処理時間: ' + totalMs + 'ms');

        invokeScriptLogBySiteLoad(this.context, {
            appName: this.appName,
            processName: this.processName,
            level: this.level,
            detail: this.details.join('\n'),
            sourceRecordId: this.sourceRecordId
        });
    }

    /**
     * ログレベルを引き上げる。
     *
     * @param {string} level ログレベル
     */
    raiseLevel(level) {
        if (level === 'error') {
            this.level = 'error';
            return;
        }

        if (level === 'warn' && this.level !== 'error') {
            this.level = 'warn';
        }
    }

    /**
     * 複数行メッセージを整形する。
     * 1行目は prefix を付与し、2行目以降はインデントする。
     *
     * @param {string} prefix 接頭辞
     * @param {string} message メッセージ
     * @returns {string} 整形後メッセージ
     */
    formatPrefixedMultilineMessage(prefix, message) {
        const lines = message.split('\n');

        if (lines.length <= 1) {
            return prefix + lines[0];
        }

        return prefix + lines[0] + '\n  ' + lines.slice(1).join('\n  ');
    }

    /**
     * 現在時刻を HH:mm:ss 形式で返す。
     *
     * @returns {string} 現在時刻
     */
    getCurrentTimeText() {
        const now = new Date();
        const hh = ('0' + now.getHours()).slice(-2);
        const mm = ('0' + now.getMinutes()).slice(-2);
        const ss = ('0' + now.getSeconds()).slice(-2);

        return hh + ':' + mm + ':' + ss;
    }
}

/**
 * エラー詳細を文字列化する。
 *
 * @param {Object} error エラーオブジェクト
 * @returns {string} エラー詳細
 */
function buildErrorDetail(error) {
    if (!error) {
        return '';
    }

    const message = error.message || String(error);
    const stack = error.stack || '';
    return stack ? message + '\n' + stack : message;
}