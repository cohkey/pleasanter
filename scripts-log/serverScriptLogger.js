/*
 * 業務テーブル側
 * ScriptLogger でログ内容を蓄積し、最後にログテーブルへ保存依頼を出す。
 *
 * 方針:
 * - 原則は1イベント処理につき、1ログレコードを作成する
 * - 画面表示系イベントは deferToClient を使い、CS側で1操作ログに束ねる
 * - event側では runEvent を呼ぶ
 * - 各処理関数は logger を受け取り、logger.info / warn / error に追記する
 * - group は console.group と同じように使う
 *
 * 変更履歴:
 * - 2026-08-24: deferToClient を追加し、画面表示系SSイベントをCS側の1操作ログへ渡せるようにした。
 * - 2026-08-26: イベント単位の開始/終了境界線を追加し、統合ログ内でSSイベントを見分けやすくした。
 * - 2026-08-26: ファイル名をserverScriptLogger.jsへ変更し、SS側ログ部品であることを明確化した。
 * - 2026-08-26: deferToClient指定時でもエラー時は即時保存し、更新失敗ログを失わないようにした。
 * - 2026-08-26: SSイベント内の境界線を-----に変更し、CS側の操作単位境界と区別しやすくした。
 * - 2026-09-03: スクリプトログテーブルのサイトIDを外部設定または呼び出しオプションで指定できるようにした。
 * - 2026-09-04: 未終了groupの自動クローズをUnclosed表記にし、警告理由を明示するようにした。
 * - 2026-09-08: 新規作成後はmodel/savedの実レコードIDを優先し、context.IdがサイトIDとなる環境でも正しく記録するようにした。
 */

const SCRIPT_LOG_CONFIG = {
    logSiteId: 1234,               // 外部指定がない場合の既定スクリプトログテーブルサイトID
    triggerKey: 'run-script-log'
};

/**
 * SSスクリプトログの既定設定を変更する。
 * 共通logger読込後に setScriptLogConfig({ logSiteId: 1234 }) の形で呼び出せる。
 *
 * @param {Object} options 設定値
 * @param {string|number} [options.logSiteId] スクリプトログテーブルのサイトID
 */
function setScriptLogConfig(options) {
    options = options || {};

    if (options.logSiteId) {
        SCRIPT_LOG_CONFIG.logSiteId = options.logSiteId;
    }
}

/**
 * SSログ保存先のスクリプトログテーブルサイトIDを決定する。
 * 優先順:
 * 1. 呼び出しオプション options.logSiteId
 * 2. context.UserData.PleasanterScriptLogConfig.logSiteId
 * 3. PleasanterScriptLogConfig.logSiteId
 * 4. SCRIPT_LOG_CONFIG.logSiteId
 *
 * @param {Object} context サーバスクリプトのcontext
 * @param {Object} [options] ログオプション
 * @returns {string|number} スクリプトログテーブルのサイトID
 */
function resolveScriptLogSiteId(context, options) {
    options = options || {};

    if (options.logSiteId) {
        return options.logSiteId;
    }

    const externalConfig = getExternalScriptLogConfig(context);

    if (externalConfig.logSiteId) {
        return externalConfig.logSiteId;
    }

    return SCRIPT_LOG_CONFIG.logSiteId;
}

/**
 * 外部から指定されたSSスクリプトログ設定を取得する。
 *
 * @param {Object} context サーバスクリプトのcontext
 * @returns {Object} 外部設定
 */
function getExternalScriptLogConfig(context) {
    if (
        context &&
        context.UserData &&
        context.UserData.PleasanterScriptLogConfig
    ) {
        return context.UserData.PleasanterScriptLogConfig;
    }

    if (
        typeof PleasanterScriptLogConfig !== 'undefined' &&
        PleasanterScriptLogConfig
    ) {
        return PleasanterScriptLogConfig;
    }

    return {};
}

/**
 * SSログの実行元レコードIDを決定する。
 * 新規作成後はcontext.Idが作成前の値を保持する環境があるため、
 * modelまたはsavedに設定された作成済みIDを優先する。
 *
 * @param {Object} context サーバスクリプトのcontext
 * @param {Object} [options] ログオプション
 * @returns {string|number} 実行元レコードID
 */
function resolveServerSourceRecordId(context, options) {
    options = options || {};

    if (
        options.sourceRecordId !== undefined &&
        options.sourceRecordId !== null &&
        options.sourceRecordId !== ''
    ) {
        return options.sourceRecordId;
    }

    const modelRecordId = getServerModelRecordId(
        typeof model !== 'undefined' ? model : null
    );

    if (modelRecordId) {
        return modelRecordId;
    }

    const savedRecordId = getServerModelRecordId(
        typeof saved !== 'undefined' ? saved : null
    );

    return savedRecordId || context.Id || '';
}

/**
 * modelまたはsavedからテーブル種別に応じたレコードIDを取得する。
 *
 * @param {Object} value modelまたはsaved
 * @returns {string|number} レコードID
 */
function getServerModelRecordId(value) {
    if (!value) {
        return '';
    }

    return value.ResultId || value.IssueId || '';
}

/**
 * スクリプトログ保存依頼を起動する。
 *
 * @param {Object} context サーバスクリプトのcontext
 * @param {Object} options ログ引数
 * @param {string|number} options.sourceApp 実行元アプリID（siteId）
 * @param {string} options.processName 処理名
 * @param {string} options.level ログレベル
 * @param {string} options.detail 詳細ログ
 * @param {string|number} [options.logSiteId] スクリプトログテーブルのサイトID
 * @param {number|string} [options.sourceRecordId] 実行元レコードID
 */
function requestScriptLogSaveBySiteLoad(context, options) {
    const logSiteId = resolveScriptLogSiteId(context, options);

    context.UserData.ScriptLogRequest = {
        triggerKey: SCRIPT_LOG_CONFIG.triggerKey,
        logSiteId: logSiteId,
        sourceApp: options.sourceApp || context.SiteId || '',
        level: options.level || 'info',
        processName: options.processName || '',
        sourceSiteId: context.SiteId || '',
        sourceRecordId: resolveServerSourceRecordId(context, options),
        userId: context.UserId || '',
        deptId: context.DeptId || '',
        controlId: context.ControlId || '',
        detail: options.detail || ''
    };

    items.GetSite(logSiteId);

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
     * @param {string|number} [options.logSiteId] スクリプトログテーブルのサイトID
     * @param {number|string} [options.sourceRecordId] 実行元レコードID
     * @param {boolean} [options.enableConsoleLog=true] context.Logへ出力するか
     */
    constructor(context, options) {
        options = options || {};

        this.context = context;
        this.sourceApp = options.sourceApp || context.SiteId || '';
        this.processName = options.processName || '';
        this.logSiteId = resolveScriptLogSiteId(context, options);
        this.sourceRecordId = resolveServerSourceRecordId(context, options);
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
     * イベントやログ取り込み単位の境界線を追加する。
     *
     * @param {string} type start / end / abnormalEnd
     * @param {string} label 境界名
     * @param {string} [suffix] 末尾文言
     */
    section(type, label, suffix) {
        let status = '開始';

        if (type === 'end') {
            status = '終了';
        } else if (type === 'abnormalEnd') {
            status = '異常終了';
        }

        const line =
            '----- ' +
            status +
            ': ' +
            label +
            (suffix ? ' ' + suffix : '') +
            ' ' +
            this.getLogMetaText() +
            ' -----';

        this.details.push(line);

        if (this.enableConsoleLog) {
            this.context.Log(line);
        }

        this.lastLogAtMs = Date.now();
    }

    /**
     * 境界線の開始を追加する。
     *
     * @param {string} label 境界名
     */
    sectionStart(label) {
        this.section('start', label);
    }

    /**
     * 境界線の終了を追加する。
     *
     * @param {string} label 境界名
     * @param {string} [suffix] 末尾文言
     */
    sectionEnd(label, suffix) {
        this.section('end', label, suffix);
    }

    /**
     * 未終了のグループをすべて自動クローズする。
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
                'Unclosed +' + elapsedMs + 'ms'
            );

            this.warn(
                'groupEnd未実行のため、未終了groupを自動クローズしました: ' +
                group.label
            );
        }
    }

    /**
     * 現在のログ内容を保存する。
     *
     * @param {Object} [options] 保存オプション
     * @param {boolean} [options.deferToClient=false] trueの場合はログレコードを作成せず、context.Log経由でCS側に渡す
     */
    save(options) {
        options = options || {};

        /*
         * 念のため、閉じ忘れたgroupを閉じる。
         */
        this.closeAllGroups();

        const totalMs = Date.now() - this.startedAtMs;
        this.details.push('総処理時間: ' + totalMs + 'ms');

        if (options.deferToClient && this.level !== 'error') {
            return;
        }

        requestScriptLogSaveBySiteLoad(this.context, {
            sourceApp: this.sourceApp,
            processName: this.processName,
            level: this.level,
            detail: this.details.join('\n'),
            logSiteId: this.logSiteId,
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
 * 画面表示系イベントをCS側で1操作ログに束ねる場合は options.deferToClient をtrueにする。
 *
 * @param {Object} context サーバスクリプトのcontext
 * @param {string} eventName イベント名
 * @param {Array<Object>} steps 実行ステップ一覧
 * @param {Object} [options] ログオプション
 * @param {string|number} [options.sourceApp] 実行元アプリID
 * @param {string|number} [options.logSiteId] スクリプトログテーブルのサイトID
 * @param {number|string} [options.sourceRecordId] 実行元レコードID
 * @param {boolean} [options.enableConsoleLog=true] context.Logへ出力するか
 * @param {boolean} [options.deferToClient=false] trueの場合はSS側では保存せず、CS側の操作ログへ束ねる
 * @returns {ScriptLogger} logger
 */
function runEvent(context, eventName, steps, options) {
    options = options || {};

    const logger = new ScriptLogger(context, {
        sourceApp: options.sourceApp || context.SiteId,
        processName: eventName,
        logSiteId: options.logSiteId,
        sourceRecordId: resolveServerSourceRecordId(context, options),
        enableConsoleLog: options.enableConsoleLog
    });
    const eventSectionLabel = 'SSイベント: ' + eventName;
    let eventSectionClosed = false;

    try {
        logger.sectionStart(eventSectionLabel);
        logger.info(eventName + '処理を開始します');
        logger.info('実行元情報 ' + JSON.stringify({
            siteId: context.SiteId || '',
            recordId: logger.sourceRecordId || '',
            userId: context.UserId || ''
        }));

        for (let i = 0; i < steps.length; i++) {
            runStep(logger, steps[i]);
        }

        logger.info(eventName + '処理を終了します');
        logger.sectionEnd(eventSectionLabel);
        eventSectionClosed = true;

    } catch (e) {
        /*
         * Pleasanter SSでは e.message が取れないことがあるため、e.stack前提。
         * Application Errorを避けたい場合、ここでは throw しない。
         */
        logger.error(e.stack);
        logger.closeAllGroups();

        if (!eventSectionClosed) {
            logger.section('abnormalEnd', eventSectionLabel);
            eventSectionClosed = true;
        }

        context.AddResponse(
            'Message',
            eventName + '処理中にエラーが発生しました。管理者に連絡してください。'
        );

    } finally {
        logger.save({
            deferToClient: options.deferToClient === true
        });
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
