(function () {
  'use strict';

  /**
   * デバッグログを出すか
   * @type {boolean}
   */
  const isDebug = true;

  /**
   * 手動で指定する並び順
   * Editor一覧をもとに好きな順へ並び替えた配列
   * この順に ExportColumns を並び替える
   *
   * @type {string[]}
   */
  const inputOrder = [
    'Title',
    'Owner',
    'Manager',
    'Status',
    'Body',
    'Comments',
    'ResultId',
    'Ver'
  ];

  /**
   * li から項目名を取得する
   * Export 側は data-value が JSON文字列
   *
   * @param {HTMLElement} li
   * @returns {string}
   */
  function getExportColumnName(li) {
    const raw = li.getAttribute('data-value') || '';
    if (!raw) {
      return '';
    }

    try {
      const obj = JSON.parse(raw);
      return obj.ColumnName || '';
    } catch (e) {
      return '';
    }
  }

  /**
   * ExportColumns の li 一覧を取得する
   *
   * @returns {HTMLElement[]}
   */
  function getExportItems() {
    return Array.from(document.querySelectorAll('#ExportColumns > li'));
  }

  /**
   * ExportColumns の現在順を取得する
   *
   * @returns {string[]}
   */
  function getCurrentExportOrder() {
    return getExportItems()
      .map(function (li) {
        return getExportColumnName(li);
      })
      .filter(Boolean);
  }

  /**
   * Export の項目を選択状態にする
   *
   * @param {HTMLElement} li
   */
  function selectExportItem(li) {
    getExportItems().forEach(function (item) {
      item.classList.remove('ui-selected');
      item.setAttribute('aria-selected', 'false');
    });

    li.classList.add('ui-selected');
    li.setAttribute('aria-selected', 'true');
  }

  /**
   * 上ボタンを1回押す
   */
  function moveUpOnce() {
    const button = document.getElementById('MoveUpExportColumns');
    if (!button) {
      throw new Error('MoveUpExportColumns が見つかりません。');
    }
    button.click();
  }

  /**
   * 指定項目を targetIndex まで上に移動する
   *
   * @param {string} columnName
   * @param {number} targetIndex
   */
  function moveExportItemToIndex(columnName, targetIndex) {
    let items = getExportItems();
    let currentIndex = items.findIndex(function (li) {
      return getExportColumnName(li) === columnName;
    });

    if (currentIndex === -1) {
      if (isDebug) {
        console.warn('[skip] not found in export:', columnName);
      }
      return;
    }

    while (currentIndex > targetIndex) {
      items = getExportItems();

      const li = items[currentIndex];
      if (!li) {
        break;
      }

      selectExportItem(li);
      moveUpOnce();

      items = getExportItems();
      currentIndex = items.findIndex(function (item) {
        return getExportColumnName(item) === columnName;
      });
    }

    if (isDebug) {
      console.log('[moved]', columnName, '->', targetIndex);
    }
  }

  /**
   * inputOrder をもとに、実際に Export に存在する項目だけ抜き出した並び順を作る
   *
   * @returns {string[]}
   */
  function buildDesiredOrder() {
    const currentExportOrder = getCurrentExportOrder();
    const exportSet = new Set(currentExportOrder);

    const desiredOrder = inputOrder.filter(function (name) {
      return exportSet.has(name);
    });

    currentExportOrder.forEach(function (name) {
      if (!desiredOrder.includes(name)) {
        desiredOrder.push(name);
      }
    });

    return desiredOrder;
  }

  /**
   * 指定順に ExportColumns を並び替える
   *
   * @param {string[]} desiredOrder
   */
  function reorderExportColumns(desiredOrder) {
    desiredOrder.forEach(function (columnName, targetIndex) {
      moveExportItemToIndex(columnName, targetIndex);
    });
  }

  const beforeOrder = getCurrentExportOrder();
  const desiredOrder = buildDesiredOrder();

  if (isDebug) {
    console.log('inputOrder:', inputOrder);
    console.log('beforeOrder:', beforeOrder);
    console.log('desiredOrder:', desiredOrder);
  }

  reorderExportColumns(desiredOrder);

  if (isDebug) {
    console.log('afterOrder:', getCurrentExportOrder());
  }
})();