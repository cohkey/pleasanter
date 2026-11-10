/* node layout.test.cjs 実HTMLのパス jsdomのインストール先/node_modules/jsdom */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require(process.argv[3] || 'jsdom');
const html = fs.readFileSync(process.argv[2], 'utf8');
const source = fs.readFileSync(path.join(__dirname, '../editor-layout.js'), 'utf8');
const enabled = source.replace('enabled: false', 'enabled: true').replace("siteId: ''", "siteId: '847840'");
const rootSelector = '#FieldSetGeneral > .tabs-panel-inner';
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
let passed = 0;
async function test(name, fn) {
    await fn(); passed++; console.log('PASS ' + name);
}
function setup(script = enabled) {
    const dom = new JSDOM(html, { runScripts: 'outside-only', url: 'http://localhost:50174/items/847840/new' });
    dom.window.console.warn = () => {};
    dom.window.$p = { events: { on_editor_load() { return false; } } };
    const originalHandler = dom.window.$p.events.on_editor_load;
    dom.window.eval(script);
    dom.window.document.dispatchEvent(new dom.window.Event('DOMContentLoaded'));
    return { dom, w: dom.window, d: dom.window.document, originalHandler };
}
(async () => {
    await test('既定では無変更、サイト違いにも適用しない', () => {
        for (const s of [source, enabled.replace("siteId: '847840'", "siteId: '1'")]) {
            const {w,d}=setup(s); assert.equal(d.querySelector('.pcl-shell'),null);w.close();
        }
    });
    await test('実HTMLの25項目を移動、ID/name/値/選択肢/子要素と直接イベントを保持', () => {
        const {w,d,originalHandler}=setup(source);
        const root=d.querySelector(rootSelector);
        const before=[...root.querySelectorAll('input,select,textarea')];
        const attrs=before.map(n=>n.outerHTML);
        const field=d.querySelector('#Results_ClassAField'); let clicks=0;
        field.addEventListener('click',()=>clicks++);
        w.eval(enabled);w.document.dispatchEvent(new w.Event('DOMContentLoaded'));
        assert.equal(d.querySelectorAll('.pcl-field').length,25);
        assert.equal(d.querySelectorAll('.pcl-safety').length,2);
        assert.equal(d.querySelectorAll('.pcl-paired').length,2);
        before.forEach((n,i)=>{assert.equal(d.getElementById(n.id),n);assert.equal(n.outerHTML,attrs[i]);});
        field.click(); assert.equal(clicks,1);
        assert.equal(w.$p.events.on_editor_load, originalHandler);
        assert.equal(d.querySelector('#Results_AttachmentsAField').parentElement,root);
        assert.deepEqual([...d.querySelector('.pcl-summary-grid').children].map(n=>n.id),['Results_TitleField','Results_StatusField']);
        w.close();
    });
    await test('重複実行で増殖せず入力値を保持', () => {
        const {w,d}=setup(source);
        d.getElementById('Results_ClassA').value='編集中';
        w.eval(enabled);w.document.dispatchEvent(new w.Event('DOMContentLoaded'));w.PleasanterConstructionLayout.refresh();w.eval(enabled);w.document.dispatchEvent(new w.Event('DOMContentLoaded'));
        assert.equal(d.querySelectorAll('.pcl-shell').length,1);
        w.PleasanterConstructionLayout.stop();
        assert.equal(d.getElementById('Results_ClassA').value,'編集中');w.close();
    });
    await test('項目不足・重複マッピング・既存セクションではDOMを動かさない', () => {
        const variants=[enabled.replace("area: 'ClassB'", "area: 'ClassZ'"),enabled.replace("area: 'ClassB'", "area: 'ClassA'")];
        for(const s of variants){const {w,d}=setup(s);assert.equal(d.querySelector('.pcl-shell'),null);w.close();}
        const {w,d}=setup(source), field=d.getElementById('Results_ClassAField');
        const section=d.createElement('section');field.replaceWith(section);section.append(field);
        w.eval(enabled);w.document.dispatchEvent(new w.Event('DOMContentLoaded'));assert.equal(d.querySelector('.pcl-shell'),null);assert.equal(field.parentNode,section);w.close();
    });
    await test('Ajaxのフィールド差し替え・編集タブ再描画に追従', async () => {
        const {w,d}=setup();
        let field=d.getElementById('Results_ClassAField');
        const replacement=field.cloneNode(true); replacement.classList.remove('pcl-field'); replacement.querySelector('input').value='差し替え';
        field.replaceWith(replacement); await sleep(210);
        assert.equal(d.querySelectorAll('.pcl-shell').length,1);
        assert.equal(d.getElementById('Results_ClassA').value,'差し替え');
        assert(replacement.classList.contains('pcl-field'));
        const fresh=new JSDOM(html).window.document.querySelector(rootSelector).cloneNode(true);
        d.querySelector(rootSelector).replaceWith(fresh); await sleep(210);
        assert.equal(d.querySelectorAll('.pcl-field').length,25);w.close();
    });
    await test('非表示・読取専用・添付・画像ボタンの属性を保持',()=>{
        const {w,d}=setup(source);const f=d.getElementById('Results_ClassAField');
        f.classList.add('hidden');f.style.display='none';d.getElementById('Results_ClassA').readOnly=true;
        const image=d.querySelector('.button-upload-image');const imageHTML=image.outerHTML;
        w.eval(enabled);w.document.dispatchEvent(new w.Event('DOMContentLoaded'));assert(f.classList.contains('hidden'));assert.equal(f.style.display,'none');
        assert(d.getElementById('Results_ClassA').readOnly);assert.equal(image.outerHTML,imageHTML);w.close();
    });
    console.log(`${passed} tests passed`);
})().catch(error=>{console.error(error);process.exitCode=1;});
