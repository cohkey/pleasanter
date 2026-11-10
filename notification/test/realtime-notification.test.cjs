/**
 * 変更履歴
 * 2026/11/10
 * ・固定組織の許可4コードと店所連動の宛先名を確認
 * ・送信モード・表示名・複数対象・失敗時メッセージを確認
 * 2026/11/09
 * ・通知対象の3区分、GMの店所分離・NumA・Group宛先、固定組織と区分設定を検証
 * ・通常時とデバッグ時のログ、集計、評価回数・順序の不変を確認
 * 2026/11/06
 * ・サービスグループ展開、同店所の完全一致、直接指定と組織コード重複排除を確認
 * ・通常ログに空行や区切り線前の改行を含めないことを確認
 * ・通知IDごとのログ表示と、ログ以外の処理が変わらないことの確認を追加
 */

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
        targets: [{ ClassA: '10', ClassB: 'G1', ClassC: 'To', ClassD: 'ORGANIZATION' }],
        organizations: [{ ClassA: '001', ClassC: 'G1', DescriptionA: 'ORG1' }],
        mail: [{ DescriptionB: 'ORG1', ClassZ: '["1"]', DescriptionA: 'test@example.invalid' }],
        sendEnabled: false,
        sendResult: true
    };
}

function execute(code, input) {
    const events = [];
    const notification = { Send() { events.push(['send', { ...this, Send: undefined }]); if (input.sendThrows) throw new Error('送信API例外'); return input.sendResult; } };
    const sandbox = {
        model: input.model,
        context: {
            UserData: { notificationData: input.data },
            Log(value) { events.push(['log', String(value).replace(/^CC:/, 'Cc:')]); },
            AddMessage(...args) { events.push(['message', ...args]); }
        },
        notifications: { New() { events.push(['newNotification']); return notification; } },
        items: {
            GetSite(id) {
                events.push(['getSite', id]);
                if (input.labelLookupError) throw new Error('表示名の取得エラー');
                return input.noTargetSite ? [] : [{ SiteSettings: { Columns: [{
                    ColumnName: 'ClassB', ChoicesText: input.targetChoices ?? 'G1,検証グループ\nG2,別グループ'
                }] } }];
            },
            Get(id, query) {
                events.push(['get', id, query]);
                const tables = { 843614: input.conditions, 843620: input.targets,
                    846822: input.organizations, 809267: input.mail, 727689: input.gmMappings };
                if (!query) return input.rules.filter(rule => rule.ResultId === id);
                const view = JSON.parse(query).View;
                if (id === 727689 && input.ignoreGmFilter) return input.gmMappings;
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
        let executable = input.sendEnabled
            ? code.replace('const SEND_ENABLED = false;', 'const SEND_ENABLED = true;')
            : code;
        const mode = Object.prototype.hasOwnProperty.call(input, 'sendMode') ? input.sendMode : (input.sendEnabled ? 'PRODUCTION' : 'TEST');
        executable = executable.replace('const NOTIFICATION_SEND_MODE = "TEST";', 'const NOTIFICATION_SEND_MODE = ' + JSON.stringify(mode) + ';');
        if (input.debugEnabled) executable = executable.replace('const NOTIFICATION_DEBUG = false;', 'const NOTIFICATION_DEBUG = true;');
        if (input.fixedOrganizationCodes) executable = executable.replace(/const FIXED_ORGANIZATION_CODES = \[[\s\S]*?\];/,
            'const FIXED_ORGANIZATION_CODES = ' + JSON.stringify(input.fixedOrganizationCodes) + ';');
        vm.runInContext(executable, sandbox);
        if (input.trackEvaluation) {
            const original = sandbox.evaluateCondition;
            sandbox.evaluateCondition = function(c, f) {
                events.push(['evaluate', c.ClassA, c.ClassB, c.ClassC, c.ClassD]);
                return original(c, f);
            };
        }
        sandbox.sendRealtimeNotification();
    } catch (e) { error = e.message; }
    return JSON.parse(JSON.stringify({ events, error }));
}

function logs(result) { return result.events.filter(e => e[0] === 'log').map(e => e[1]); }
function hasMessage(result) { return logs(result).some(value => value.startsWith('件名:')); }
function ruleLogs(result, ruleId) {
    const lines = logs(result);
    const prefix = `----- 通知ID: ${ruleId}`;
    const start = lines.findIndex(line => line.trim() === `${prefix} -----` || line.trim().startsWith(`${prefix}（`));
    if (start < 0) return [];
    const next = lines.findIndex((line, index) => index > start && line.trim().startsWith('----- 通知ID:'));
    return lines.slice(start, next < 0 ? undefined : next);
}
function businessResult(result) {
    return { ...result, events: result.events.filter(event => !['log', 'message', 'getSite'].includes(event[0])) };
}

const cases = [
    ['引き継ぎ情報なし', f => { f.data = undefined; }, r => assert.equal(businessResult(r).events.length, 0)],
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
        for (const kind of ['Cc','Bcc']) f.targets.push({ClassA:'10',ClassB:'G1',ClassC:kind,ClassD:'ORGANIZATION'});
    }, r => { assert.ok(logs(r).includes('Cc: ')); assert.ok(logs(r).includes('Bcc: ')); }],
    ['独立したCc宛先', f => {
        f.targets.push({ClassA:'10',ClassB:'G2',ClassC:'Cc',ClassD:'ORGANIZATION'});
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
        input.trackEvaluation = true;
        const actual = execute(source, input);
        verify(actual);
        if (baseline) {
            const previous = execute(baseline, input);
            assert.deepEqual(businessResult(actual), businessResult(previous), '変更前と業務処理・例外・API呼び出し順が一致（表示ログを除く）');

        }
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
        assert.ok(logs(result).some(line => line.includes('候補1件')));
    });
}


function mixedRuleFixture() {
    const input = fixture();
    input.debugEnabled = true;
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
    assert.ok(ruleLogs(result, 'N001').includes('条件成立: true'));
    assert.ok(ruleLogs(result, 'N999').includes('条件成立: false'));
    assert.equal(logs(result).filter(value => value === '通知条件: 3件').length, 2);
    assert.equal(logs(result).filter(value => value.startsWith('件名:')).length, 1);
});

test('別通知IDの条件で自ルールを誤って成立させない', () => {
    const input = mixedRuleFixture();
    input.conditions[0].DescriptionB = '0000,9999';
    input.conditions[3].DescriptionB = '0100';
    input.conditions[4].DescriptionB = '60kV';
    const result = execute(source, input);
    assert.ok(ruleLogs(result, 'N001').includes('条件成立: false'));
    assert.ok(ruleLogs(result, 'N999').includes('条件成立: true'));
});

test('別通知IDの不正なFROM_TOを自ルールの評価に含めない', () => {
    const input = mixedRuleFixture();
    // N999自体は評価しない。N001に無関係な条件が返ってきても設定例外にしない。
    input.rules = [input.rules[0]];
    input.conditions[3] = { ...condition('FROM_TO', 'bad'), ClassA: '11' };
    const result = execute(source, input);
    assert.equal(result.error, undefined);
    assert.ok(ruleLogs(result, 'N001').includes('条件成立: true'));
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

for (const operator of ['IN', 'NOT_IN']) {
    for (const [target, comparison, included] of [
        ['6kV', '6kV,20kV', true],
        ['20kV', '6kV,20kV', true],
        ['60kV', '6kV,20kV', false],
        ['6', '6kV,20kV', false],
        ['6kv', '6kV,20kV', false],
        ['6kV ', '6kV,20kV', false],
        ['', '6kV,20kV', false],
        [null, '6kV,20kV', false],
        [undefined, '6kV,20kV', false],
        ['6kV', ' 6kV , 20kV ', true],
        ['0100', '0100,0200', true],
        ['100', '0100,0200', false],
        [100, '100,200', true],
        ['35kV', '6kV,20kV,35kV', true],
        ['6kV', '6kV,6kV', true]
    ]) {
        test(`${operator}: ${JSON.stringify(target)} / ${comparison}`, () => {
            assert.equal(engine({ ClassE: target }).evaluateCondition(
                condition(operator, comparison, 'denatsu'), {}
            ), operator === 'IN' ? included : !included);
        });
    }

    for (const value of [undefined, null, '', ' ', '6kV', ' 6kV ', ',', '6kV, ', ',20kV', '6kV,,20kV', '6kV,20kV,', '6kV;20kV']) {
        test(`${operator}: 設定エラー ${JSON.stringify(value)}`, () => {
            const c = condition(operator, value, 'denatsu');
            const ss = engine({ ClassE: '' });
            const error = new RegExp(`${operator}の比較値が不正`);
            assert.throws(() => ss.evaluateCondition(c, {}), error);
            assert.throws(() => ss.evaluateConditions([c], {}), error);
        });
    }

    test(`${operator}: AND/ORの短絡評価で設定エラーを隠さない`, () => {
        const ss = engine({ ClassE: '60kV' });
        assert.throws(() => ss.evaluateConditions([
            condition('EQ', '6kV', 'denatsu'), condition(operator, 'invalid', 'denatsu')
        ], {}), new RegExp(`${operator}の比較値が不正`));
        assert.throws(() => ss.evaluateConditions([
            condition('EQ', '60kV', 'denatsu'), condition(operator, 'invalid', 'denatsu', '2')
        ], {}), new RegExp(`${operator}の比較値が不正`));
    });

    test(`${operator}: 単独では通知トリガーにしない`, () => {
        const input = fixture();
        input.data = JSON.stringify({ changedFields: { denatsu: { oldValue: '6kV', newValue: '20kV' } } });
        input.model.ClassE = '20kV';
        input.conditions = [condition(operator, '6kV,20kV', 'denatsu')];
        const result = execute(source, input);
        assert.equal(result.error, undefined);
        assert.equal(hasMessage(result), false);
        assert.equal(result.events.some(e => e[0] === 'get' && e[1] === 10), false);
    });

    for (const target of ['6kV', '60kV', '']) {
        test(`${operator}: FROM_TOとのAND / 電圧${JSON.stringify(target)}`, () => {
            const input = mixedRuleFixture();
            input.rules = [input.rules[0]];
            input.model.ClassE = target;
            input.conditions = [condition('FROM_TO', '0000,0100'), condition(operator, '6kV,20kV', 'denatsu')];
            const result = execute(source, input);
            assert.equal(result.error, undefined);
            assert.equal(hasMessage(result), operator === 'IN' ? target === '6kV' : target !== '6kV');
        });
    }

    test(`${operator}: 異なるパターンとのORを維持`, () => {
        const ss = engine({ ClassE: '60kV' });
        const comparison = operator === 'IN' ? '6kV,20kV' : '60kV,20kV';
        assert.equal(ss.evaluateConditions([
            condition(operator, comparison, 'denatsu'), condition('EQ', '60kV', 'denatsu', '2')
        ], {}), true);
    });

    test(`${operator}: 別ルールの不正な比較値を評価しない`, () => {
        const input = mixedRuleFixture();
        input.rules = [input.rules[0]];
        input.conditions[3] = { ...condition(operator, 'invalid', 'denatsu'), ClassA: '11' };
        const result = execute(source, input);
        assert.equal(result.error, undefined);
        assert.ok(ruleLogs(result, 'N001').includes('条件成立: true'));
    });
}


function sampleLogFixture() {
    const input = mixedRuleFixture();
    input.model.ClassE = '6kV';
    input.rules[0].DescriptionA = '';
    input.rules[1].DescriptionA = 'テスト1';
    input.rules.unshift({ ...input.rules[0], ResultId: 12, Title: 'N002' });
    input.conditions = [
        { ...condition('IN', '6kV,20kV', 'denatsu'), ClassA: '12' },
        { ...condition('FROM_TO', '0000,0100'), ClassA: '12' },
        { ...condition('NOT_IN', '6kV,20kV', 'denatsu'), ClassA: '10' },
        { ...condition('FROM_TO', '0000,0100'), ClassA: '10' },
        { ...condition('EQ', '6kV', 'denatsu'), ClassA: '11' },
        { ...condition('TO', '0220'), ClassA: '11' },
        { ...condition('TO', '0300', 'status', '2'), ClassA: '11' }
    ];
    return input;
}

test('デバッグ時は画像の3ルールを従来の条件一覧・既存JSONで表示', () => {
    const input = sampleLogFixture();
    const result = execute(source, input);
    assert.equal(result.error, undefined);
    const lines = logs(result).filter(line => line.trim() !== '').map(line => line.trimStart());
    assert.deepEqual(lines, [
        'changedFields: {"status":{"oldValue":"0000","newValue":"0100"}}',
        '通知候補: N002, N001, N999',
        '----- 通知ID: N002 -----',
        '通知条件: 2件',
        'パターン1 / denatsu / IN / 比較値: 6kV,20kV',
        'パターン1 / status / FROM_TO / 比較値: 0000,0100',
        '{"field":"denatsu","operator":"IN","value":"6kV,20kV","columnName":"ClassE","modelValue":"6kV","hasChange":false}',
        '{"field":"status","operator":"FROM_TO","value":"0000,0100","columnName":"ClassB","modelValue":"0100","changedValue":"0100","hasChange":true}',
        '条件成立: true',
        '通知対象が未設定のためスキップ',
        '----- 通知ID: N001 -----',
        '通知条件: 2件',
        'パターン1 / denatsu / NOT_IN / 比較値: 6kV,20kV',
        'パターン1 / status / FROM_TO / 比較値: 0000,0100',
        '{"field":"denatsu","operator":"NOT_IN","value":"6kV,20kV","columnName":"ClassE","modelValue":"6kV","hasChange":false}',
        '条件成立: false',
        '----- 通知ID: N999（テスト1） -----',
        '通知条件: 3件',
        'パターン1 / denatsu / EQ / 比較値: 6kV',
        'パターン1 / status / TO / 比較値: 0220',
        'パターン2 / status / TO / 比較値: 0300',
        '{"field":"denatsu","operator":"EQ","value":"6kV","columnName":"ClassE","modelValue":"6kV","hasChange":false}',
        '{"field":"status","operator":"TO","value":"0220","columnName":"ClassB","modelValue":"0100","changedValue":"0100","hasChange":true}',
        '{"field":"status","operator":"TO","value":"0300","columnName":"ClassB","modelValue":"0100","changedValue":"0100","hasChange":true}',
        '条件成立: false',
        '----- 通知処理終了: 候補3件 / 成立1件 / 不成立2件 -----'
    ]);
    if (baseline) {
        const previous = execute(baseline, input);
        assert.deepEqual(businessResult(result), businessResult(previous));
        assert.deepEqual(logs(result).filter(line => line.startsWith('{')), logs(previous).filter(line => line.startsWith('{')));
    }
});

test('重複・内部処理だけのログを出さず、最終宛先と内容を残す', () => {
    const result = execute(source, fixture());
    const lines = logs(result);
    assert.ok(lines.includes('To: [User1],test@example.invalid'));
    assert.ok(lines.includes('件名: 通知 検証'));
    assert.ok(lines.includes('本文: 001/完了/200'));
    assert.ok(lines.includes('組織: ORG1 / 宛先区分: To / メール通知設定: 1件'));
    assert.ok(!lines.some(line => /records\.length|records\[0\]|record\.ClassD|メールアドレス:/.test(line)));
});

test('正常終了では終了行が1回、例外時には完了したように表示しない', () => {
    const normal = execute(source, fixture());
    assert.equal(logs(normal).filter(line => line.trim() === '----- 通知処理終了: 候補1件 / 成立1件 / 不成立0件 -----').length, 1);
    const input = fixture();
    input.mail[0].DescriptionA = 'invalid';
    const failed = execute(source, input);
    assert.equal(failed.error, 'メールアドレスの形式が不正です。');
    assert.ok(logs(failed).includes('不正なメールアドレス: "invalid"'));
    assert.ok(!logs(failed).some(line => line.includes('通知処理終了')));
});


test('通常ログに空行や区切り線前の改行を出さない', () => {
    for (const input of [fixture(), mixedRuleFixture(), sampleLogFixture()]) {
        const result = execute(source, input);
        assert.equal(result.error, undefined);
        for (const line of logs(result)) {
            assert.notEqual(line.trim(), '', '空のログを出さない');
            assert.ok(!line.startsWith('\n') && !line.startsWith('\r'), '区切り前に改行を付けない');
        }
    }
});

test('組織検索は分類の両項目を配列で絞り、200件より後の一致レコードも取得する', () => {
    const rows = Array.from({ length: 200 }, () => ({ ClassA: '999999', ClassC: 'その他', DescriptionA: 'OTHER' }));
    rows.push({ ClassA: '216485', ClassC: 'グリッドサービスG', DescriptionA: 'ORG_PAGE' });
    let requested;
    const sandbox = {
        context: { Log() {} },
        items: { Get(id, query) {
            requested = JSON.parse(query).View;
            // 選択式分類に単一文字列を渡すと検索が適用されず、先頭200件が返る状況。
            if (requested.ColumnFilterSearchTypes.ClassA !== 'ExactMatchMultiple' ||
                requested.ColumnFilterSearchTypes.ClassC !== 'ExactMatchMultiple') return rows.slice(0, 200);
            return rows.filter(row => JSON.parse(requested.ColumnFilterHash.ClassA).includes(row.ClassA) &&
                JSON.parse(requested.ColumnFilterHash.ClassC).includes(row.ClassC)).slice(0, 200);
        } }
    };
    vm.createContext(sandbox);
    vm.runInContext(source, sandbox);
    assert.equal(JSON.stringify(sandbox.getOrganizationCodes('216485', 'グリッドサービスG')), '["ORG_PAGE"]');
    assert.equal(requested.ColumnFilterHash.ClassA, '["216485"]');
    assert.equal(requested.ColumnFilterHash.ClassC, '["グリッドサービスG"]');
});

test('組織検索の取得後にも店所とグループを完全一致で再確認する', () => {
    const sandbox = {
        context: { Log() {} },
        items: { Get() { return [
            { ClassA: '216485', ClassC: 'グリッドサービスG', DescriptionA: 'ORG1' },
            { ClassA: 216485, ClassC: 'グリッドサービスG', DescriptionA: 'ORG2' },
            { ClassA: '2164850', ClassC: 'グリッドサービスG', DescriptionA: 'WRONG_STORE' },
            { ClassA: '216485', ClassC: 'その他', DescriptionA: 'WRONG_GROUP' }
        ]; } }
    };
    vm.createContext(sandbox);
    vm.runInContext(source, sandbox);
    assert.equal(JSON.stringify(sandbox.getOrganizationCodes('216485', 'グリッドサービスG')), '["ORG1","ORG2"]');
});

test('組織なしのログで検索0件・照合不一致・組織コード空を区別できる', () => {
    for (const [rows, expected] of [
        [[], '組織検索: 取得0件 / 条件一致0件 / 組織コードあり0件'],
        [[{ ClassA: '216485', ClassC: 'その他', DescriptionA: 'ORG' }], '組織検索: 取得1件 / 条件一致0件 / 組織コードあり0件'],
        [[{ ClassA: '216485', ClassC: 'グリッドサービスG', DescriptionA: '' }], '組織検索: 取得1件 / 条件一致1件 / 組織コードあり0件']
    ]) {
        const lines = [];
        const sandbox = { context: { Log(value) { lines.push(value); } }, items: { Get() { return rows; } } };
        vm.createContext(sandbox);
        vm.runInContext(source, sandbox);
        assert.equal(sandbox.getOrganizationCodes('216485', 'グリッドサービスG').length, 0);
        assert.deepEqual(lines, [expected]);
    }
});


test('通知対象の親ID分類検索も先頭200件からの取りこぼしを防ぐ', () => {
    const rows = Array.from({ length: 200 }, () => ({ ClassA: '999', ClassB: 'その他', ClassC: 'To' }));
    rows.push({ ClassA: '12', ClassB: 'グリッドサービスG', ClassC: 'To' });
    const sandbox = {
        items: { Get(id, query) {
            const view = JSON.parse(query).View;
            if (view.ColumnFilterSearchTypes.ClassA !== 'ExactMatchMultiple') return rows.slice(0, 200);
            assert.equal(view.ColumnFilterHash.ClassA, '["12"]');
            return rows.filter(row => JSON.parse(view.ColumnFilterHash.ClassA).includes(row.ClassA)).slice(0, 200);
        } }
    };
    vm.createContext(sandbox);
    vm.runInContext(source, sandbox);
    assert.equal(JSON.stringify(sandbox.getNotificationTargets(12)), '[{"group":"グリッドサービスG","addressType":"To","targetType":""}]');
});

const serviceGroups = [
    'お客さまサービスグループ',
    'お客さまサービス第一グループ',
    'お客さまサービス第二グループ',
    'お客さまサービス第三グループ'
];
const serviceGroupOrganizations = [
    { ClassA: '216485', ClassC: serviceGroups[0], DescriptionA: 'NORMAL' },
    { ClassA: '216485', ClassC: 'グリッドサービスG', DescriptionA: 'GRID' },
    { ClassA: '216486', ClassC: serviceGroups[1], DescriptionA: 'SPECIAL_1' },
    { ClassA: '216486', ClassC: serviceGroups[2], DescriptionA: 'SHARED' },
    { ClassA: '216486', ClassC: serviceGroups[3], DescriptionA: 'SHARED' },
    { ClassA: '216486', ClassC: 'お客さまサービス第四グループ', DescriptionA: 'FOURTH' },
    { ClassA: '216486', ClassC: 'お客さまサービスグループ補助', DescriptionA: 'SUFFIX' },
    { ClassA: '216486', ClassC: 'お客さまサービス第一グループ補助', DescriptionA: 'FIRST_SUFFIX' },
    { ClassA: '2164860', ClassC: serviceGroups[1], DescriptionA: 'SIMILAR_STORE' },
    { ClassA: '216487', ClassC: serviceGroups[2], DescriptionA: 'ONLY_SECOND' },
    { ClassA: '216488', ClassC: serviceGroups[0], DescriptionA: 'BASE' },
    { ClassA: '216488', ClassC: serviceGroups[1], DescriptionA: 'BRANCH' },
    { ClassA: '216488', ClassC: serviceGroups[3], DescriptionA: '' }
];

function searchServiceGroups(store, group, ignoreFilters = false) {
    let view;
    const sandbox = {
        context: { Log() {} },
        items: { Get(id, query) {
            assert.equal(id, 846822);
            view = JSON.parse(query).View;
            if (ignoreFilters) return serviceGroupOrganizations;
            return serviceGroupOrganizations.filter(row =>
                JSON.parse(view.ColumnFilterHash.ClassA).includes(row.ClassA) &&
                JSON.parse(view.ColumnFilterHash.ClassC).includes(row.ClassC)
            );
        } }
    };
    vm.createContext(sandbox);
    vm.runInContext(source, sandbox);
    const codes = JSON.parse(JSON.stringify(sandbox.getOrganizationCodes(store, group)));
    return { codes, view };
}

for (const [name, store, group, expected] of [
    ['通常店所は存在する親グループだけ', '216485', serviceGroups[0], ['NORMAL']],
    ['特殊店所は第一・第二・第三を検索して重複排除', '216486', serviceGroups[0], ['SPECIAL_1', 'SHARED']],
    ['一部分だけ存在する店所', '216487', serviceGroups[0], ['ONLY_SECOND']],
    ['親と分割グループが共存する店所', '216488', serviceGroups[0], ['BASE', 'BRANCH']],
    ['存在しない店所は他店所へ広げない', 'MISSING', serviceGroups[0], []],
    ['第一を直接指定したら第一だけ', '216486', serviceGroups[1], ['SPECIAL_1']],
    ['第二を直接指定したら第二だけ', '216486', serviceGroups[2], ['SHARED']],
    ['第三を直接指定したら第三だけ', '216486', serviceGroups[3], ['SHARED']],
    ['別グループの検索は変えない', '216485', 'グリッドサービスG', ['GRID']],
    ['第四を直接指定する既存検索も変えない', '216486', 'お客さまサービス第四グループ', ['FOURTH']]
]) {
    test(`サービスグループ展開: ${name}`, () => {
        assert.deepEqual(searchServiceGroups(store, group).codes, expected);
    });
}

test('サービスグループ展開: 店所は単一の完全一致、グループは明示した4値だけ', () => {
    const { view } = searchServiceGroups('216486', serviceGroups[0]);
    assert.deepEqual(JSON.parse(view.ColumnFilterHash.ClassA), ['216486']);
    assert.deepEqual(JSON.parse(view.ColumnFilterHash.ClassC), serviceGroups);
    assert.equal(view.ColumnFilterSearchTypes.ClassA, 'ExactMatchMultiple');
    assert.equal(view.ColumnFilterSearchTypes.ClassC, 'ExactMatchMultiple');
});

test('サービスグループ展開: 余分な検索結果でも他店所・類似名は取り込まない', () => {
    assert.deepEqual(searchServiceGroups('216486', serviceGroups[0], true).codes, ['SPECIAL_1', 'SHARED']);
    assert.deepEqual(searchServiceGroups('216486', serviceGroups[1], true).codes, ['SPECIAL_1']);
});

test('サービスグループ展開: 対応表にないObjectのプロパティ名も通常の完全一致で扱う', () => {
    const { codes, view } = searchServiceGroups('216486', 'constructor');
    assert.deepEqual(codes, []);
    assert.deepEqual(JSON.parse(view.ColumnFilterHash.ClassC), ['constructor']);
});

test('サービスグループ展開: 複数組織からToを作り、同じ組織への照会は1回', () => {
    const input = fixture();
    input.targets[0].ClassB = serviceGroups[0];
    input.model.ClassD = '216486';
    input.organizations = serviceGroupOrganizations;
    input.mail = [
        { DescriptionB: 'SPECIAL_1', ClassZ: '["1"]', DescriptionA: 'one@example.invalid' },
        { DescriptionB: 'SHARED', ClassZ: '[]', DescriptionA: 'two@example.invalid' },
        { DescriptionB: 'NORMAL', ClassZ: '[]', DescriptionA: 'other-store@example.invalid' }
    ];
    const result = execute(source, input);
    assert.equal(result.error, undefined);
    assert.ok(logs(result).includes('To: [User1],one@example.invalid,two@example.invalid'));
    assert.equal(result.events.filter(e => e[0] === 'get' && e[1] === 809267 &&
        JSON.parse(e[2]).View.ColumnFilterHash.DescriptionB === 'SHARED').length, 1);
    assert.ok(!logs(result).some(line => line.includes('other-store@example.invalid')));
});

function summary(result) {
    return logs(result).filter(line => /^----- 通知処理(終了|中断):/.test(line));
}

test('通常時は成立したN002だけ詳細を表示し、不成立2件は集計だけにする', () => {
    const input = sampleLogFixture();
    input.debugEnabled = false;
    const result = execute(source, input);
    assert.equal(result.error, undefined);
    assert.deepEqual(logs(result).filter(line => line.startsWith('----- 通知ID:')), ['----- 通知ID: N002 -----']);
    assert.equal(logs(result).filter(line => line.startsWith('{')).length, 2);
    assert.ok(!logs(result).some(line => /NOT_IN|条件成立: false|changedFields:|通知候補:/.test(line)));
    assert.deepEqual(summary(result), ['----- 通知処理終了: 候補3件 / 成立1件 / 不成立2件 -----']);
});

for (const debugEnabled of [false, true]) {
    test(`評価回数・順序・短絡評価・業務APIは変更前と同じ（debug=${debugEnabled}）`, () => {
        for (const configure of [() => {}, f => { f.model.ClassE = '100kV'; }, f => { f.conditions[1].DescriptionB = '0000,9999'; }]) {
            const input = sampleLogFixture();
            input.debugEnabled = debugEnabled;
            input.trackEvaluation = true;
            configure(input);
            const result = execute(source, input);
            const other = execute(source, { ...input, debugEnabled: !debugEnabled });
            assert.deepEqual(businessResult(result), businessResult(other));
            if (baseline) assert.deepEqual(businessResult(result), businessResult(execute(baseline, input)));
        }
        const input = sampleLogFixture();
        input.debugEnabled = debugEnabled;
        input.trackEvaluation = true;
        assert.deepEqual(execute(source, input).events.filter(e => e[0] === 'evaluate'), [
            ['evaluate', '12', '1', 'denatsu', 'IN'], ['evaluate', '12', '1', 'status', 'FROM_TO'],
            ['evaluate', '10', '1', 'denatsu', 'NOT_IN'], ['evaluate', '11', '1', 'denatsu', 'EQ'],
            ['evaluate', '11', '1', 'status', 'TO'], ['evaluate', '11', '2', 'status', 'TO']
        ]);
    });

    test(`条件設定エラーは詳細・エラー・未完了数を残す（debug=${debugEnabled}）`, () => {
        const input = sampleLogFixture();
        input.debugEnabled = debugEnabled;
        input.conditions[1].DescriptionB = 'bad';
        const result = execute(source, input);
        assert.match(result.error, /FROM_TOの比較値が不正/);
        assert.ok(logs(result).includes('----- 通知ID: N002 -----'));
        assert.ok(logs(result).some(line => line.startsWith('通知処理エラー:')));
        assert.deepEqual(summary(result), ['----- 通知処理中断: 候補3件 / 成立0件 / 不成立0件 / 未完了3件 -----']);
    });

    test(`宛先エラーでも成立数を送信成功数にしない（debug=${debugEnabled}）`, () => {
        const input = fixture();
        input.debugEnabled = debugEnabled;
        input.organizations = [];
        const result = execute(source, input);
        assert.equal(result.error, 'Toの通知先がありません');
        assert.ok(logs(result).includes('通知処理エラー: Toの通知先がありません'));
        assert.deepEqual(summary(result), ['----- 通知処理中断: 候補1件 / 成立1件 / 不成立0件 / 未完了0件 -----']);
    });
}

test('全件不成立では詳細を出さず0成立を表示する', () => {
    const input = sampleLogFixture();
    input.debugEnabled = false;
    input.conditions[1].DescriptionB = '0000,9999';
    const result = execute(source, input);
    assert.deepEqual(logs(result), ['----- 通知処理終了: 候補3件 / 成立0件 / 不成立3件 -----']);
});

test('引継ぎなし・変更なし・候補なしでも0件の集計を出す', () => {
    for (const configure of [f => { f.data = undefined; }, f => { f.data = '{"changedFields":{}}'; }, f => { f.conditions = []; }]) {
        const input = fixture();
        configure(input);
        assert.deepEqual(logs(execute(source, input)), ['----- 通知処理終了: 候補0件 / 成立0件 / 不成立0件 -----']);
    }
});

test('無効・リンク切れルールは集計候補に含めず、リンク切れの警告は常時出す', () => {
    const input = mixedRuleFixture();
    input.debugEnabled = false;
    input.rules[0].CheckA = false;
    input.rules.pop();
    const result = execute(source, input);
    assert.ok(logs(result).includes('通知ルールが見つかりません: 11'));
    assert.deepEqual(summary(result), ['----- 通知処理終了: 候補0件 / 成立0件 / 不成立0件 -----']);
});

test('TESTは未送信と明示し、受付表示だけを行う', () => {
    const result = execute(source, fixture());
    assert.ok(logs(result).includes('TESTモードのため実際のメールは送信していません'));
    assert.ok(!logs(result).some(line => /送信成功|送信しました/.test(line)));
    assert.ok(!result.events.some(e => ['newNotification', 'send'].includes(e[0])));
});

test('不成立ログが後続の成立ルールに混入しない', () => {
    const input = mixedRuleFixture();
    input.debugEnabled = false;
    input.conditions[0].DescriptionB = '0000,9999';
    input.conditions[3].DescriptionB = '0100';
    input.conditions[4].DescriptionB = '60kV';
    const result = execute(source, input);
    assert.ok(logs(result).some(line => line.startsWith('----- 通知ID: N999')));
    assert.ok(!logs(result).some(line => /通知ID: N001|FROM_TO|比較値: 20kV/.test(line)));
});

test('条件評価の例外を同じオブジェクトで再送出し、ログバッファを復元する', () => {
    const sandbox = engine();
    sandbox.context.UserData = { notificationData: '{"changedFields":{"status":{}}}' };
    const recorded = [];
    sandbox.context.Log = message => recorded.push(message);
    const original = new Error('評価例外');
    sandbox.getCandidateNotificationRules = () => [{ ResultId: 10, Title: 'ERR' }];
    sandbox.getNotificationConditions = () => [condition('TO', '0100')];
    sandbox.evaluateConditions = () => { throw original; };
    assert.throws(() => sandbox.sendRealtimeNotification(), e => e === original);
    assert.equal(vm.runInContext('notificationConditionLogBuffer', sandbox), null);
    assert.ok(recorded.includes('通知処理エラー: 評価例外'));
});

function gmFixture() {
    const input = fixture();
    input.model.ClassD = '216485';
    input.targets = [{ ClassA: '10', ClassB: '客サGM', ClassC: 'To', ClassD: 'GM' }];
    input.gmMappings = [
        { ClassA: '216485', ClassC: '客サ', NumA: 101, DescriptionA: 'GM001', ClassD: '通常客サGM' },
        { ClassA: '216485', ClassC: 'グリサ', NumA: 102, DescriptionA: 'GM002' },
        { ClassA: '216486', ClassC: '客サ', NumA: 201, DescriptionA: 'GM011', ClassD: '客サ第一GM' },
        { ClassA: '216486', ClassC: '客サ', NumA: 202, DescriptionA: 'GM012', ClassD: '客サ第二GM' },
        { ClassA: '216486', ClassC: '客サ', NumA: 203, DescriptionA: 'GM013', ClassD: '客サ第三GM' },
        { ClassA: '2164860', ClassC: '客サ', NumA: 999, DescriptionA: 'GM099' },
        { ClassA: '216486', ClassC: '客サ補助', NumA: 998, DescriptionA: 'GM098' }
    ];
    return input;
}

for (const [name, store, group, expected] of [
    ['通常店所の客サは1件', '216485', '客サGM', '[Group101]'],
    ['特殊店所の客サは第一〜第三', '216486', '客サGM', '[Group201],[Group202],[Group203]'],
    ['グリサは完全一致の1件', '216485', 'グリサGM', '[Group102]']
]) {
    test(`GM: ${name}`, () => {
        const input = gmFixture();
        input.model.ClassD = store;
        input.targets[0].ClassB = group;
        const result = execute(source, input);
        assert.equal(result.error, undefined);
        assert.ok(logs(result).includes(`To: ${expected}`));
        assert.ok(!result.events.some(e => e[0] === 'get' && [846822, 809267].includes(e[1])), '組織表・メール通知設定を参照しない');
        const request = result.events.find(e => e[0] === 'get' && e[1] === 727689);
        const view = JSON.parse(request[2]).View;
        assert.equal(view.ColumnFilterHash.ClassA, JSON.stringify([store]));
        assert.equal(view.ColumnFilterHash.ClassC, JSON.stringify([group === '客サGM' ? '客サ' : 'グリサ']));
        assert.deepEqual(view.ColumnFilterSearchTypes, { ClassA: 'ExactMatchMultiple', ClassC: 'ExactMatchMultiple' });
    });
}

test('GM: 検索フィルタが効かなくても別店所・類似区分を除外する', () => {
    const input = gmFixture();
    input.model.ClassD = '216486';
    input.ignoreGmFilter = true;
    // 防御確認前にIDを検証してもいけない。
    input.gmMappings[0].NumA = 'invalid';
    const result = execute(source, input);
    assert.equal(result.error, undefined);
    assert.ok(logs(result).includes('To: [Group201],[Group202],[Group203]'));
});

test('GM: 存在しない店所を他店所で補完しない', () => {
    const input = gmFixture();
    input.model.ClassD = '001'; // 内部値216485の表示名を検索値に流用しない。
    const result = execute(source, input);
    assert.match(result.error, /GM対応がありません/);
    assert.ok(!hasMessage(result));
});

test('GM: 店所未設定は検索前にエラー', () => {
    const input = gmFixture();
    input.model.ClassD = '';
    const result = execute(source, input);
    assert.equal(result.error, 'GM検索の店所コードが未設定です');
    assert.ok(!result.events.some(e => e[0] === 'get' && e[1] === 727689));
});

for (const value of [undefined, '', null, 0, -1, 1.5, 'abc', '0x10', '1e3', true, [], 2147483648]) {
    test(`GM: 不正なNumA ${JSON.stringify(value)}を通知先にしない`, () => {
        const input = gmFixture();
        input.gmMappings[0].NumA = value;
        const result = execute(source, input);
        assert.match(result.error, /GMグループIDが不正/);
        assert.ok(!hasMessage(result));
    });
}

for (const value of [101, '101', '101.0', 2147483647]) {
    test(`GM: 有効なNumA ${JSON.stringify(value)}をGroup形式にする`, () => {
        const input = gmFixture();
        input.gmMappings[0].NumA = value;
        const result = execute(source, input);
        assert.equal(result.error, undefined);
        assert.ok(logs(result).includes(`To: [Group${Number(value)}]`));
    });
}

for (const value of ['', 'GM', 'ORG001', 'GM001,GM002', 'GM 001', '[Group101]']) {
    test(`GM: 不正なグループコード ${JSON.stringify(value)}は設定エラー`, () => {
        const input = gmFixture();
        input.gmMappings[0].DescriptionA = value;
        assert.match(execute(source, input).error, /GMグループコードが不正/);
    });
}

test('GM: 同じGroupIdは取得時とTo・Cc・Bcc間で重複排除', () => {
    const input = gmFixture();
    input.gmMappings.push({ ...input.gmMappings[0], NumA: '101.0' });
    for (const type of ['Cc', 'Bcc']) input.targets.push({ ...input.targets[0], ClassC: type });
    const result = execute(source, input);
    assert.equal(result.error, undefined);
    assert.ok(logs(result).includes('To: [Group101]'));
    assert.ok(logs(result).includes('Cc: '));
    assert.ok(logs(result).includes('Bcc: '));
});

for (const store of ['', '216485', 'OTHER']) {
    test(`固定組織: 店所 ${JSON.stringify(store)} に依存しない`, () => {
        const input = fixture();
        input.fixedOrganizationCodes = ['001ABC'];
        input.model.ClassD = store;
        input.targets[0].ClassD = 'FIXED_ORGANIZATION';
        input.targets[0].ClassB = '001ABC';
        input.mail[0].DescriptionB = '001ABC';
        const result = execute(source, input);
        assert.equal(result.error, undefined);
        assert.ok(logs(result).includes('To: [User1],test@example.invalid'));
        assert.ok(!result.events.some(e => e[0] === 'get' && [846822, 727689].includes(e[1])));
        const query = result.events.find(e => e[0] === 'get' && e[1] === 809267);
        assert.equal(JSON.parse(query[2]).View.ColumnFilterHash.DescriptionB, '001ABC');
    });
}

for (const [type, group, expected] of [
    ['', 'G1', /通知対象区分が不正/],
    ['UNKNOWN', 'G1', /通知対象区分が不正/],
    ['GM', '客サ', /GMの対象グループが不正/],
    ['GM', 'constructor', /GMの対象グループが不正/],
    ['GM', 'G1', /GMの対象グループが不正/],
    ['ORGANIZATION', '客サGM', /店所連動組織の対象グループが不正/],
    ['ORGANIZATION', 'FIX001', /店所連動組織の対象グループが不正/],
    ['FIXED_ORGANIZATION', 'G1', /固定組織の許可コードにありません/],
    ['FIXED_ORGANIZATION', '客サGM', /固定組織の許可コードにありません/],
    ['GM', '', /通知対象グループが未設定/]
]) {
    test(`区分と選択値の検証: ${type}/${group}`, () => {
        const input = fixture();
        input.fixedOrganizationCodes = ['FIX001'];
        input.targets[0].ClassD = type;
        input.targets[0].ClassB = group;
        const result = execute(source, input);
        assert.match(result.error, expected);
        assert.ok(!result.events.some(e => e[0] === 'get' && [846822, 727689, 809267].includes(e[1])));
    });
}

test('対象区分の未登録を既存組織と推測して送信しない', () => {
    const input = fixture();
    delete input.targets[0].ClassD;
    assert.match(execute(source, input).error, /通知対象区分が不正/);
});

test('固定組織: 許可リストにないコードを拒否する', () => {
    const input = fixture();
    input.targets[0].ClassD = 'FIXED_ORGANIZATION';
    input.targets[0].ClassB = 'ABC001';
    assert.equal(execute(source, input).error, '固定組織の許可コードにありません: ABC001');
});

test('3区分混在: 既存宛先とGroup宛先を併用し、送信APIは1回だけ呼ぶ', () => {
    const input = gmFixture();
    input.fixedOrganizationCodes = ['ORG1'];
    input.organizations[0].ClassA = '216485';
    input.organizations[0].DescriptionA = 'STORE_ORG';
    input.mail.push({ ...input.mail[0], DescriptionB: 'STORE_ORG' });
    input.targets.push(
        { ClassA: '10', ClassB: 'G1', ClassC: 'To', ClassD: 'ORGANIZATION' },
        { ClassA: '10', ClassB: 'ORG1', ClassC: 'Cc', ClassD: 'FIXED_ORGANIZATION' },
        { ClassA: '10', ClassB: 'グリサGM', ClassC: 'Bcc', ClassD: 'GM' }
    );
    input.sendEnabled = true;
    input.trackEvaluation = true;
    const result = execute(source, input);
    assert.equal(result.error, undefined);
    const sends = result.events.filter(e => e[0] === 'send');
    assert.equal(sends.length, 1);
    assert.equal(sends[0][1].Address, '[Group101],[User1],test@example.invalid');
    assert.equal(sends[0][1].CcAddress, '');
    assert.equal(sends[0][1].BccAddress, '[Group102]');
    assert.equal(result.events.filter(e => e[0] === 'evaluate').length, 1);
});

for (const type of ['Cc', 'Bcc']) {
    test(`GM: 独立した${type}も既存の送信プロパティへ渡す`, () => {
        const input = gmFixture();
        input.targets[0].ClassC = type;
        input.fixedOrganizationCodes = ['ORG1'];
        input.targets.push({ ClassA: '10', ClassB: 'ORG1', ClassC: 'To', ClassD: 'FIXED_ORGANIZATION' });
        input.sendEnabled = true;
        const result = execute(source, input);
        assert.equal(result.error, undefined);
        const sent = result.events.find(e => e[0] === 'send')[1];
        assert.equal(sent.Address, '[User1],test@example.invalid');
        assert.equal(sent[type + 'Address'], '[Group101]');
    });
}

test('GM: 後続の対応行が不正なら一部のGroupだけを送信しない', () => {
    const input = gmFixture();
    input.model.ClassD = '216486';
    input.gmMappings[4].NumA = 0;
    input.sendEnabled = true;
    const result = execute(source, input);
    assert.match(result.error, /GMグループIDが不正/);
    assert.ok(!result.events.some(e => e[0] === 'send'));
});

function displayedMessages(result) { return result.events.filter(e => e[0] === 'message').map(e => [e[1], e[2]]); }
const testSuffix = '宛の依頼メールの送信を受け付けました。 ※実際のメールは送信していません。';

for (const [type, value, name] of [
    ['ORGANIZATION', 'G1', '受付グループ'],
    ['GM', '客サGM', 'お客さまサービスGM'],
    ['FIXED_ORGANIZATION', '001ABC', 'ABCグループ']
]) {
    for (const mode of ['TEST', 'PRODUCTION']) {
        test(`表示名とモード: ${type}/${mode}`, () => {
            const input = type === 'GM' ? gmFixture() : fixture();
            input.targets[0].ClassD = type;
            input.targets[0].ClassB = value;
            input.targetChoices = `${value},${name}`;
            input.sendMode = mode;
            input.trackEvaluation = true;
            if (type === 'FIXED_ORGANIZATION') {
                input.fixedOrganizationCodes = [value];
                input.mail[0].DescriptionB = value;
            }
            const result = execute(source, input);
            assert.equal(result.error, undefined);
            assert.deepEqual(displayedMessages(result), [[mode === 'TEST'
                ? `【テスト】${type === 'FIXED_ORGANIZATION' ? name : '店所に紐づく' + name}${testSuffix}` : `${type === 'FIXED_ORGANIZATION' ? name : '店所に紐づく' + name}宛に依頼メールを送信しました。`, 'alert-information']]);
            assert.equal(result.events.filter(e => e[0] === 'evaluate').length, 1);
            assert.equal(result.events.filter(e => e[0] === 'send').length, mode === 'TEST' ? 0 : 1);
            assert.equal(result.events.filter(e => e[0] === 'newNotification').length, mode === 'TEST' ? 0 : 1);
            assert.ok(logs(result).some(line => line.startsWith('件名:')));
            assert.ok(logs(result).some(line => line.startsWith('本文:')));
        });
    }
}

test('TESTは既定値で、モード定数の参照は取得関数だけに集約する', () => {
    assert.match(source, /const NOTIFICATION_SEND_MODE = "TEST";/);
    assert.doesNotMatch(source, /SEND_ENABLED/);
    assert.equal((source.match(/\bNOTIFICATION_SEND_MODE\b/g) || []).length, 2);
    const result = execute(source, fixture());
    assert.equal(displayedMessages(result).length, 1);
    assert.ok(displayedMessages(result)[0][0].startsWith('【テスト】'));
    assert.ok(!result.events.some(e => ['send', 'newNotification'].includes(e[0])));
});

for (const mode of ['BAD', '', 'test', 'TEST ', false, 0, null, undefined, {}, []]) {
    test(`未知の送信モード ${JSON.stringify(mode)} は検索・送信・受付表示前にエラー`, () => {
        const input = fixture();
        input.sendMode = mode;
        const result = execute(source, input);
        assert.match(result.error, /通知送信モードが不正/);
        assert.deepEqual(displayedMessages(result), []);
        assert.ok(!result.events.some(e => ['get', 'getSite', 'send', 'newNotification'].includes(e[0])));
        assert.ok(logs(result).some(line => line.startsWith('通知処理エラー:')));
    });
}

for (const mode of ['TEST', 'PRODUCTION']) {
    for (const [name, configure] of [
        ['条件不成立', f => { f.conditions[0].DescriptionB = '不成立'; }],
        ['通知対象なし', f => { f.targets = []; }],
        ['To不足', f => { f.organizations = []; }],
        ['不正宛先', f => { f.mail[0].DescriptionA = 'invalid'; }],
        ['本文生成失敗', f => { f.rules[0].DescriptionC = '{不明}'; }]
    ]) {
        test(`成功表示の抑止: ${mode}/${name}`, () => {
            const input = fixture();
            input.sendMode = mode;
            configure(input);
            const result = execute(source, input);
            assert.deepEqual(displayedMessages(result), []);
            assert.ok(!result.events.some(e => ['send', 'newNotification', 'getSite'].includes(e[0])));
        });
    }
}

for (const mode of ['TEST', 'PRODUCTION']) {
    test(`複数対象の全表示名を使い、同じ対象のTo/Cc重複は名前を重ねない（${mode}）`, () => {
        const input = fixture();
        input.sendMode = mode;
        input.fixedOrganizationCodes = ['FIX001'];
        input.targetChoices = 'G1,現場グループ\nFIX001,固定グループ';
        input.targets.push({ ClassA:'10', ClassB:'FIX001', ClassC:'Cc', ClassD:'FIXED_ORGANIZATION' },
            { ...input.targets[0], ClassC:'Bcc' });
        input.mail.push({ DescriptionB:'FIX001', ClassZ:'[]', DescriptionA:'fixed@example.invalid' });
        const result = execute(source, input);
        assert.equal(result.error, undefined);
        assert.deepEqual(displayedMessages(result), [[mode === 'TEST' ? `【テスト】店所に紐づく現場グループ、固定グループ${testSuffix}`
            : '店所に紐づく現場グループ、固定グループ宛に依頼メールを送信しました。', 'alert-information']]);
        assert.equal(result.events.filter(e => e[0] === 'getSite').length, 1);
    });
}

for (const configure of [
    f => { f.targetChoices = ''; },
    f => { f.targetChoices = '[{"SiteId":123}]'; },
    f => { f.noTargetSite = true; },
    f => { f.labelLookupError = true; }
]) {
    test(`表示名取得不可では保存コードを名前と推測せず一般表現で表示 ${configure.toString()}`, () => {
        const input = fixture();
        configure(input);
        const result = execute(source, input);
        assert.equal(result.error, undefined);
        assert.deepEqual(displayedMessages(result), [[`【テスト】指定された通知対象${testSuffix}`, 'alert-information']]);
    });
}

test('複数対象で一部の表示名が不明なら、一つの対象名だけで全体を代表させない', () => {
    const input = fixture();
    input.targets.push({ ...input.targets[0], ClassB:'G2', ClassC:'Cc' });
    input.organizations.push({ ClassA:'001', ClassC:'G2', DescriptionA:'ORG2' });
    input.mail.push({ DescriptionB:'ORG2', ClassZ:'[]', DescriptionA:'two@example.invalid' });
    input.targetChoices = 'G1,一つだけ判明';
    assert.deepEqual(displayedMessages(execute(source, input)), [[`【テスト】指定された通知対象（2件）${testSuffix}`, 'alert-information']]);
});

test('静的選択肢の省略表示名・エスケープしたカンマ・略称を標準形式で解釈する', () => {
    const input = fixture();
    input.targetChoices = 'G2,別の表示\r\nG1,第一\\,第二グループ,略称\r\n';
    assert.deepEqual(displayedMessages(execute(source, input)), [[`【テスト】店所に紐づく第一,第二グループ${testSuffix}`, 'alert-information']]);
    input.targetChoices = 'G1';
    assert.deepEqual(displayedMessages(execute(source, input)), [[`【テスト】店所に紐づくG1${testSuffix}`, 'alert-information']]);
});

test('PRODUCTIONのSend=falseでは失敗だけ表示し、TEST受付や成功を表示しない', () => {
    const input = fixture();
    input.sendMode = 'PRODUCTION';
    input.sendResult = false;
    const result = execute(source, input);
    assert.deepEqual(displayedMessages(result), [['店所に紐づく検証グループ宛の依頼メールの送信に失敗しました。', 'alert-error']]);
    assert.equal(result.events.filter(e => e[0] === 'send').length, 1);
});

test('PRODUCTIONのSend例外では成功表示せず、従来どおり中断する', () => {
    const input = fixture();
    input.sendMode = 'PRODUCTION';
    input.sendThrows = true;
    const result = execute(source, input);
    assert.equal(result.error, '送信API例外');
    assert.deepEqual(displayedMessages(result), []);
    assert.ok(logs(result).some(line => line.startsWith('通知処理エラー:')));
});

test('TESTの受付表示は追加CSS不要の1行にし、未送信を必ず明示する', () => {
    const [message, css] = displayedMessages(execute(source, fixture()))[0];
    assert.doesNotMatch(message, /[\r\n]|<br\s*\/?\s*>/i);
    assert.ok(message.endsWith('※実際のメールは送信していません。'));
    assert.equal(css, 'alert-information');
});

for (const [type, group, name] of [
    ['ORGANIZATION', '客サ', 'お客さまサービスG'],
    ['ORGANIZATION', 'お客さまサービスグループ', 'お客さまサービスG'],
    ['ORGANIZATION', 'グリサ', 'グリッドサービスG'],
    ['ORGANIZATION', 'グリッドサービスG', 'グリッドサービスG'],
    ['GM', '客サGM', 'お客さまサービスGM'],
    ['GM', 'グリサGM', 'グリッドサービスGM']
]) {
    test(`店所連動の指定表示名: ${type}/${group}`, () => {
        const sandbox = engine();
        assert.equal(sandbox.getNotificationTargetLabel([{targetType:type,group}]), '店所に紐づく'+name);
    });
}

for (const code of ['1014797', '1015247', '1015246', 'TTA']) {
    test(`指定の固定組織コードを標準設定で許可し、表示名を使う: ${code}`, () => {
        const input = fixture();
        input.targets[0].ClassD = 'FIXED_ORGANIZATION';
        input.targets[0].ClassB = code;
        input.mail[0].DescriptionB = code;
        input.targetChoices = `${code},固定組織の表示名`;
        const result = execute(source, input);
        assert.equal(result.error, undefined);
        assert.deepEqual(displayedMessages(result), [[`【テスト】固定組織の表示名${testSuffix}`, 'alert-information']]);
        assert.ok(!result.events.some(e => e[0]==='get' && [846822,727689].includes(e[1])));
    });
}

test('上部の新規追加コメントを除去し、宛先表示の店所接頭語を重複させない', () => {
    assert.doesNotMatch(source, /\/\/\s*[・]?新規追加/);
    const input = fixture();
    input.targetChoices = 'G1,店所に紐づく検証グループ';
    assert.deepEqual(displayedMessages(execute(source, input)), [[`【テスト】店所に紐づく検証グループ${testSuffix}`, 'alert-information']]);
});
