/* Pleasanter 1.4.23.3 / 外部ライブラリ不要。
 * 設定は別環境の実項目に合わせること。既存項目を新設・複製しません。
 * 標準DOM: #FieldSetGeneral > .tabs-panel-inner > div.field-normal
 */
(function () {
    'use strict';
    const config = {
        enabled: false, // 対応表と対象SiteIdを確認後 true
        siteId: '', // レコードIDではなくテーブルのSiteId（文字列）
        prefix: 'Results', // 記録テーブル: Results / 期限付き: Issues
        // 以下は検証用の割当例。別環境の既存内部名に差し替える。
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
    const apiName = 'PleasanterConstructionLayout';
    // 同じスクリプトがAjaxで再評価されても監視は一つ。
    if (window[apiName]) window[apiName].destroy();
    const rootSelector = '#FieldSetGeneral > .tabs-panel-inner';
    const states = new Map();
    let observer, timer, stopped = false, lastWarning = '';
    const groups = [
        { title: 'グリッドサービスG 入力欄', tone: 'amber', owner: 'グリッドサービスG',
            note: '案件情報と工事に関する日程を入力', sections: [
                ['基本情報', ['design', 'area', 'block', 'customer', 'agent', 'attendance']],
                ['工事日程', ['power', 'withstand', 'period', 'twoWeeks', 'twoDays']],
                ['高圧供給設備の安全処置について', ['customerReceived', 'checked', 'reply'], 'safety']
            ] },
        { title: '配電建設G 入力欄', tone: 'teal', owner: '配電建設G',
            note: '受領・回付日と工事の連絡記録を管理', sections: [
                ['高圧供給設備の安全処置について', ['gridReceived', 'forwarded', 'fax'], 'safety'],
                ['工事日程', ['workday', 'alternate']],
                ['工事日の連絡記録', ['workManager', 'workContractor'], 'paired'],
                ['工事完了の連絡記録', ['completionManager', 'completionContractor'], 'paired']
            ] }
    ];
    function el(tag, className, text) {
        const node = document.createElement(tag);
        node.className = className;
        if (text) node.textContent = text;
        return node;
    }
    function warn(message) {
        if (message !== lastWarning) console.warn('[工事編集レイアウト] ' + message);
        lastWarning = message;
    }
    function allowed() {
        if (!config.enabled || !/^\d+$/.test(config.siteId)) return false;
        const sites = document.querySelectorAll('#SiteId');
        return sites.length === 1 && sites[0].value === config.siteId;
    }
    function inspect(root) {
        const form = root.closest('form');
        if (!form) throw new Error('編集フォームを確認できません。');
        const fields = new Map(), ids = new Set();
        for (const [key, column] of Object.entries(config.columns)) {
            if (!/^(Title|Status|Class[A-Z]|Date[A-Z]|Check[A-Z]|Description[A-Z])$/.test(column)) {
                throw new Error('項目内部名を確認してください: ' + key);
            }
            const id = config.prefix + '_' + column + 'Field';
            if (ids.has(id)) throw new Error('重複する項目割当: ' + key);
            ids.add(id);
            const matches = document.querySelectorAll('[id="' + id + '"]');
            if (matches.length !== 1) throw new Error('項目が存在しないか重複しています: ' + id);
            const field = matches[0];
            if (!root.contains(field) || field.closest('form') !== form ||
                !field.matches('div.field-normal, div.field-wide, div.field-markdown, div.field-rteditor') || !field.querySelector(':scope > .field-control')) {
                throw new Error('標準フィールド構造を確認できません: ' + id);
            }
            const managed = states.get(root);
            if (field.parentElement !== root && !(managed && managed.shell.contains(field))) {
                throw new Error('別タブ・既存セクション内の項目です。配置を確認してください: ' + id);
            }
            fields.set(key, field);
        }
        return fields;
    }
    function restore(root) {
        const state = states.get(root);
        if (!state) return;
        for (const entry of state.entries) {
            // Ajaxでラッパー自体が置換されていても現ノードを元位置に戻す。
            const field = Array.from(root.querySelectorAll('[id]')).find(n => n.id === entry.id);
            if (field && entry.anchor.parentNode) {
                entry.anchor.parentNode.insertBefore(field, entry.anchor);
                field.classList.remove('pcl-field');
            }
            entry.anchor.remove();
        }
        // 未知の追加ノードがある場合も破棄しない。
        for (const child of Array.from(state.shell.querySelectorAll('.pcl-grid > .pcl-field'))) {
            root.insertBefore(child, state.shell);
            child.classList.remove('pcl-field');
        }
        state.shell.remove();
        root.classList.remove('pcl-editor');
        states.delete(root);
    }
    function apply(root) {
        let fields = inspect(root);
        const old = states.get(root);
        if (old && old.entries.every(entry => fields.get(entry.key) === entry.node &&
            entry.node.parentNode === entry.destination && entry.node.classList.contains('pcl-field'))) return;
        if (old) { restore(root); fields = inspect(root); }
        const shell = el('div', 'pcl-shell');
        const state = { shell: shell, entries: [] };
        // 既存ノードに触れる前に検査を完了。戻すための位置を記録。
        for (const [key, field] of fields) {
            const anchor = document.createComment('工事レイアウト:' + key);
            field.before(anchor);
            state.entries.push({ key: key, id: field.id, node: field, anchor: anchor });
        }
        states.set(root, state);
        try {
            const summary = el('div', 'pcl-card pcl-summary');
            const summaryGrid = el('div', 'pcl-grid pcl-summary-grid');
            summary.append(summaryGrid); shell.append(summary);
            function move(key, destination) {
                const entry = state.entries.find(e => e.key === key);
                entry.destination = destination;
                entry.node.classList.add('pcl-field');
                destination.append(entry.node); // clone/innerHTMLは使わない
            }
            move('title', summaryGrid); move('status', summaryGrid);
            for (const group of groups) {
                const card = el('section', 'pcl-card pcl-' + group.tone);
                const header = el('div', 'pcl-card-head');
                const titles = el('div', 'pcl-titles');
                titles.append(el('h2', 'pcl-card-title', group.title), el('p', 'pcl-note', group.note));
                header.append(titles, el('span', 'pcl-owner', group.owner));
                const body = el('div', 'pcl-card-body');
                for (const [title, keys, kind] of group.sections) {
                    const section = el('section', 'pcl-section' + (kind === 'safety' ? ' pcl-safety' : ''));
                    const grid = el('div', 'pcl-grid' + (kind === 'paired' ? ' pcl-paired' : ''));
                    section.append(el('h3', 'pcl-subheading', title), grid);
                    for (const key of keys) move(key, grid);
                    body.append(section);
                }
                card.append(header, body); shell.append(card);
            }
            root.insertBefore(shell, state.entries[0].anchor);
            root.classList.add('pcl-editor');
            lastWarning = '';
        } catch (error) { restore(root); throw error; }
    }
    function refresh() {
        if (stopped) return;
        for (const root of states.keys()) {
            if (!root.isConnected || !allowed()) restore(root);
        }
        if (!allowed()) return;
        const roots = document.querySelectorAll(rootSelector);
        if (roots.length !== 1) { warn('編集タブが一意に確認できません。ダイアログ同時編集には適用しません。'); return; }
        try { apply(roots[0]); } catch (error) { warn(error.message); }
    }
    function start() {
        if (stopped) return;
        observer = new MutationObserver(function () {
            clearTimeout(timer);
            timer = setTimeout(refresh, 80);
        });
        observer.observe(document.body, { childList: true, subtree: true });
        refresh();
    }
    window[apiName] = {
        refresh: refresh,
        destroy: function () {
            stopped = true;
            if (observer) observer.disconnect();
            clearTimeout(timer);
            document.removeEventListener('DOMContentLoaded', start);
            for (const root of states.keys()) restore(root);
            delete window[apiName];
        }
    };
    // $p.events.on_editor_load等には一切代入しない。
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
    else start();
}());
