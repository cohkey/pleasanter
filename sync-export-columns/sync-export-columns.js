(async function () {
  'use strict';

  const isDebug = true;

  /**
   * ここを編集する
   * 配列順 = エクスポート項目の並び順
   * value = ColumnName
   * label = 表示名
   */
  const columnSettings = [
    { value: 'Title', label: 'タイトル' },
    { value: 'Owner', label: '担当者' },
    { value: 'Manager', label: '管理者' },
    { value: 'Status', label: '状況' },
    { value: 'Body', label: '内容' },
    { value: 'Comments', label: 'コメント' },
    { value: 'ResultId', label: 'ID' }
  ];

  function sleep(ms) {
    return new Promise(function (resolve) {
      setTimeout(resolve, ms);
    });
  }

  function logProgress(stage, message, detail) {
    if (!isDebug) {
      return;
    }

    const time = new Date().toLocaleTimeString();

    if (detail !== undefined) {
      console.log('[' + time + ']', '[' + stage + ']', message, detail);
    } else {
      console.log('[' + time + ']', '[' + stage + ']', message);
    }
  }

  function getExportItems() {
    return Array.from(document.querySelectorAll('#ExportColumns > li'));
  }

  function parseExportValue(li) {
    const raw = li.getAttribute('data-value') || '';
    if (!raw) {
      return {};
    }

    try {
      return JSON.parse(raw);
    } catch (e) {
      return {};
    }
  }

  function getColumnName(li) {
    return parseExportValue(li).ColumnName || '';
  }

  function getItemLabel(li) {
    return li.textContent.replace(/\s+/g, ' ').trim();
  }

  function getExportSnapshot() {
    return getExportItems().map(function (li, index) {
      const data = parseExportValue(li);

      return {
        index: index,
        id: data.Id ?? null,
        value: data.ColumnName || '',
        itemLabel: getItemLabel(li),
        enabled: true
      };
    });
  }

  function findExportItem(columnName) {
    return getExportItems().find(function (li) {
      return getColumnName(li) === columnName;
    }) || null;
  }

  function selectExportItem(li) {
    getExportItems().forEach(function (item) {
      item.classList.remove('ui-selected');
      item.setAttribute('aria-selected', 'false');
    });

    li.classList.add('ui-selected');
    li.setAttribute('aria-selected', 'true');
  }

  async function clickButtonAndWait(buttonId, waitMs) {
    const button = document.getElementById(buttonId);
    if (!button) {
      throw new Error(buttonId + ' が見つかりません。');
    }

    button.click();
    await sleep(waitMs);
  }

  async function moveExportItemToIndex(columnName, targetIndex) {
    let items = getExportItems();
    let currentIndex = items.findIndex(function (li) {
      return getColumnName(li) === columnName;
    });

    if (currentIndex === -1) {
      logProgress('move-skip', '項目が見つからないためスキップ: ' + columnName);
      return false;
    }

    logProgress('move-start', '移動開始: ' + columnName, {
      currentIndex: currentIndex,
      targetIndex: targetIndex
    });

    while (currentIndex > targetIndex) {
      items = getExportItems();
      const li = items[currentIndex];

      if (!li) {
        break;
      }

      logProgress('move-step', columnName + ' を ' + currentIndex + ' → ' + (currentIndex - 1) + ' へ移動');

      selectExportItem(li);
      await clickButtonAndWait('MoveUpExportColumns', 180);

      items = getExportItems();
      currentIndex = items.findIndex(function (item) {
        return getColumnName(item) === columnName;
      });
    }

    logProgress('move-done', '移動完了: ' + columnName, {
      finalIndex: currentIndex
    });

    return true;
  }

  async function reorderExportColumns() {
    const currentOrder = getExportSnapshot().map(function (item) {
      return item.value;
    });

    const desiredOrder = columnSettings
      .map(function (item) {
        return item.value;
      })
      .filter(function (value) {
        return currentOrder.includes(value);
      });

    currentOrder.forEach(function (value) {
      if (!desiredOrder.includes(value)) {
        desiredOrder.push(value);
      }
    });

    logProgress('phase', '並び替え開始', {
      desiredOrder: desiredOrder
    });

    for (let i = 0; i < desiredOrder.length; i += 1) {
      logProgress('phase', '並び替え中 (' + (i + 1) + '/' + desiredOrder.length + '): ' + desiredOrder[i]);
      await moveExportItemToIndex(desiredOrder[i], i);
    }

    logProgress('phase', '並び替え完了');
  }

  async function disableUnknownExportItems() {
    const allowedSet = new Set(columnSettings.map(function (item) {
      return item.value;
    }));

    logProgress('phase', '不要項目の無効化を開始');

    let items = getExportItems();
    let index = 0;

    while (index < items.length) {
      const li = items[index];
      const value = getColumnName(li);

      if (!allowedSet.has(value)) {
        logProgress('disable', '無効化中: ' + value);

        selectExportItem(li);
        await clickButtonAndWait('ToDisableExportColumns', 220);

        items = getExportItems();
        continue;
      }

      index += 1;
    }

    logProgress('phase', '不要項目の無効化が完了');
  }

  function getDialog() {
    return document.getElementById('ExportColumnsDialog');
  }

  function getDialogLabelInput() {
    return document.getElementById('ExportColumnLabelText');
  }

  function getDialogUpdateButton() {
    return document.getElementById('UpdateExportColumn');
  }

  function getDialogCancelButton() {
    const dialog = getDialog();
    if (!dialog) {
      return null;
    }

    return dialog.querySelector('button[onclick*="$p.closeDialog"]');
  }

  async function waitForDialogOpen(timeoutMs) {
    const start = Date.now();

    while (Date.now() - start < timeoutMs) {
      const dialog = getDialog();
      const input = getDialogLabelInput();

      if (dialog && input && dialog.style.display !== 'none') {
        return true;
      }

      await sleep(50);
    }

    return false;
  }

  async function waitForDialogClose(timeoutMs) {
    const start = Date.now();

    while (Date.now() - start < timeoutMs) {
      const dialog = getDialog();

      if (!dialog || dialog.style.display === 'none') {
        return true;
      }

      await sleep(50);
    }

    return false;
  }

  async function openExportColumnDialog(columnName) {
    const li = findExportItem(columnName);

    if (!li) {
      logProgress('dialog-skip', '項目が見つからないため詳細設定を開けません: ' + columnName);
      return false;
    }

    selectExportItem(li);
    await clickButtonAndWait('OpenExportColumnsDialog', 120);

    const opened = await waitForDialogOpen(2000);
    if (!opened) {
      throw new Error('詳細設定ダイアログが開きませんでした: ' + columnName);
    }

    logProgress('dialog-open', '詳細設定を開きました: ' + columnName);
    return true;
  }

  async function closeDialogIfOpen() {
    const dialog = getDialog();
    if (!dialog || dialog.style.display === 'none') {
      return;
    }

    const cancelButton = getDialogCancelButton();
    if (cancelButton) {
      cancelButton.click();
      await waitForDialogClose(2000);
      logProgress('dialog-close', '詳細設定を閉じました');
    }
  }

  function setNativeValue(input, value) {
    const prototype = Object.getPrototypeOf(input);
    const descriptor = Object.getOwnPropertyDescriptor(prototype, 'value');

    if (descriptor && descriptor.set) {
      descriptor.set.call(input, value);
    } else {
      input.value = value;
    }

    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  }

  async function readCurrentExportLabel(columnName) {
    logProgress('label-read-start', '表示名取得開始: ' + columnName);

    const opened = await openExportColumnDialog(columnName);
    if (!opened) {
      return null;
    }

    const input = getDialogLabelInput();
    if (!input) {
      throw new Error('ExportColumnLabelText が見つかりません。');
    }

    const label = input.value;

    await closeDialogIfOpen();

    logProgress('label-read-done', '表示名取得完了: ' + columnName, {
      label: label
    });

    return label;
  }

  async function updateExportColumnLabel(columnName, label) {
    logProgress('rename-start', '表示名変更開始: ' + columnName, {
      expectedLabel: label
    });

    const opened = await openExportColumnDialog(columnName);
    if (!opened) {
      return {
        value: columnName,
        expectedLabel: label,
        beforeLabel: null,
        afterLabel: null,
        labelOk: false,
        updated: false,
        reason: 'not_found'
      };
    }

    const input = getDialogLabelInput();
    const updateButton = getDialogUpdateButton();

    if (!input) {
      throw new Error('ExportColumnLabelText が見つかりません。');
    }

    if (!updateButton) {
      throw new Error('UpdateExportColumn が見つかりません。');
    }

    const beforeLabel = input.value;

    logProgress('rename-read', '現在の表示名を取得: ' + columnName, {
      beforeLabel: beforeLabel
    });

    if (beforeLabel !== label) {
      setNativeValue(input, label);
      updateButton.click();

      logProgress('rename-submit', '変更ボタン押下: ' + columnName, {
        beforeLabel: beforeLabel,
        expectedLabel: label
      });

      const closed = await waitForDialogClose(2500);
      if (!closed) {
        await sleep(500);
      }
    } else {
      logProgress('rename-skip', 'すでに期待値のため変更不要: ' + columnName);
      await closeDialogIfOpen();
    }

    const afterLabel = await readCurrentExportLabel(columnName);
    const labelOk = afterLabel === label;

    logProgress('rename-check', '表示名変更結果: ' + columnName, {
      afterLabel: afterLabel,
      expectedLabel: label,
      labelOk: labelOk
    });

    return {
      value: columnName,
      expectedLabel: label,
      beforeLabel: beforeLabel,
      afterLabel: afterLabel,
      labelOk: labelOk,
      updated: beforeLabel !== label,
      reason: labelOk ? 'ok' : 'label_mismatch'
    };
  }

  async function updateExportColumnLabels() {
    const results = [];

    logProgress('phase', '表示名変更を開始');

    for (let i = 0; i < columnSettings.length; i += 1) {
      const setting = columnSettings[i];
      logProgress('phase', '表示名変更中 (' + (i + 1) + '/' + columnSettings.length + '): ' + setting.value);
      const result = await updateExportColumnLabel(setting.value, setting.label);
      results.push(result);
    }

    logProgress('phase', '表示名変更が完了');
    return results;
  }

  function buildComparison(beforeSnapshot, afterSnapshot) {
    const beforeMap = new Map(beforeSnapshot.map(function (item) {
      return [item.value, item];
    }));

    const afterMap = new Map(afterSnapshot.map(function (item) {
      return [item.value, item];
    }));

    const values = Array.from(new Set(
      beforeSnapshot.map(function (item) { return item.value; })
        .concat(afterSnapshot.map(function (item) { return item.value; }))
    ));

    return values.map(function (value) {
      const before = beforeMap.get(value) || null;
      const after = afterMap.get(value) || null;

      const indexBefore = before ? before.index : null;
      const indexAfter = after ? after.index : null;
      const enabledBefore = Boolean(before);
      const enabledAfter = Boolean(after);

      let changeType = 'unchanged';

      if (enabledBefore && !enabledAfter) {
        changeType = 'disabled';
      } else if (!enabledBefore && enabledAfter) {
        changeType = 'enabled';
      } else if (indexBefore !== indexAfter) {
        changeType = 'moved';
      }

      return {
        value: value,
        itemLabelBefore: before ? before.itemLabel : '',
        itemLabelAfter: after ? after.itemLabel : '',
        idBefore: before ? before.id : null,
        idAfter: after ? after.id : null,
        indexBefore: indexBefore,
        indexAfter: indexAfter,
        enabledBefore: enabledBefore,
        enabledAfter: enabledAfter,
        changeType: changeType
      };
    });
  }

  function buildVerificationResult(beforeSnapshot, afterSnapshot, labelResults) {
    const beforeMap = new Map(beforeSnapshot.map(function (item) {
      return [item.value, item];
    }));

    const afterMap = new Map(afterSnapshot.map(function (item) {
      return [item.value, item];
    }));

    const labelMap = new Map(labelResults.map(function (item) {
      return [item.value, item];
    }));

    const desiredValues = columnSettings.map(function (item) {
      return item.value;
    });

    const desiredMap = new Map(columnSettings.map(function (item, index) {
      return [item.value, {
        expectedIndex: index,
        expectedLabel: item.label
      }];
    }));

    const allValues = Array.from(new Set(
      beforeSnapshot.map(function (item) { return item.value; })
        .concat(afterSnapshot.map(function (item) { return item.value; }))
        .concat(desiredValues)
    ));

    return allValues.map(function (value) {
      const before = beforeMap.get(value) || null;
      const after = afterMap.get(value) || null;
      const desired = desiredMap.get(value) || null;
      const labelResult = labelMap.get(value) || null;

      const shouldBeEnabled = Boolean(desired);
      const actualEnabled = Boolean(after);

      const enabledOk = shouldBeEnabled === actualEnabled;

      const expectedIndex = shouldBeEnabled ? desired.expectedIndex : null;
      const actualIndex = after ? after.index : null;
      const orderOk = !shouldBeEnabled || expectedIndex === actualIndex;

      const labelOk = !shouldBeEnabled || Boolean(labelResult && labelResult.labelOk);

      const overallOk = enabledOk && orderOk && labelOk;

      return {
        value: value,
        itemLabelBefore: before ? before.itemLabel : '',
        itemLabelAfter: after ? after.itemLabel : '',
        expectedEnabled: shouldBeEnabled,
        actualEnabled: actualEnabled,
        enabledOk: enabledOk,
        expectedIndex: expectedIndex,
        actualIndex: actualIndex,
        orderOk: orderOk,
        expectedLabel: desired ? desired.expectedLabel : '',
        actualLabel: labelResult ? labelResult.afterLabel : '',
        labelOk: labelOk,
        overallOk: overallOk
      };
    });
  }

  logProgress('phase', '変更前スナップショットを取得');
  const beforeSnapshot = getExportSnapshot();

  if (isDebug) {
    console.group('before snapshot');
    console.table(beforeSnapshot);
    console.groupEnd();
  }

  await reorderExportColumns();
  await disableUnknownExportItems();
  const labelResults = await updateExportColumnLabels();

  logProgress('phase', '変更後スナップショットを取得');
  const afterSnapshot = getExportSnapshot();

  logProgress('phase', '比較結果を作成');
  const comparison = buildComparison(beforeSnapshot, afterSnapshot);

  logProgress('phase', '最終検証を実行');
  const verification = buildVerificationResult(beforeSnapshot, afterSnapshot, labelResults);
  const failedItems = verification.filter(function (item) {
    return !item.overallOk;
  });

  console.group('label results');
  console.table(labelResults);
  console.groupEnd();

  console.group('after snapshot');
  console.table(afterSnapshot);
  console.groupEnd();

  console.group('comparison');
  console.table(comparison);
  console.groupEnd();

  console.group('verification');
  console.table(verification);
  console.groupEnd();

  if (failedItems.length > 0) {
    console.group('verification failed items');
    console.table(failedItems);
    console.groupEnd();

    logProgress('done', '一部失敗あり', {
      failedCount: failedItems.length
    });

    alert('一部の変更に失敗しました。console の verification failed items を確認してください。');
  } else {
    logProgress('done', '全項目の検証OK');

    alert('全項目の検証OKです。並び順・有効状態・表示名が期待通りです。');
  }
})();