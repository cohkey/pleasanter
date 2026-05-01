/*
 * 業務テーブル側
 * ScriptLogger でログ内容を蓄積し、最後にログテーブルへ保存依頼を出す。
 *
 * 方針:
 * - 1イベント処理につき、1ログレコードを作成する
 * - event側では runEvent を呼ぶ
 * - 各処理関数は logger を受け取り、logger.info / warn / error に追記する
 * - group は console.group と同じように使う
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
 * @param {string|number} options.sourceApp 実行元アプリID（siteId）
 * @param {string} options.processName 処理名
 * @param {string} options.level ログレベル
 * @param {string} options.detail 詳細ログ
 * @param {number|string} [options.sourceRecordId] 実行元レコードID
 */
function invokeScriptLogBySiteLoad(context, options) {
    context.UserData.ScriptLogRequest = {
        triggerKey: SCRIPT_LOG_CONFIG.triggerKey,
        sourceApp: options.sourceApp || context.SiteId || '',
        level: options.level || 'info',
        processName: options.processName || '',
        sourceSiteId: context.SiteId || '',
        sourceRecordId: options.sourceRecordId || context.Id || '',
        userId: context.UserId || '',
        deptId: context.DeptId || '',
        controlId: context.ControlId || '',
        detail: options.detail || ''
    };

    items.GetSite(SCRIPT_LOG_CONFIG.logSiteId);

    /*
     * 後続処理への影響防止
     */
    context.UserData.ScriptLogRequest = null;
}

/**
 * スクリプトログ管理クラス
 */
class ScriptLogger {
    /**
     * @param {Object} context サーバスクリプトのcontext
     * @param {Object} options 共通ログ情報
     * @param {string|number} [options.sourceApp] 実行元アプリID（siteId）
     * @param {string} options.processName 処理名
     * @param {number|string} [options.sourceRecordId] 実行元レコードID
     * @param {boolean} [options.enableConsoleLog=true] context.Logへ出力するか
     */
    constructor(context, options) {
        options = options || {};

        this.context = context;
        this.sourceApp = options.sourceApp || context.SiteId || '';
        this.processName = options.processName || '';
        this.sourceRecordId = options.sourceRecordId || context.Id || '';
        this.enableConsoleLog = options.enableConsoleLog !== false;

        this.details = [];
        this.level = 'info';

        this.startedAtMs = Date.now();
        this.lastLogAtMs = this.startedAtMs;

        /*
         * groupログ用
         */
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
     * Pleasanter SSでは e.message が期待通り取れないことがあるため、
     * 呼び出し側では logger.error(e.stack) を基本にする。
     *
     * @param {string} message ログメッセージ
     */
    error(message) {
        this.add(message, 'error');
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
        const prefix =
            this.getIndentText() +
            '[' + logLevel + '] ' +
            this.getLogMetaText() + ' ';

        const detailLine = this.formatPrefixedMultilineMessage(
            prefix,
            String(message || '')
        );

        this.details.push(detailLine);

        if (this.enableConsoleLog) {
            this.context.Log(detailLine);
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
            '完了 +' + elapsedMs + 'ms'
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
                '異常終了 +' + elapsedMs + 'ms'
            );

            this.raiseLevel('warn');
        }
    }

    /**
     * 現在のログ内容を保存する。
     */
    save() {
        /*
         * 念のため、閉じ忘れたgroupを閉じる。
         */
        this.closeAllGroups();

        const totalMs = Date.now() - this.startedAtMs;
        this.details.push('総処理時間: ' + totalMs + 'ms');

        invokeScriptLogBySiteLoad(this.context, {
            sourceApp: this.sourceApp,
            processName: this.processName,
            level: this.level,
            detail: this.details.join('\n'),
            sourceRecordId: this.sourceRecordId
        });
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

        if (this.enableConsoleLog) {
            this.context.Log(line);
        }

        this.lastLogAtMs = Date.now();
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
     * @returns {string} ログメタ情報
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
     * @returns {string} インデント文字列
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
     * 1行目は prefix を付与し、2行目以降は現在のインデントに合わせる。
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

        const secondLineIndent = this.getIndentText() + '  ';

        return prefix + lines[0] +
            '\n' +
            secondLineIndent +
            lines.slice(1).join('\n' + secondLineIndent);
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
 * イベント処理を実行する。
 * 1イベント処理につき、1件のログレコードを作成する想定。
 *
 * @param {Object} context サーバスクリプトのcontext
 * @param {string} eventName イベント名
 * @param {Array<Object>} steps 実行ステップ一覧
 * @param {Object} [options] ログオプション
 * @param {string|number} [options.sourceApp] 実行元アプリID
 * @param {number|string} [options.sourceRecordId] 実行元レコードID
 * @param {boolean} [options.enableConsoleLog=true] context.Logへ出力するか
 * @returns {ScriptLogger} logger
 */
function runEvent(context, eventName, steps, options) {
    options = options || {};

    const logger = new ScriptLogger(context, {
        sourceApp: options.sourceApp || context.SiteId,
        processName: eventName,
        sourceRecordId: options.sourceRecordId || context.Id,
        enableConsoleLog: options.enableConsoleLog
    });

    try {
        logger.info(eventName + '処理を開始します');
        logger.info('実行元情報 ' + JSON.stringify({
            siteId: context.SiteId || '',
            recordId: context.Id || '',
            userId: context.UserId || ''
        }));

        for (let i = 0; i < steps.length; i++) {
            runStep(logger, steps[i]);
        }

        logger.info(eventName + '処理を終了します');

    } catch (e) {
        /*
         * Pleasanter SSでは e.message が取れないことがあるため、e.stack前提。
         * Application Errorを避けたい場合、ここでは throw しない。
         */
        logger.error(e.stack);
        logger.closeAllGroups();

        context.AddResponse(
            'Message',
            eventName + '処理中にエラーが発生しました。管理者に連絡してください。'
        );

    } finally {
        logger.save();
    }

    return logger;
}

/**
 * 1ステップを実行する。
 *
 * @param {ScriptLogger} logger ロガー
 * @param {Object} step ステップ情報
 * @param {string} step.name 関数名
 * @param {string} step.label 日本語説明
 * @param {Function} step.action 実行関数
 */
function runStep(logger, step) {
    const stepLabel = step.name + ' - ' + step.label;

    logger.group(stepLabel);

    try {
        step.action(logger);
    } finally {
        logger.groupEnd();
    }
}