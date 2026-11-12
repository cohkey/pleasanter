/**
 * 変更履歴
 * 2026/11/12
 * ・転記関数の後読み込み、旧ボタンの再利用、Ajax後の再生成を確認
 * 2026/11/11
 * ・転記ボタンの配置、重複防止、入力値の受け渡しを確認
 * ・簡素化した編集レイアウトの構造と項目差し替えを確認
 * 2026/11/10
 * ・標準セクション2つを再現し、項目の移動と対象外項目の保持を確認
 * ・標準イベントの共存と、手動診断で返す状態を確認
 * ・登録用の項目割り当てとDocker検証用の割り当てを分離
 */
/* node layout.test.cjs 実HTMLのパス jsdomのインストール先/node_modules/jsdom */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require(process.argv[3] || 'jsdom');
const html = fs.readFileSync(process.argv[2], 'utf8');
const registeredScript = fs.readFileSync(path.join(__dirname, '../editor-layout.js'), 'utf8');
// Dockerの採取済みHTMLは実環境と項目割り当てが異なる。
const labColumns = {
    design: 'ClassA', customer: 'ClassD', agent: 'ClassE', attendance: 'ClassF',
    workManager: 'DescriptionA', workContractor: 'DescriptionB',
    completionManager: 'DescriptionC', completionContractor: 'DescriptionD'
};
const source = registeredScript.replace(/(\w+): '[^']+'/g, (match, key) =>
    labColumns[key] ? `${key}: '${labColumns[key]}'` : match
);
const rootSelector = '#FieldSetGeneral > .tabs-panel-inner';
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
let passed = 0;
async function test(name, fn) {
    await fn(); passed++; console.log('PASS ' + name);
}
function setup(script = source) {
    const dom = new JSDOM(html, { runScripts: 'outside-only', url: 'http://localhost:50174/items/847840/new' });
    const warnings = [];
    dom.window.console.warn = message => warnings.push(message);
    dom.window.console.info = () => {};
    dom.window.$p = { events: { on_editor_load() { return false; } } };
    const originalHandler = dom.window.$p.events.on_editor_load;
    if (script) dom.window.eval(script);
    dom.window.document.dispatchEvent(new dom.window.Event('DOMContentLoaded'));
    return { dom, w: dom.window, d: dom.window.document, originalHandler, warnings };
}
(async () => {
    await test('編集タブがなければ適用せず、SiteIdなしの編集画面には適用する', () => {
        const {w,d}=setup(null);
        d.getElementById('SiteId')?.remove();
        const panel=d.querySelector(rootSelector);
        const parent=panel.parentElement;
        panel.remove();
        w.eval(source); d.dispatchEvent(new w.Event('DOMContentLoaded'));
        assert.equal(d.querySelector('.mado-editor'),null);
        assert.equal(w.PleasanterConstructionLayout.refresh().status, 'skipped');
        parent.append(panel);
        const result = w.PleasanterConstructionLayout.refresh();
        assert.equal(result.status, 'applied');
        assert.equal(result.count, 25);
        assert.equal(result.cssApplied, false);
        assert.equal(d.querySelectorAll('.mado-grid > [id$="Field"]').length,25);
        assert.equal(d.querySelectorAll('#transferButton').length,1);w.close();
    });
    await test('実HTMLの25項目を移動、ID/name/値/選択肢/子要素と直接イベントを保持', () => {
        const {w,d,originalHandler}=setup(null);
        const root=d.querySelector(rootSelector);
        const before=[...root.querySelectorAll('input,select,textarea')];
        const attrs=before.map(n=>n.outerHTML);
        const field=d.querySelector('#Results_ClassAField'); let clicks=0;
        field.addEventListener('click',()=>clicks++);
        w.eval(source);w.document.dispatchEvent(new w.Event('DOMContentLoaded'));
        assert.equal(d.querySelectorAll('.mado-grid > [id$="Field"]').length,25);
        assert.equal(d.querySelectorAll('.mado-anzen-sochi').length,2);
        assert.equal(d.querySelectorAll('.mado-renraku').length,2);
        const groups=d.querySelectorAll('.mado-editor > .mado-group');
        assert.equal(groups.length,2);
        assert(groups[0].classList.contains('mado-gurisa'));
        assert(groups[1].classList.contains('mado-haiden'));
        for (const group of groups) {
            assert.equal(group.firstElementChild.tagName,'H2');
            assert.equal(group.querySelectorAll('h2, h3').length,group.children.length);
        }
        before.forEach((n,i)=>{assert.equal(d.getElementById(n.id),n);assert.equal(n.outerHTML,attrs[i]);});
        field.click(); assert.equal(clicks,1);
        assert.equal(w.$p.events.on_editor_load(), false);
        w.PleasanterConstructionLayout.stop();
        assert.equal(w.$p.events.on_editor_load, originalHandler);
        assert.equal(d.querySelector('#Results_AttachmentsAField').parentElement,root);
        assert.deepEqual([...d.querySelector('.mado-summary').children].map(n=>n.id),['Results_TitleField','Results_StatusField']);
        w.close();
    });
    await test('重複実行で増殖せず入力値を保持', () => {
        const {w,d}=setup(null);
        d.getElementById('Results_ClassA').value='編集中';
        w.eval(source);w.document.dispatchEvent(new w.Event('DOMContentLoaded'));w.PleasanterConstructionLayout.refresh();w.eval(source);w.document.dispatchEvent(new w.Event('DOMContentLoaded'));
        assert.equal(d.querySelectorAll('.mado-editor').length,1);
        const design = d.getElementById('Results_ClassA');
        const button = design.nextElementSibling;
        assert.equal(button.type, 'button');
        assert.equal(button.id, 'transferButton');
        assert.equal(button.textContent.trim(), '転記');
        assert(button.querySelector('svg.lucide-copy'));
        assert.equal(d.querySelectorAll('.mado-tenki').length, 1);
        let designNumber;
        w.fetchMadoSysData = function (event) {
            assert.equal(this, button);
            assert.equal(event.type, 'click');
            designNumber = design.value;
        };
        button.click();
        assert.equal(designNumber, '編集中');
        w.PleasanterConstructionLayout.stop();
        assert.equal(design.value,'編集中');w.close();
    });
    await test('項目不足・重複マッピング・既存セクションではDOMを動かさない', () => {
        const variants=[source.replace("area: 'ClassB'", "area: 'ClassZ'"),source.replace("area: 'ClassB'", "area: 'ClassA'")];
        for(const [i,s] of variants.entries()){const {w,d,warnings}=setup(s);assert.equal(d.querySelector('.mado-editor'),null);assert.match(warnings[0],i ? /項目設定が重複/ : /Results_ClassZField.*見つかりません/);w.close();}
        const {w,d}=setup(null), field=d.getElementById('Results_ClassAField');
        const section=d.createElement('section');field.replaceWith(section);section.append(field);
        w.eval(source);w.document.dispatchEvent(new w.Event('DOMContentLoaded'));assert.equal(d.querySelector('.mado-editor'),null);assert.equal(field.parentNode,section);w.close();
    });
    await test('旧CSの転記ボタンを移動し、既存のクリック処理を保持する', () => {
        const {w,d}=setup(null);
        const design = d.getElementById('Results_ClassA');
        const oldButton = d.createElement('button');
        oldButton.id = 'transferButton';
        oldButton.className = 'transfer-button';
        oldButton.type = 'button';
        let calls = 0;
        oldButton.addEventListener('click', () => calls++);
        design.closest('.container-normal').append(oldButton);
        w.eval(source);
        d.dispatchEvent(new w.Event('DOMContentLoaded'));
        assert.equal(design.nextElementSibling, oldButton);
        assert.equal(d.querySelectorAll('#transferButton').length, 1);
        assert(oldButton.classList.contains('mado-tenki'));
        oldButton.click();
        assert.equal(calls, 1);
        w.close();
    });
    await test('項目単体の差し替えと標準イベントによる編集タブ再描画に追従', async () => {
        const {w,d}=setup();
        const field=d.getElementById('Results_ClassAField');
        const replacement=field.cloneNode(true);
        replacement.querySelector('#transferButton').remove();
        replacement.querySelector('input').value='差し替え';
        field.remove();
        d.querySelector(rootSelector).append(replacement);
        await sleep(210);
        assert.equal(d.querySelectorAll('.mado-editor').length,1);
        assert.equal(d.getElementById('Results_ClassA').value,'差し替え');
        assert(replacement.parentElement.matches('.mado-grid'));
        assert.equal(d.querySelectorAll('#transferButton').length,1);
        const fresh=new JSDOM(html).window.document.querySelector(rootSelector).cloneNode(true);
        d.querySelector(rootSelector).replaceWith(fresh);
        // 監視タイマーの実行前に標準イベントだけで適用できることを確認。
        assert.equal(w.$p.events.on_editor_load(), false);
        assert.equal(d.querySelectorAll('.mado-grid > [id$="Field"]').length,25);
        assert.equal(d.querySelectorAll('#transferButton').length,1);w.close();
    });
    await test('非表示・読取専用・添付・画像ボタンの属性を保持',()=>{
        const {w,d}=setup(null);const f=d.getElementById('Results_ClassAField');
        f.classList.add('hidden');f.style.display='none';d.getElementById('Results_ClassA').readOnly=true;
        const image=d.querySelector('.button-upload-image');const imageHTML=image.outerHTML;
        w.eval(source);w.document.dispatchEvent(new w.Event('DOMContentLoaded'));assert(f.classList.contains('hidden'));assert.equal(f.style.display,'none');
        assert(d.getElementById('Results_ClassA').readOnly);assert.equal(image.outerHTML,imageHTML);w.close();
    });
    console.log(`${passed} tests passed`);
})().catch(error=>{console.error(error);process.exitCode=1;});
