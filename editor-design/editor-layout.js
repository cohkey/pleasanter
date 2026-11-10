/* Pleasanter 1.4.23.3 : 編集画面の見た目を整えるCS
 * 入力欄そのものは作り直さず、既存DOMを移動する。
 * 既存の editor-layout.css をそのまま使える。
 */
(() => {
    'use strict';

    // ここだけ実環境に合わせて設定
    const config = {
        prefix: 'Results',     // 記録: Results / 期限付き: Issues
        columns: {
            title: 'Title', status: 'Status',
            design: 'ClassA', area: 'ClassB', block: 'ClassC',
            customer: 'ClassD', agent: 'ClassE', attendance: 'ClassF',
            power: 'DateA', withstand: 'DateB', period: 'DateC',
            twoWeeks: 'DateD', twoDays: 'DateE',
            customerReceived: 'DateF', checked: 'CheckA', reply: 'DateG',
            gridReceived: 'DateH', forwarded: 'DateI', fax: 'DateJ',
            workday: 'DateK', alternate: 'DateL',
            workManager: 'DescriptionA', workContractor: 'DescriptionB',
            completionManager: 'DescriptionC', completionContractor: 'DescriptionD'
        }
    };

    // [小見出し, 項目キー, 特別な表示]。配置を変えるときはここを編集する。
    const groups = [
        {
            title: 'グリッドサービスG 入力欄', tone: 'amber', owner: 'グリッドサービスG',
            note: '案件情報と工事に関する日程を入力',
            sections: [
                ['基本情報', ['design', 'area', 'block', 'customer', 'agent', 'attendance']],
                ['工事日程', ['power', 'withstand', 'period', 'twoWeeks', 'twoDays']],
                ['高圧供給設備の安全処置について', ['customerReceived', 'checked', 'reply'], 'safety']
            ]
        },
        {
            title: '配電建設G 入力欄', tone: 'teal', owner: '配電建設G',
            note: '受領・回付日と工事の連絡記録を管理',
            sections: [
                ['高圧供給設備の安全処置について', ['gridReceived', 'forwarded', 'fax'], 'safety'],
                ['工事日程', ['workday', 'alternate']],
                ['工事日の連絡記録', ['workManager', 'workContractor'], 'paired'],
                ['工事完了の連絡記録', ['completionManager', 'completionContractor'], 'paired']
            ]
        }
    ];

    const createElement = (tag, className, text) => {
        const element = document.createElement(tag);
        element.className = className;
        if (text) element.textContent = text;
        return element;
    };

    const logPrefix = '[編集レイアウト]';
    let lastMessage;
    function report(message, level = 'info') {
        // Ajax監視のたびに同じ診断を出さない。
        if (message === lastMessage) return;
        lastMessage = message;
        console[level](logPrefix + ' ' + message);
    }

    function applyLayout() {
        const panels = document.querySelectorAll('#FieldSetGeneral > .tabs-panel-inner');
        if (panels.length !== 1) return report('標準編集タブの件数: ' + panels.length + '（1件必要）');
        const panel = panels[0];
        const form = panel.closest('form');
        if (!form) return report('標準編集タブがフォーム内にありません', 'warn');
        const previousShell = panel.querySelector(':scope > .pcl-shell');

        // 全項目が存在することを確認してから移動する。
        const fields = new Map();
        const ids = new Set();
        const problems = [];
        for (const [key, column] of Object.entries(config.columns)) {
            const id = `${config.prefix}_${column}Field`;
            const matches = /^[a-zA-Z0-9_]+$/.test(id)
                ? document.querySelectorAll(`[id="${id}"]`) : [];
            const field = matches[0];
            let reason;
            if (ids.has(id)) reason = '項目設定が重複';
            else if (!matches.length) reason = 'DOMに見つかりません';
            else if (matches.length > 1) reason = 'DOMのIDが重複';
            else if (field.closest('form') !== form) reason = '対象フォームの外にあります';
            else if (field.parentElement !== panel && !previousShell?.contains(field)) {
                reason = '標準タブ直下にありません';
            } else if (!field.querySelector(':scope > .field-control')) {
                reason = '直下に .field-control がありません';
            }
            if (reason) problems.push(`${key} (${id}): ${reason}`);
            fields.set(key, field);
            ids.add(id);
        }

        if (problems.length) return report('適用を見送りました\n' + problems.join('\n'), 'warn');

        if (previousShell && [...fields.values()].every(field => previousShell.contains(field))) {
            // 項目だけ差し替わる場合は、その場で表示クラスを戻す。
            for (const field of fields.values()) field.classList.add('pcl-field');
            report('適用済み: ' + fields.size + '項目');
            return;
        }

        const shell = createElement('div', 'pcl-shell');
        panel.insertBefore(shell, previousShell || fields.get('title'));
        panel.classList.add('pcl-editor');

        // append() はコピーではなく「元の入力欄を移動」する。
        function move(key, destination) {
            const field = fields.get(key);
            field.classList.add('pcl-field');
            destination.append(field);
        }

        const summary = createElement('div', 'pcl-card pcl-summary');
        const summaryGrid = createElement('div', 'pcl-grid pcl-summary-grid');
        summary.append(summaryGrid);
        shell.append(summary);
        move('title', summaryGrid);
        move('status', summaryGrid);

        for (const group of groups) {
            const card = createElement('section', `pcl-card pcl-${group.tone}`);
            const head = createElement('div', 'pcl-card-head');
            const titles = createElement('div', 'pcl-titles');
            titles.append(createElement('h2', 'pcl-card-title', group.title),
                          createElement('p', 'pcl-note', group.note));
            head.append(titles, createElement('span', 'pcl-owner', group.owner));

            const body = createElement('div', 'pcl-card-body');
            for (const [title, keys, type] of group.sections) {
                const section = createElement('section', type === 'safety' ? 'pcl-section pcl-safety' : 'pcl-section');
                const grid = createElement('div', type === 'paired' ? 'pcl-grid pcl-paired' : 'pcl-grid');
                section.append(createElement('h3', 'pcl-subheading', title), grid);
                keys.forEach(key => move(key, grid));
                body.append(section);
            }
            card.append(head, body);
            shell.append(card);
        }
        previousShell?.remove();
        report('適用済み: ' + fields.size + '項目');
    }

    // Ajaxなどで編集画面が再生成された場合にも、新しい画面へ適用する。
    // 既存の $p.events.on_editor_load は上書きしない。
    console.info(logPrefix + ' 読み込みました');
    window.PleasanterConstructionLayout?.stop?.();
    let timer;
    let active = true;
    const observer = new MutationObserver(() => {
        if (!timer) timer = setTimeout(() => {
            timer = undefined;
            applyLayout();
        }, 80);
    });
    window.PleasanterConstructionLayout = {
        refresh: applyLayout,
        stop() {
            active = false;
            observer.disconnect();
            clearTimeout(timer);
        }
    };
    const start = () => {
        if (!active) return;
        observer.observe(document.body, { childList: true, subtree: true });
        applyLayout();
    };
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', start, { once: true });
    } else {
        start();
    }
})();
