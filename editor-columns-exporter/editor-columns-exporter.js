(function () {
  'use strict';

  const pairs = Array.from(document.querySelectorAll('#EditorColumns > li')).map(function (li, index) {
    return {
      index: index,
      label: li.innerText.trim(),
      value: li.dataset.value
    };
  });

  console.table(pairs);
})();