const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');

const source = fs.readFileSync(path.join(__dirname, '../sk-realtime-notification.js'), 'utf8');
const baseline = process.env.NOTIFICATION_BASELINE
    ? fs.readFileSync(process.env.NOTIFICATION_BASELINE, 'utf8')
    : null;

function fixture() {
    return {
        data: JSON.stringify({ changedFields: { status: { oldValue: '受付', newValue: '完了' } } }),
        model: { Title: '検証', ClassB: '完了', ClassD: '001', ClassE: '100', ClassF: '200' },
        rules: [{ ResultId: 10, Title: 'ルール', DescriptionA: '検証ルール', CheckA: true,
            DescriptionB: '通知 {件名}', DescriptionC: '{店所コード}/{ステータス}/{電圧}' }],
        conditions: [{ ClassA: '10', ClassB: '1', ClassC: 'status', ClassD: 'TO', DescriptionB: '完了' }],
        targets: [{ ClassA: '10', ClassB: 'G1', ClassC: 'To' }],
        organizations: [{ ClassA: '001', ClassC: 'G1', DescriptionA: 'ORG1' }],
        mail: [{ DescriptionB: 'ORG1', ClassZ: '["1"]', DescriptionA: 'test@example.invalid' }],
        sendEnabled: false,
        sendResult: true
    };
}

function execute(code, input) {
    const events = [];
    const notification = { Send() { events.push(['send', { ...this, Send: undefined }]); return input.sendResult; } };
    const sandbox = {
        model: input.model,
        context: {
            UserData: { notificationData: input.data },
            Log(value) { events.push(['log', String(value).replace(/^CC:/, 'Cc:')]); },
            AddMessage(...args) { events.push(['message', ...args]); }
        },
        notifications: { New() { events.push(['newNotification']); return notification; } },
        items: {
            Get(id, query) {
                events.push(['get', id, query]);
                const tables = { 843614: input.conditions, 843620: input.targets,
                    846822: input.organizations, 809267: input.mail };
                if (!query) return input.rules.filter(rule => rule.ResultId === id);
                const view = JSON.parse(query).View;
                return (tables[id] || []).filter(row => Object.entries(view.ColumnFilterHash).every(([key, value]) =>
                    view.ColumnFilterSearchTypes[key] === 'ExactMatchMultiple'
                        ? JSON.parse(value).includes(row[key])
                        : String(row[key]) === String(value)
                ));
            }
        }
    };
    vm.createContext(sandbox);
    let error;
    try {
        const executable = input.sendEnabled
            ? code.replace('const SEND_ENABLED = false;', 'const SEND_ENABLED = true;')
            : code;
        vm.runInContext(executable, sandbox);
        sandbox.sendRealtimeNotification();
    } catch (e) { error = e.message; }
    return JSON.parse(JSON.stringify({ events, error }));
}

function logs(result) { return result.events.filter(e => e[0] === 'log').map(e => e[1]); }
function hasMessage(result) { return logs(result).some(value => value.startsWith('件名:')); }

const cases = [
    ['引き継ぎ情報なし', f => { f.data = undefined; }, r => assert.equal(r.events.length, 0)],
    ['変更なし', f => { f.data = '{"changedFields":{}}'; }, r => assert.equal(hasMessage(r), false)],
    ['changedFields未設定', f => { f.data = '{}'; }, r => assert.equal(hasMessage(r), false)],
    ['不正なJSON', f => { f.data = '{'; }, r => assert.ok(r.error)],
    ['正常な通知準備と送信無効', () => {}, r => {
        assert.ok(logs(r).includes('To: [User1],test@example.invalid'));
        assert.ok(logs(r).includes('本文: 001/完了/200'));
        assert.equal(r.events.some(e => e[0] === 'newNotification'), false);
    }],
    ['TO不成立', f => { f.conditions[0].DescriptionB = '別の値'; }, r => assert.equal(hasMessage(r), false)],
    ['TOは保存した変更値で判定', f => { f.model.ClassB = '現在値'; }, r => assert.ok(hasMessage(r))],
    ['無効なルール', f => { f.rules[0].CheckA = false; }, r => assert.equal(hasMessage(r), false)],
    ['文字列trueは有効とみなさない', f => { f.rules[0].CheckA = 'true'; }, r => assert.equal(hasMessage(r), false)],
    ['関連条件なし', f => { f.conditions = []; }, r => assert.equal(hasMessage(r), false)],
    ['ルールが見つからない', f => { f.rules = []; }, r => assert.ok(logs(r).includes('通知ルールが見つかりません: 10'))],
    ['同一パターンはAND', f => { f.conditions.push({ ClassA:'10', ClassB:'1', ClassC:'denatsu', ClassD:'EQ', DescriptionB:'999' }); }, r => assert.equal(hasMessage(r), false)],
    ['別パターンはOR・パターンごとのトリガー必須化なし', f => {
        f.conditions[0].DescriptionB = '不成立';
        f.conditions.push({ ClassA:'10', ClassB:'2', ClassC:'denatsu', ClassD:'EQ', DescriptionB:'100' });
    }, r => assert.ok(hasMessage(r))],
    ['通知対象なし', f => { f.targets = []; }, r => { assert.equal(hasMessage(r), false); assert.equal(r.error, undefined); }],
    ['組織なしはTo不足', f => { f.organizations = []; }, r => assert.equal(r.error, 'Toの通知先がありません')],
    ['不正な宛先区分', f => { f.targets[0].ClassC = 'CC'; }, r => assert.equal(r.error, '宛先区分が不正です: CC')],
    ['CcだけではTo不足', f => { f.targets[0].ClassC = 'Cc'; }, r => assert.equal(r.error, 'Toの通知先がありません')],
    ['To優先で重複排除', f => {
        for (const kind of ['Cc','Bcc']) f.targets.push({ClassA:'10',ClassB:'G1',ClassC:kind});
    }, r => { assert.ok(logs(r).includes('Cc: ')); assert.ok(logs(r).includes('Bcc: ')); }],
    ['独立したCc宛先', f => {
        f.targets.push({ClassA:'10',ClassB:'G2',ClassC:'Cc'});
        f.organizations.push({ClassA:'001',ClassC:'G2',DescriptionA:'ORG2'});
        f.mail.push({DescriptionB:'ORG2',ClassZ:'[]',DescriptionA:'cc@example.invalid'});
    }, r => assert.ok(logs(r).includes('Cc: cc@example.invalid'))],
    ['不正メール', f => { f.mail[0].DescriptionA = 'invalid'; }, r => assert.equal(r.error, 'メールアドレスの形式が不正です。')],
    ['不正ユーザIDは除外', f => { f.mail[0].ClassZ = '["bad","1"]'; }, r => assert.ok(logs(r).includes('To: [User1],test@example.invalid'))],
    ['ユーザ指定が配列でない', f => { f.mail[0].ClassZ = '{}'; }, r => assert.equal(r.error, '通知先ユーザの形式が不正です')],
    ['不正ユーザJSON', f => { f.mail[0].ClassZ = '['; }, r => assert.ok(r.error)],
    ['未定義テンプレート', f => { f.rules[0].DescriptionB = '{未定義}'; }, r => assert.equal(r.error, '未定義の置換項目: 未定義')],
    ['未定義演算子', f => { f.conditions.push({ClassA:'10',ClassB:'1',ClassC:'status',ClassD:'BAD'}); }, r => assert.equal(r.error, '未対応の判定方法: BAD')],
    ['複数ルールでは最初の例外で中断', f => {
        f.targets[0].ClassC = 'INVALID';
        f.rules.push({...f.rules[0],ResultId:11,Title:'後続ルール'});
        f.conditions.push({...f.conditions[0],ClassA:'11'});
    }, r => { assert.ok(r.error); assert.equal(r.events.some(e => e[0]==='get' && e[2]?.includes('"ClassA":"11"')), false); }],
    ['送信成功（テスト内の通知APIモックのみ）', f => { f.sendEnabled = true; }, r => {
        const sent = r.events.find(e => e[0] === 'send')[1];
        assert.equal(sent.Address, '[User1],test@example.invalid');
        assert.equal(sent.CcAddress, '');
        assert.equal(sent.Body, '001/完了/200');
        assert.ok(r.events.some(e => e[0] === 'message' && e[2] === 'alert-information'));
    }],
    ['送信失敗（テスト内の通知APIモックのみ）', f => { f.sendEnabled = true; f.sendResult = false; }, r =>
        assert.ok(r.events.some(e => e[0] === 'message' && e[2] === 'alert-error'))]
];

for (const [name, configure, verify] of cases) {
    test(name, () => {
        const input = fixture();
        configure(input);
        const actual = execute(source, input);
        verify(actual);
        if (baseline) assert.deepEqual(actual, execute(baseline, input), '原本と処理・ログ・例外・API呼び出し順が一致');
    });
}

test('Ccログの表記を統一', () => {
    assert.match(source, /context\.Log\(`Cc: \$\{recipients\.Cc\}`\)/);
    assert.doesNotMatch(source, /`CC:/);
});
