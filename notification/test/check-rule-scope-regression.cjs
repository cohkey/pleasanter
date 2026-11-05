/**
 * 変更履歴
 * 2026/11/05
 * ・通知ID分離の防御処理を外した場合に、回帰テストが失敗することを確認
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const sourcePath = path.join(__dirname, '../sk-realtime-notification.js');
const testsPath = path.join(__dirname, 'realtime-notification.test.cjs');
const source = fs.readFileSync(sourcePath, 'utf8');
const start = source.indexOf('function getNotificationConditions(ruleId) {');
const end = source.indexOf('\n/**', start);
assert.ok(start >= 0 && end > start, '条件取得関数を特定できること');
const body = source.slice(start, end);
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'notification-rule-scope-'));
const env = { ...process.env };
delete env.NOTIFICATION_BASELINE;

function verifyTestsDetect(name, from, to, expectedFailures) {
    assert.ok(body.includes(from), `${name}: 変更対象を特定できること`);
    const modified = source.slice(0, start) + body.replace(from, to) + source.slice(end);
    assert.notEqual(modified, source);
    const file = path.join(temp, `${name}.js`);
    fs.writeFileSync(file, modified);
    const syntax = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' });
    assert.equal(syntax.status, 0, syntax.stderr);
    const run = spawnSync(process.execPath, [
        '--test', '--test-reporter=tap',
        '--test-name-pattern=別通知ID|条件検索は親ID', testsPath
    ], { encoding: 'utf8', env: { ...env, NOTIFICATION_SOURCE: file }, timeout: 30000 });
    assert.equal(run.error, undefined, String(run.error));
    assert.equal(run.status, 1, `${name}: 回帰テストが失敗すること\n${run.stdout}\n${run.stderr}`);
    const failures = [...run.stdout.matchAll(/^not ok \d+ - (.+)$/gm)].map(match => match[1]);
    for (const title of expectedFailures) {
        assert.ok(failures.includes(title), `${name}: ${title} が不具合を検出すること\n${run.stdout}`);
    }
    process.stdout.write(`PASS ${name}: ${expectedFailures.length}件の想定した失敗を確認\n`);
}

try {
    verifyTestsDetect('親IDの再確認を除去',
        '    )).filter(condition =>\n        String(condition.ClassA) === String(ruleId)\n    );',
        '    ));', [
            '別通知IDで同じパターン1を使ってもN001だけ成立する',
            '別通知IDの条件で自ルールを誤って成立させない',
            '別通知IDの不正なFROM_TOを自ルールの評価に含めない',
            '条件検索は親IDを配列として指定し、取得後も完全一致で絞り込む'
        ]);
    verifyTestsDetect('検索値を単一文字列へ戻す',
        'ClassA: JSON.stringify([String(ruleId)])',
        'ClassA: String(ruleId)', [
            '条件検索は親IDを配列として指定し、取得後も完全一致で絞り込む'
        ]);
} finally {
    fs.rmSync(temp, { recursive: true, force: true });
}
