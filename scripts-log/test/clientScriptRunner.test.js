const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const clientLoggerSource = fs.readFileSync(
    path.join(__dirname, '..', 'clientScriptLogger.js'),
    'utf8'
);
const clientRunnerSource = fs.readFileSync(
    path.join(__dirname, '..', 'clientScriptRunner.js'),
    'utf8'
);
const serverLoggerSource = fs.readFileSync(
    path.join(__dirname, '..', 'serverScriptLogger.js'),
    'utf8'
);

function createSessionStorage() {
    const values = new Map();

    return {
        getItem(key) {
            return values.has(key) ? values.get(key) : null;
        },
        setItem(key, value) {
            values.set(key, String(value));
        },
        removeItem(key) {
            values.delete(key);
        }
    };
}

function createClientContext(options) {
    options = options || {};

    let currentRecordId = options.recordId || 310910;
    const apiCreates = [];
    const consoleErrors = [];
    const hiddenLog = { value: '' };
    const sessionStorage = createSessionStorage();
    const context = {
        console: {
            log() {},
            warn() {},
            error(value) {
                consoleErrors.push(String(value));
            }
        },
        document: {
            getElementById(id) {
                return id === 'Log' ? hiddenLog : null;
            }
        },
        location: {
            href: 'http://localhost:50023/items/310910/new'
        },
        sessionStorage: sessionStorage,
        setTimeout: setTimeout,
        clearTimeout: clearTimeout,
        $p: {
            id() {
                return currentRecordId;
            },
            siteId() {
                return 310910;
            },
            userId() {
                return 38891;
            },
            deptId() {
                return 12;
            },
            apiCreate(request) {
                apiCreates.push({
                    id: request.id,
                    data: request.data
                });
                request.done({});
                request.always({});
            },
            setMessage() {},
            ex: {
                addCloseMessageButtons() {}
            }
        }
    };

    context.window = context;
    context.globalThis = context;
    vm.createContext(context);
    vm.runInContext(
        clientLoggerSource + '\n' +
        clientRunnerSource + '\n' +
        'globalThis.__api = {' +
            'runClientEvent,' +
            'runClientCreateEvent' +
        '};',
        context
    );

    return {
        api: context.__api,
        apiCreates: apiCreates,
        console: context.console,
        consoleErrors: consoleErrors,
        sessionStorage: sessionStorage,
        setRecordId(value) {
            currentRecordId = value;
        }
    };
}

function loadPending(storage, key) {
    const value = storage.getItem(key);
    return value ? JSON.parse(value) : [];
}

test('create waits for the real ID and saves CS/SS as one record', async function () {
    const browser = createClientContext();
    const createdRecordId = 726277;
    const serverLog =
        '----- 開始: SSイベント: after-create -----\n' +
        '[info] after-create\n' +
        '----- 終了: SSイベント: after-create -----';
    const args = {
        json: [
            { Method: 'Set', Target: '#Id', Value: createdRecordId },
            { Method: 'Log', Value: serverLog }
        ]
    };

    await browser.api.runClientCreateEvent(args);

    let pendingClientLogs = loadPending(
        browser.sessionStorage,
        'PleasanterScriptLog.PendingClientLogs'
    );
    let pendingServerLogs = loadPending(
        browser.sessionStorage,
        'PleasanterScriptLog.PendingServerLogs'
    );

    assert.equal(browser.apiCreates.length, 0);
    assert.equal(pendingClientLogs.length, 1);
    assert.equal(pendingClientLogs[0].operationName, 'create');
    assert.equal(pendingClientLogs[0].sourceRecordId, String(createdRecordId));
    assert.equal(pendingServerLogs.length, 1);
    assert.equal(pendingServerLogs[0].sourceRecordId, String(createdRecordId));

    browser.console.log(serverLog);
    pendingServerLogs = loadPending(
        browser.sessionStorage,
        'PleasanterScriptLog.PendingServerLogs'
    );
    assert.equal(pendingServerLogs.length, 1);

    await browser.api.runClientEvent('on_editor_load', [], {
        sourceRecordId: 310910,
        includePendingClientLog: true,
        includeServerLog: true,
        operationName: 'screen-open'
    });

    assert.equal(browser.apiCreates.length, 0);
    pendingClientLogs = loadPending(
        browser.sessionStorage,
        'PleasanterScriptLog.PendingClientLogs'
    );
    assert.equal(pendingClientLogs.length, 2);

    browser.setRecordId(createdRecordId);
    await browser.api.runClientEvent('on_editor_load', [], {
        sourceRecordId: createdRecordId,
        includePendingClientLog: true,
        includeServerLog: true,
        operationName: 'screen-open'
    });

    assert.equal(browser.apiCreates.length, 1);

    const saved = browser.apiCreates[0].data;
    assert.equal(saved.DescriptionHash.DescriptionA, 'create');
    assert.equal(saved.NumHash.NumB, createdRecordId);
    assert.match(saved.DescriptionHash.DescriptionB, /before_set_Create/);
    assert.match(saved.DescriptionHash.DescriptionB, /after-create/);
    assert.match(saved.DescriptionHash.DescriptionB, /on_editor_load/);
    assert.equal(
        loadPending(
            browser.sessionStorage,
            'PleasanterScriptLog.PendingClientLogs'
        ).length,
        0
    );
    assert.equal(
        loadPending(
            browser.sessionStorage,
            'PleasanterScriptLog.PendingServerLogs'
        ).length,
        0
    );
});

test('existing update batching still saves as update', async function () {
    const browser = createClientContext({ recordId: 726277 });

    await browser.api.runClientEvent('before_send_Update', [], {
        sourceRecordId: 726277,
        deferToNextLoad: true,
        nextOperationName: 'update'
    });
    await browser.api.runClientEvent('on_editor_load', [], {
        sourceRecordId: 726277,
        includePendingClientLog: true,
        includeServerLog: true,
        operationName: 'screen-open'
    });

    assert.equal(browser.apiCreates.length, 1);
    assert.equal(
        browser.apiCreates[0].data.DescriptionHash.DescriptionA,
        'update'
    );
    assert.equal(browser.apiCreates[0].data.NumHash.NumB, 726277);
});

test('create saves on the first editor load when the real ID is already set', async function () {
    const createdRecordId = 726278;
    const browser = createClientContext({ recordId: createdRecordId });
    const args = {
        json: [
            { Method: 'Set', Target: '#Id', Value: createdRecordId }
        ]
    };

    await browser.api.runClientCreateEvent(args);
    await browser.api.runClientEvent('on_editor_load', [], {
        sourceRecordId: createdRecordId,
        includePendingClientLog: true,
        includeServerLog: true,
        operationName: 'screen-open'
    });

    assert.equal(browser.apiCreates.length, 1);
    assert.equal(
        browser.apiCreates[0].data.DescriptionHash.DescriptionA,
        'create'
    );
    assert.equal(browser.apiCreates[0].data.NumHash.NumB, createdRecordId);
});

test('create does not save with the site ID when response has no created ID', async function () {
    const browser = createClientContext();

    const result = await browser.api.runClientCreateEvent({ json: [] });

    assert.equal(result, null);
    assert.equal(browser.apiCreates.length, 0);
    assert.equal(
        loadPending(
            browser.sessionStorage,
            'PleasanterScriptLog.PendingClientLogs'
        ).length,
        0
    );
    assert.equal(browser.consoleErrors.length, 1);
});

test('server logger prefers model record ID and respects an explicit ID', function () {
    const context = {
        model: {
            ResultId: 726277
        }
    };

    context.globalThis = context;
    vm.createContext(context);
    vm.runInContext(
        serverLoggerSource + '\n' +
        'globalThis.__api = {' +
            'resolveServerSourceRecordId' +
        '};',
        context
    );

    assert.equal(
        context.__api.resolveServerSourceRecordId({ Id: 310910 }, {}),
        726277
    );
    assert.equal(
        context.__api.resolveServerSourceRecordId(
            { Id: 310910 },
            { sourceRecordId: 999999 }
        ),
        999999
    );
});
