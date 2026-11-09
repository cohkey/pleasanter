/**
 * 2026/11/09
 * ・GM検索の店所・区分の完全一致を壊したコピーで回帰検出力を確認
 */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const source = fs.readFileSync(path.join(__dirname, '../sk-realtime-notification.js'), 'utf8');
const start = source.indexOf('function getGmGroupAddresses(');
const end = source.indexOf('\nconst MAIL_SETTING_FIELDS', start);
assert.ok(start >= 0 && end > start);
const body = source.slice(start, end);
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'notification-gm-scope-'));
try {
    for (const [name, from, to, expected] of [
        ['店所の防御除去', 'String(record[fields.store]) === store &&', 'true &&', 'GM: 検索フィルタが効かなくても別店所・類似区分を除外する'],
        ['区分の防御除去', 'String(record[fields.category]) === category', 'true', 'GM: 検索フィルタが効かなくても別店所・類似区分を除外する'],
        ['店所検索の配列を除去', '[fields.store]: JSON.stringify([store])', '[fields.store]: store', 'GM: 通常店所の客サは1件']
    ]) {
        assert.ok(body.includes(from), name);
        const file = path.join(temp, name + '.js');
        fs.writeFileSync(file, source.slice(0, start) + body.replace(from, to) + source.slice(end));
        const env = { ...process.env, NOTIFICATION_SOURCE: file };
        delete env.NOTIFICATION_BASELINE;
        const result = spawnSync(process.execPath, ['--test', '--test-reporter=tap', '--test-name-pattern=GM:', path.join(__dirname, 'realtime-notification.test.cjs')], { encoding: 'utf8', env, timeout: 30000 });
        assert.equal(result.error, undefined);
        assert.equal(result.status, 1, result.stdout + result.stderr);
        const failures = [...result.stdout.matchAll(/^not ok \d+ - (.+)$/gm)].map(m => m[1]);
        assert.ok(failures.includes(expected), result.stdout);
        process.stdout.write(`PASS ${name}: 想定した回帰テスト失敗を確認\n`);
    }
} finally {
    fs.rmSync(temp, { recursive: true, force: true });
}
