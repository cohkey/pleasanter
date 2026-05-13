/*
 * common/logger
 * ClientScriptLogger でログ内容を蓄積し、最後にSSログと同じログテーブルへ保存する。
 *
 * 方針:
 * - 1イベント処理につき、1ログレコードを作成する
 * - console.group と同じように logger.group() / logger.groupEnd() を使う
 * - CS側では console.log にも出力する
 * - ログ保存は $p.apiCreate で同じログテーブルに直接作成する
 */

const CLIENT_SCRIPT_LOG_CONFIG = {
    logSiteId: 1234,       // ← スクリプトログテーブルのサイトIDに変更
    enableApiSave: true,   // false にすると console 出力のみ
    enableConsoleLog: true
};

/**
 * クライアントスクリプトログ管理クラス
 */
class ClientScriptLogger {
    /**
     * @param {Object} options 共通ログ情報
     * @param {string|number} [options.sourceApp] 実行元アプリID
     * @param {string|number} [options.sourceSiteId] 実行元サイトID
     * @param {string} options.processName 処理名
     * @param {number|string} [options.sourceRecordId] 実行元レコードID
     * @param {string|number} [options.userId] ユーザーID
     * @param {string|number} [options.deptId] 部署ID
     * @param {boolean} [options.enableConsoleLog=true] consoleへ出力するか
     * @param {boolean} [options.enableApiSave=true] ログテーブルへ保存するか
     */
    constructor(options) {
        options = options || {};

        this.sourceApp = options.sourceApp || getClientSiteId();
        this.sourceSiteId = options.sourceSiteId || getClientSiteId();
        this.processName = options.processName || '';
        this.sourceRecordId = options.sourceRecordId || getClientRecordId();

        this.userId = options.userId || getClientUserId();
        this.deptId = options.deptId || getClientDeptId();

        this.enableConsoleLog = options.enableConsoleLog !== false;
        this.enableApiSave = options.enableApiSave !== false;

        this.details = [];
        this.level = 'info';

        this.startedAtMs = Date.now();
        this.lastLogAtMs = this.startedAtMs;

        this.indentLevel = 0;
        this.groupStack = [];
    }

    /**
     * 情報ログを追加する。
     *
     * @param {string} message ログメッセージ
     */
    info(message) {
        this.add(message, 'info');
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
     * 呼び出し側では logger.error(e.stack) を基本にする。
     *
     * @param {string} message ログメッセージ
     */
    error(message) {
        this.add(message, 'error');
    }

    /**
     * ログを追加する。
     *
     * @param {string} message ログメッセージ
     * @param {string} [level] ログレベル
     */
    add(message, level) {
        const logLevel = level || 'info';
        const prefix =
            this.getIndentText() +
            '[' + logLevel + '] ' +
            this.getLogMetaText() + ' ';

        const detailLine = this.formatPrefixedMultilineMessage(
            prefix,
            String(message || '')
        );

        this.details.push(detailLine);

        if (this.enableConsoleLog && CLIENT_SCRIPT_LOG_CONFIG.enableConsoleLog) {
            this.writeConsole(logLevel, detailLine);
        }

        this.lastLogAtMs = Date.now();
        this.raiseLevel(logLevel);
    }

    /**
     * グループを開始する。
     * console.group と同じように、
     * logger.group('処理名') → 処理 → logger.groupEnd() の形で使う。
     *
     * @param {string} label グループ名
     */
    group(label) {
        this.groupStack.push({
            label: label,
            startedAtMs: Date.now()
        });

        this.addGroupLine('start', label);
        this.indentLevel++;
    }

    /**
     * グループを終了する。
     */
    groupEnd() {
        if (this.groupStack.length === 0) {
            this.warn('groupEnd が呼ばれましたが、開始中の group がありません');
            return;
        }

        this.indentLevel--;

        if (this.indentLevel < 0) {
            this.indentLevel = 0;
        }

        const group = this.groupStack.pop();
        const elapsedMs = Date.now() - group.startedAtMs;

        this.addGroupLine(
            'end',
            group.label,
            'Done +' + elapsedMs + 'ms'
        );
    }

    /**
     * 未終了のグループをすべて異常終了として閉じる。
     * エラー発生時のログ崩れ防止用。
     */
    closeAllGroups() {
        while (this.groupStack.length > 0) {
            this.indentLevel--;

            if (this.indentLevel < 0) {
                this.indentLevel = 0;
            }

            const group = this.groupStack.pop();
            const elapsedMs = Date.now() - group.startedAtMs;

            this.addGroupLine(
                'abnormalEnd',
                group.label,
                'Failed +' + elapsedMs + 'ms'
            );

            this.raiseLevel('warn');
        }
    }

    /**
     * 現在のログ内容を保存する。
     *
     * @returns {Promise<void>}
     */
    save() {
        this.closeAllGroups();

        const totalMs = Date.now() - this.startedAtMs;
        this.details.push('Total: ' + totalMs + 'ms');

        if (!this.enableApiSave || !CLIENT_SCRIPT_LOG_CONFIG.enableApiSave) {
            return Promise.resolve();
        }

        return createClientScriptLogRecord(this);
    }

    /**
     * 詳細ログ文字列を返す。
     *
     * @returns {string}
     */
    getDetailText() {
        return this.details.join('\n');
    }

    /**
     * グループ行を追加する。
     * group行は先頭に ▼ / ▲ を置き、通常ログと見分けやすくする。
     *
     * @param {string} type start / end / abnormalEnd
     * @param {string} label グループ名
     * @param {string} [suffix] 末尾文言
     */
    addGroupLine(type, label, suffix) {
        let mark = '▼';

        if (type === 'end' || type === 'abnormalEnd') {
            mark = '▲';
        }

        const line =
            this.getIndentText() +
            mark + ' ' +
            label +
            (suffix ? ' ' + suffix : '') +
            ' ' +
            this.getLogMetaText();

        this.details.push(line);

        if (this.enableConsoleLog && CLIENT_SCRIPT_LOG_CONFIG.enableConsoleLog) {
            this.writeConsole('info', line);
        }

        this.lastLogAtMs = Date.now();
    }

    /**
     * consoleへ出力する。
     *
     * @param {string} level ログレベル
     * @param {string} message メッセージ
     */
    writeConsole(level, message) {
        if (level === 'error') {
            console.error(message);
            return;
        }

        if (level === 'warn') {
            console.warn(message);
            return;
        }

        console.log(message);
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
     * 現在のログメタ情報を返す。
     *
     * @returns {string}
     */
    getLogMetaText() {
        const nowMs = Date.now();
        const elapsedMs = nowMs - this.startedAtMs;
        const deltaMs = nowMs - this.lastLogAtMs;

        return '[' +
            this.getCurrentTimeText() +
            ' / ＋' + elapsedMs + 'ms / Δ' + deltaMs + 'ms]';
    }

    /**
     * 現在のインデント文字列を返す。
     *
     * @returns {string}
     */
    getIndentText() {
        let indent = '';

        for (let i = 0; i < this.indentLevel; i++) {
            indent += '  ';
        }

        return indent;
    }

    /**
     * 複数行メッセージを整形する。
     *
     * @param {string} prefix 接頭辞
     * @param {string} message メッセージ
     * @returns {string}
     */
    formatPrefixedMultilineMessage(prefix, message) {
        const lines = message.split('\n');

        if (lines.length <= 1) {
            return prefix + lines[0];
        }

        const secondLineIndent = this.getIndentText() + '  ';

        return prefix + lines[0] +
            '\n' +
            secondLineIndent +
            lines.slice(1).join('\n' + secondLineIndent);
    }

    /**
     * 現在時刻を HH:mm:ss 形式で返す。
     *
     * @returns {string}
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
 * CSログレコードを作成する。
 *
 * @param {ClientScriptLogger} logger ロガー
 * @returns {Promise<void>}
 */
function createClientScriptLogRecord(logger) {
    return new Promise(function (resolve) {
        if (!window.$p || typeof $p.apiCreate !== 'function') {
            console.warn('CSログ保存をスキップしました。$p.apiCreate が使用できません。');
            resolve();
            return;
        }

        const data = buildClientScriptLogApiData(logger);

        $p.apiCreate({
            id: CLIENT_SCRIPT_LOG_CONFIG.logSiteId,
            data: data,
            done: function () {
                console.log('CSログレコードを作成しました。');
                resolve();
            },
            fail: function (data) {
                console.error('CSログレコード作成に失敗しました。', data);
                resolve();
            },
            always: function () {
                resolve();
            }
        });
    });
}

/**
 * ログテーブル登録用データを作成する。
 * SSログテーブル側の buildScriptLogItem と同じ項目構成に合わせる。
 *
 * 対応:
 * Title        = buildLogTitle
 * ClassA       = sourceApp
 * ClassB       = level
 * ClassC       = userId
 * ClassD       = deptId
 * DescriptionA = processName
 * DescriptionB = detail
 * NumA         = sourceSiteId
 * NumB         = sourceRecordId
 * DateA        = 現在日時
 *
 * @param {ClientScriptLogger} logger ロガー
 * @returns {Object} apiCreate用data
 */
function buildClientScriptLogApiData(logger) {
    const request = {
        sourceApp: logger.sourceApp || '',
        level: logger.level || 'info',
        processName: logger.processName || '',
        sourceSiteId: logger.sourceSiteId || logger.sourceApp || '',
        sourceRecordId: logger.sourceRecordId || '',
        userId: logger.userId || '',
        deptId: logger.deptId || '',
        detail: logger.getDetailText()
    };

    return {
        Title: buildClientLogTitle(request),

        ClassHash: {
            ClassA: String(request.sourceApp || ''),
            ClassB: request.level || 'info',
            ClassC: toNumberOrNull(request.userId),
            ClassD: toNumberOrNull(request.deptId)
        },

        DescriptionHash: {
            DescriptionA: request.processName || '',
            DescriptionB: request.detail || ''
        },

        NumHash: {
            NumA: toNumberOrNull(request.sourceSiteId),
            NumB: toNumberOrNull(request.sourceRecordId)
        },

        DateHash: {
            DateA: getCurrentTimestamp()
        }
    };
}

/**
 * CSログタイトルを生成する。
 * SS側の buildLogTitle と同じ形式にする。
 *
 * @param {Object} request ログ依頼
 * @returns {string} タイトル
 */
function buildClientLogTitle(request) {
    return (request.sourceApp || 'site') +
        ' / ' +
        (request.processName || 'process') +
        ' / ' +
        (request.level || 'info') +
        ' / ' +
        (request.sourceRecordId || '');
}

/**
 * 現在のサイトIDを取得する。
 *
 * @returns {string|number}
 */
function getClientSiteId() {
    if (window.$p && typeof $p.siteId === 'function') {
        return $p.siteId();
    }

    if (window.context && context.SiteId) {
        return context.SiteId;
    }

    return '';
}

/**
 * 現在のレコードIDを取得する。
 *
 * @returns {string|number}
 */
function getClientRecordId() {
    if (window.$p && typeof $p.id === 'function') {
        return $p.id();
    }

    if (window.context && context.Id) {
        return context.Id;
    }

    return '';
}

/**
 * 現在のユーザーIDを取得する。
 *
 * @returns {string|number}
 */
function getClientUserId() {
    if (window.$p && typeof $p.userId === 'function') {
        return $p.userId();
    }

    if (window.$p && $p.user && $p.user.UserId) {
        return $p.user.UserId;
    }

    if (window.context && context.UserId) {
        return context.UserId;
    }

    return '';
}

/**
 * 現在の部署IDを取得する。
 *
 * @returns {string|number}
 */
function getClientDeptId() {
    if (window.$p && typeof $p.deptId === 'function') {
        return $p.deptId();
    }

    if (window.$p && $p.user && $p.user.DeptId) {
        return $p.user.DeptId;
    }

    if (window.context && context.DeptId) {
        return context.DeptId;
    }

    return '';
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
 * 数値化できる場合だけ数値化する。
 *
 * @param {*} value 値
 * @returns {number|null}
 */
function toNumberOrNull(value) {
    if (value === null || value === undefined || value === '') {
        return null;
    }

    const num = Number(value);

    if (isNaN(num)) {
        return null;
    }

    return num;
}