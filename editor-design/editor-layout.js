/**
 * 変更履歴
 * 2026/11/12
 * ・転記ボタンを既存の転記処理に接続し、標準セクション向けの移動処理を削除
 * 2026/11/11
 * ・設計番号の入力欄の横に転記ボタンを追加
 * ・グループ表示を簡素化し、窓シスのCSSクラス名を mado- に統一
 * ・項目の差し替え監視を標準編集タブ内に限定
 * 2026/11/10
 * ・標準タブ内のPleasanterセクションにある項目をカードに配置
 * ・標準の on_editor_load から適用し、手動診断で結果とCSSの適用状態を返す
 * ・実環境の項目割り当てを反映
 * ・対象テーブルへの直接登録を前提に enabled と siteId を廃止
 * ・読み込み、適用結果、項目ごとの停止理由をコンソールに出力
 * ・既存フォームとAjax再描画への対応を維持しながらレイアウト処理を簡略化
 */
(() => {
    'use strict';

    // ここだけ実環境に合わせて設定
    const config = {
        prefix: 'Results',     // 記録: Results / 期限付き: Issues
        columns: {
            title: 'Title', status: 'Status',
            design: 'DescriptionA', area: 'ClassB', block: 'ClassC',
            customer: 'DescriptionC', agent: 'DescriptionD', attendance: 'ClassD',
            power: 'DateA', withstand: 'DateB', period: 'DateC',
            twoWeeks: 'DateD', twoDays: 'DateE',
            customerReceived: 'DateF', checked: 'CheckA', reply: 'DateG',
            gridReceived: 'DateH', forwarded: 'DateI', fax: 'DateJ',
            workday: 'DateK', alternate: 'DateL',
            workManager: 'DescriptionE', workContractor: 'DescriptionF',
            completionManager: 'DescriptionG', completionContractor: 'DescriptionH'
        }
    };

    // [小見出し, 項目キー, 特別な表示]。配置を変えるときはここを編集する。
    const groups = [
        {
            title: 'グリッドサービスG 入力欄', name: 'gurisa',
            sections: [
                ['基本情報', ['design', 'area', 'block', 'customer', 'agent', 'attendance']],
                ['工事日程', ['power', 'withstand', 'period', 'twoWeeks', 'twoDays']],
                ['高圧供給設備の安全処置について', ['customerReceived', 'checked', 'reply'], 'anzen-sochi']
            ]
        },
        {
            title: '配電建設G 入力欄', name: 'haiden',
            sections: [
                ['高圧供給設備の安全処置について', ['gridReceived', 'forwarded', 'fax'], 'anzen-sochi'],
                ['工事日程', ['workday', 'alternate']],
                ['工事日の連絡記録', ['workManager', 'workContractor'], 'renraku'],
                ['工事完了の連絡記録', ['completionManager', 'completionContractor'], 'renraku']
            ]
        }
    ];

    const createElement = (tag, className, text) => {
        const element = document.createElement(tag);
        if (className) element.className = className;
        if (text) element.textContent = text;
        return element;
    };

    const logPrefix = '[編集レイアウト]';
    let lastMessage;
    function report(message, level = 'info') {
        // Ajax監視のたびに同じ診断を出さない。
        if (message !== lastMessage) {
            lastMessage = message;
            console[level](logPrefix + ' ' + message);
        }
        return { status: level === 'info' ? 'applied' : 'skipped', message };
    }

    function createTransferButton(field) {
        const input = field.querySelector('.input-field > input.control-textbox');
        if (!input) return;

        // 先に旧CSが作成したボタンは、クリック処理を保持したまま移す。
        const existingButton = field.querySelector('button#transferButton');
        if (existingButton) {
            existingButton.classList.add('mado-tenki');
            if (input.nextElementSibling !== existingButton) input.after(existingButton);
            return;
        }

        const button = createElement('button', 'mado-tenki');
        button.id = 'transferButton';
        button.type = 'button';
        button.innerHTML = `
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24"
                fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"
                stroke-linejoin="round" class="lucide lucide-copy preview-icon" aria-hidden="true">
                <rect width="14" height="14" x="8" y="8" rx="2" ry="2"/>
                <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>
            </svg>
            <span>転記</span>
        `;
        // 別CSの読み込み順に依存しないよう、クリック時に関数を参照する。
        button.addEventListener('click', function (event) {
            if (typeof fetchMadoSysData !== 'function') {
                console.warn(logPrefix + ' fetchMadoSysData を参照できません');
                return;
            }
            fetchMadoSysData.call(this, event);
        });
        input.after(button);
    }

    function applyLayout() {
        const panels = document.querySelectorAll('#FieldSetGeneral > .tabs-panel-inner');
        if (panels.length !== 1) return report('標準編集タブの件数: ' + panels.length + '（1件必要）', 'warn');
        const panel = panels[0];
        if (panel !== observedPanel) {
            observer.disconnect();
            observer.observe(panel, { childList: true, subtree: true });
            observedPanel = panel;
        }
        const form = panel.closest('form');
        if (!form) return report('標準編集タブがフォーム内にありません', 'warn');
        const previousShell = panel.querySelector(':scope > .mado-editor');

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

        createTransferButton(fields.get('design'));

        if (previousShell && [...fields.values()].every(field => previousShell.contains(field))) {
            return applied(previousShell, fields.size);
        }

        const editor = createElement('div', 'mado-editor');
        panel.insertBefore(editor, previousShell || fields.get('title'));

        const summary = createElement('div', 'mado-grid mado-summary');
        summary.append(fields.get('title'), fields.get('status'));
        editor.append(summary);

        for (const group of groups) {
            const groupElement = createElement('section', `mado-group mado-${group.name}`);
            groupElement.append(createElement('h2', '', group.title));
            for (const [title, keys, type] of group.sections) {
                const section = createElement('section', type ? `mado-grid mado-${type}` : 'mado-grid');
                section.append(createElement('h3', '', title), ...keys.map(key => fields.get(key)));
                groupElement.append(section);
            }
            editor.append(groupElement);
        }
        previousShell?.remove();
        return applied(editor, fields.size);
    }

    function applied(editor, count) {
        const grid = editor.querySelector('.mado-summary');
        const cssApplied = getComputedStyle(grid).display === 'grid';
        return {
            ...report('適用済み: ' + count + '項目' + (cssApplied ? '' : '（CSSが効いていません）')),
            count,
            cssApplied
        };
    }

    function refresh(trigger = '手動') {
        if (trigger !== '項目の再描画') lastMessage = undefined;
        try {
            return applyLayout();
        } catch (error) {
            console.error(logPrefix + ' ' + trigger + 'で例外が発生しました', error);
            return { status: 'error', message: error.message };
        }
    }

    console.info(logPrefix + ' 読み込みました');
    window.PleasanterConstructionLayout?.stop?.();
    let timer;
    let active = true;
    let observedPanel;
    let removeEditorLoad = () => {};

    // 項目単体の差し替えでは on_editor_load が発火しない。
    const observer = new MutationObserver(records => {
        if (!records.some(({ target }) => target === observedPanel ||
            target.matches('.mado-editor, .mado-group, .mado-grid'))) return;
        if (!timer) timer = setTimeout(() => {
            timer = undefined;
            refresh('項目の再描画');
        }, 80);
    });
    window.PleasanterConstructionLayout = {
        refresh: () => refresh(),
        stop() {
            active = false;
            observer.disconnect();
            clearTimeout(timer);
            removeEditorLoad();
        }
    };

    function start() {
        if (!active) return;
        const events = window.$p?.events;
        if (events) {
            const previous = events.on_editor_load;
            function onEditorLoad(...args) {
                const result = previous?.apply(this, args);
                refresh('on_editor_load');
                return result;
            }
            events.on_editor_load = onEditorLoad;
            removeEditorLoad = () => {
                if (events.on_editor_load === onEditorLoad) events.on_editor_load = previous;
            };
        } else {
            console.warn(logPrefix + ' $p.events が見つからないため標準イベントを登録できません');
        }
        refresh('初回表示');
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', start, { once: true });
    } else {
        start();
    }
})();
