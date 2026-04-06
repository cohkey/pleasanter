(async function () {
  'use strict';

  const isDebug = true;

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
      if (isDebug) {
        console.warn('[skip move] not found:', columnName);
      }
      return false;
    }

    while (currentIndex > targetIndex) {
      items = getExportItems();
      const li = items[currentIndex];
      if (!li) {
        break;
      }

      selectExportItem(li);
      await clickButtonAndWait('MoveUpExportColumns', 180);

      items = getExportItems();
      currentIndex = items.findIndex(function (item) {
        return getColumnName(item) === columnName;
      });
    }

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

    for (let i = 0; i < desiredOrder.length; i += 1) {
      await moveExportItemToIndex(desiredOrder[i], i);
    }
  }

  async function disableUnknownExportItems() {
    const allowedSet = new Set(columnSettings.map(function (item) {
      return item.value;
    }));

    let items = getExportItems();
    let index = 0;

    while (index < items.length) {
      const li = items[index];
      const value = getColumnName(li);

      if (!allowedSet.has(value)) {
        if (isDebug) {
          console.log('[disable]', value);
        }

        selectExportItem(li);
        await clickButtonAndWait('ToDisableExportColumns', 220);

        items = getExportItems();
        continue;
      }

      index += 1;
    }
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
      if (isDebug) {
        console.warn('[skip dialog] not found:', columnName);
      }
      return false;
    }

    selectExportItem(li);
    await clickButtonAndWait('OpenExportColumnsDialog', 120);

    const opened = await waitForDialogOpen(2000);
    if (!opened) {
      throw new Error('詳細設定ダイアログが開きませんでした: ' + columnName);
    }

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
    return label;
  }

  async function updateExportColumnLabel(columnName, label) {
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

    if (beforeLabel !== label) {
      setNativeValue(input, label);
      updateButton.click();

      const closed = await waitForDialogClose(2500);
      if (!closed) {
        await sleep(500);
      }
    } else {
      await closeDialogIfOpen();
    }

    const afterLabel = await readCurrentExportLabel(columnName);
    const labelOk = afterLabel === label;

    if (isDebug) {
      console.log('[label check]', {
        value: columnName,
        beforeLabel: beforeLabel,
        expectedLabel: label,
        afterLabel: afterLabel,
        labelOk: labelOk
      });
    }

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

    for (const setting of columnSettings) {
      const result = await updateExportColumnLabel(setting.value, setting.label);
      results.push(result);
    }

    return results;
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

  const beforeSnapshot = getExportSnapshot();

  if (isDebug) {
    console.group('before snapshot');
    console.table(beforeSnapshot);
    console.groupEnd();
  }

  await reorderExportColumns();
  await disableUnknownExportItems();
  const labelResults = await updateExportColumnLabels();

  const afterSnapshot = getExportSnapshot();
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

  console.group('verification');
  console.table(verification);
  console.groupEnd();

  if (failedItems.length > 0) {
    console.group('verification failed items');
    console.table(failedItems);
    console.groupEnd();
    alert('一部の変更に失敗しました。console.table の verification failed items を確認してください。');
  } else {
    alert('全項目の検証OKです。並び順・有効状態・表示名が期待通りです。');
  }
})();