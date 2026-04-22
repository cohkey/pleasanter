/*
 * ログテーブル側：作成前
 * 起動用レコードだけを対象に、最終的なログレコードへ整形する。
 */
const SCRIPT_LOG_TRIGGER_KEY = 'run-script-log';
const SCRIPT_LOG_TYPE = 'SS';

if (model.ClassA !== SCRIPT_LOG_TRIGGER_KEY) {
    return;
}

const endedAt = getCurrentTimestamp();
const startedAt = model.DateA || endedAt;

/*
 * 起動用の値を、正式なログ値へ整形
 */
model.Title = buildLogTitle(model.ClassB, model.ClassD, model.NumB);
model.ClassA = createExecutionId();
model.ClassE = SCRIPT_LOG_TYPE; // ClassEをscriptType用に増やすなら使う
model.DateB = endedAt;
model.NumD = calcDurationMs(startedAt, endedAt);

/*
 * triggerKeyを残したくないなら消す
 * ただし運用上、残した方が後で見分けやすいならそのままでもよい
 */
// model.ClassA = '';

function buildLogTitle(action, status, sourceRecordId) {
    return (action || 'script') + ' / ' + (status || '') + ' / ' + (sourceRecordId || '');
}

function createExecutionId() {
    return 'exec_' + new Date().getTime();
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

function calcDurationMs(startedAt, endedAt) {
    if (!startedAt || !endedAt) {
        return null;
    }

    const start = new Date(String(startedAt).replace(/\//g, '-'));
    const end = new Date(String(endedAt).replace(/\//g, '-'));

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        return null;
    }

    return end.getTime() - start.getTime();
}