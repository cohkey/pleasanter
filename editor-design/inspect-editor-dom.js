/* 別環境で必要なときだけ、編集画面の開発者ツール Console で実行。
 * 入力値・選択肢・レコード本文は出力しません。DOM変更・通信は行いません。
 */
(function () {
    'use strict';
    const roots = document.querySelectorAll('#FieldSetGeneral > .tabs-panel-inner');
    const report = {
        editorRootCount: roots.length,
        fields: Array.from(roots).flatMap(root => Array.from(root.querySelectorAll('div[id$="Field"]')).map(field => ({
            fieldId: field.id,
            fieldClass: field.className,
            directChild: field.parentElement === root,
            label: (field.querySelector(':scope > .field-label') || field.querySelector('label'))?.textContent.trim() || '',
            controls: Array.from(field.querySelectorAll('input,select,textarea')).map(input => ({
                tag: input.tagName, id: input.id, name: input.name,
                type: input.getAttribute('type'), class: input.className
            }))
        })))
    };
    console.log(JSON.stringify(report, null, 2));
    return report;
}());
