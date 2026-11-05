const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');

const source = fs.readFileSync(process.env.NOTIFICATION_SOURCE || path.join(__dirname, '../sk-realtime-notification.js'), 'utf8');
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
                // 分類項目の検索が効かず、別ルールの条件も返る状況を再現する。
                if (input.ignoreConditionRuleFilter && id === 843614 && view.ColumnFilterHash.ClassA !== undefined) {
                    return input.conditions;
                }
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
    }, r => { assert.ok(r.error); assert.equal(r.events.some(e => e[0]==='get' && e[2] && JSON.parse(e[2]).View.ColumnFilterHash.ClassA === '["11"]'), false); }],
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


function condition(operator, value, field = 'status', pattern = '1') {
    return { ClassC: field, ClassD: operator, DescriptionB: value, ClassB: pattern, ClassA: '10' };
}

function engine(model = {}) {
    const sandbox = { model, context: { Log() {} } };
    vm.createContext(sandbox);
    vm.runInContext(source, sandbox);
    return sandbox;
}

for (const [oldValue, newValue, expected] of [
    ['0100', '0200', true],
    ['0100', '0300', false],
    ['0150', '0200', false],
    ['0200', '0200', false]
]) {
    test(`FROM_TO: ${oldValue}→${newValue}`, () => {
        assert.equal(engine().evaluateCondition(condition('FROM_TO', '0100,0200'),
            { status: { oldValue, newValue } }), expected);
    });
}

test('FROM_TO: 比較値の空白を除去し先頭ゼロを保持', () => {
    const ss = engine({ ClassB: 'modelの値は使用しない' });
    const c = condition('FROM_TO', ' 0100 , 0200 ');
    assert.equal(ss.evaluateCondition(c, { status: { oldValue: '0100', newValue: '0200' } }), true);
    assert.equal(ss.evaluateCondition(c, { status: { oldValue: '100', newValue: '200' } }), false);
});

test('FROM_TO: 変更なしと同値の遷移は不成立', () => {
    const ss = engine();
    assert.equal(ss.evaluateCondition(condition('FROM_TO', '0100,0200'), {}), false);
    assert.equal(ss.evaluateCondition(condition('FROM_TO', '0200,0200'),
        { status: { oldValue: '0200', newValue: '0200' } }), false);
});

for (const value of ['', '0100', '0100,', ',0200', ' , ', '0100,0200,0300', '0100,,0200', '0100;0200', null, undefined]) {
    test(`FROM_TO: 不正な設定を検出 ${JSON.stringify(value)}`, () => {
        const c = condition('FROM_TO', value);
        const ss = engine();
        // 変更なしでも、設定値の不正を黙って不成立にしない。
        assert.throws(() => ss.evaluateCondition(c, {}), /FROM_TOの比較値が不正/);
        assert.throws(() => ss.evaluateConditions([c], {}), /FROM_TOの比較値が不正/);
    });
}

test('FROM_TOと電圧NEの同一パターンはAND', () => {
    const ss = engine({ ClassE: '100' });
    const changes = { status: { oldValue: '0100', newValue: '0200' } };
    const transition = condition('FROM_TO', '0100,0200');
    assert.equal(ss.evaluateConditions([transition, condition('NE', '200', 'denatsu')], changes), true);
    assert.equal(ss.evaluateConditions([transition, condition('NE', '100', 'denatsu')], changes), false);
    assert.equal(ss.evaluateConditions([transition, condition('NE', '200', 'denatsu')],
        { status: { oldValue: '0150', newValue: '0200' } }), false);
});

test('FROM_TOを含む異なるパターンはOR', () => {
    const ss = engine({ ClassE: '100' });
    const conditions = [condition('FROM_TO', '0100,0300'), condition('EQ', '100', 'denatsu', '2')];
    assert.equal(ss.evaluateConditions(conditions, { status: { oldValue: '0100', newValue: '0200' } }), true);
});

test('AND/ORの短絡評価でFROM_TO設定エラーを隠さない', () => {
    const ss = engine({ ClassE: '100' });
    assert.throws(() => ss.evaluateConditions([
        condition('EQ', '200', 'denatsu'), condition('FROM_TO', 'bad')
    ], {}), /FROM_TOの比較値が不正/);
    assert.throws(() => ss.evaluateConditions([
        condition('EQ', '100', 'denatsu'), condition('FROM_TO', 'bad', 'status', '2')
    ], {}), /FROM_TOの比較値が不正/);
});

for (const [name, extra, expected] of [
    ['単独トリガーから通知を準備', [], true],
    ['電圧NEが成立する場合に通知を準備', [condition('NE', '200', 'denatsu')], true],
    ['電圧NEが不成立なら通知しない', [condition('NE', '100', 'denatsu')], false]
]) {
    test(`FROM_TO: ${name}`, () => {
        const input = fixture();
        input.data = JSON.stringify({ changedFields: { status: { oldValue: '0100', newValue: '0200' } } });
        input.model.ClassB = '0200';
        input.conditions = [condition('FROM_TO', '0100,0200'), ...extra];
        const result = execute(source, input);
        assert.equal(result.error, undefined);
        assert.equal(hasMessage(result), expected);
        assert.ok(logs(result).includes('通知候補ルールID: ["10"]'));
    });
}


function mixedRuleFixture() {
    const input = fixture();
    input.ignoreConditionRuleFilter = true;
    input.data = JSON.stringify({ changedFields: { status: { oldValue: '0000', newValue: '0100' } } });
    input.model.ClassB = '0100';
    input.model.ClassE = '60kV';
    input.rules[0].Title = 'N001';
    input.rules.push({ ...input.rules[0], ResultId: 11, Title: 'N999' });
    input.conditions = [
        { ...condition('FROM_TO', '0000,0100'), ClassA: '10' },
        { ...condition('NE', '6kV', 'denatsu'), ClassA: '10' },
        { ...condition('NE', '20kV', 'denatsu'), ClassA: '10' },
        { ...condition('TO', '0220'), ClassA: '11' },
        { ...condition('EQ', '6kV', 'denatsu'), ClassA: '11' },
        { ...condition('TO', '0300', 'status', '2'), ClassA: '11' }
    ];
    return input;
}

test('別通知IDで同じパターン1を使ってもN001だけ成立する', () => {
    const result = execute(source, mixedRuleFixture());
    assert.equal(result.error, undefined);
    assert.ok(logs(result).includes('通知ID: N001, 条件成立: true'));
    assert.ok(logs(result).includes('通知ID: N999, 条件成立: false'));
    assert.equal(logs(result).filter(value => value === '通知条件の取得件数: 3').length, 2);
    assert.equal(logs(result).filter(value => value.startsWith('件名:')).length, 1);
});

test('別通知IDの条件で自ルールを誤って成立させない', () => {
    const input = mixedRuleFixture();
    input.conditions[0].DescriptionB = '0000,9999';
    input.conditions[3].DescriptionB = '0100';
    input.conditions[4].DescriptionB = '60kV';
    const result = execute(source, input);
    assert.ok(logs(result).includes('通知ID: N001, 条件成立: false'));
    assert.ok(logs(result).includes('通知ID: N999, 条件成立: true'));
});

test('別通知IDの不正なFROM_TOを自ルールの評価に含めない', () => {
    const input = mixedRuleFixture();
    // N999自体は評価しない。N001に無関係な条件が返ってきても設定例外にしない。
    input.rules = [input.rules[0]];
    input.conditions[3] = { ...condition('FROM_TO', 'bad'), ClassA: '11' };
    const result = execute(source, input);
    assert.equal(result.error, undefined);
    assert.ok(logs(result).includes('通知ID: N001, 条件成立: true'));
});

test('条件検索は親IDを配列として指定し、取得後も完全一致で絞り込む', () => {
    let requested;
    const sandbox = {
        items: { Get(id, data) {
            requested = JSON.parse(data).View;
            return [{ClassA:'10'}, {ClassA:10}, {ClassA:'11'}, {ClassA:'100'}, {}, {ClassA:''}];
        } }
    };
    vm.createContext(sandbox);
    vm.runInContext(source, sandbox);
    const rows = sandbox.getNotificationConditions(10);
    assert.equal(requested.ColumnFilterHash.ClassA, '["10"]');
    assert.equal(requested.ColumnFilterSearchTypes.ClassA, 'ExactMatchMultiple');
    assert.equal(rows.length, 2);
    assert.ok(rows.every(row => String(row.ClassA) === '10'));
});
