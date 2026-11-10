/* Pleasanter 1.4.23.3 : 編集画面の見た目を整えるCS
 * 入力欄そのものは作り直さず、既存DOMを移動する。
 * 既存の editor-layout.css をそのまま使える。
 */
(() => {
    'use strict';

    // ここだけ実環境に合わせて設定
    const config = {
        enabled: false,
        siteId: '',             // 対象テーブルのSiteId
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

    function applyLayout() {
        if (!config.enabled || !/^\d+$/.test(config.siteId)) return;
        const siteIds = document.querySelectorAll('#SiteId');
        if (siteIds.length !== 1 || siteIds[0].value !== config.siteId) return;

        const panels = document.querySelectorAll('#FieldSetGeneral > .tabs-panel-inner');
        if (panels.length !== 1) return;
        const panel = panels[0];
        if (!panel.closest('form')) return;
        const previousShell = panel.querySelector(':scope > .pcl-shell');

        // 全項目が存在することを確認してから移動する。
        const fields = new Map();
        const ids = new Set();
        for (const [key, column] of Object.entries(config.columns)) {
            const id = `${config.prefix}_${column}Field`;
            if (!/^[a-zA-Z0-9_]+$/.test(id)) {
                console.warn('[編集レイアウト] 項目の内部名を確認してください:', id);
                return;
            }
            const matches = document.querySelectorAll(`[id="${id}"]`);
            const field = matches[0];
            if (ids.has(id) || matches.length !== 1 || !field ||
                (field.parentElement !== panel && !previousShell?.contains(field)) ||
                !field.querySelector(':scope > .field-control')) {
                console.warn('[編集レイアウト] 項目の設定・配置を確認してください:', id);
                return;
            }
            fields.set(key, field);
            ids.add(id);
        }

        if (previousShell && [...fields.values()].every(field => previousShell.contains(field))) {
            // 項目だけ差し替わる場合は、その場で表示クラスを戻す。
            for (const field of fields.values()) field.classList.add('pcl-field');
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
    }

    // Ajaxなどで編集画面が再生成された場合にも、新しい画面へ適用する。
    // 既存の $p.events.on_editor_load は上書きしない。
    window.PleasanterConstructionLayout?.stop?.();
    if (!config.enabled) return;
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
