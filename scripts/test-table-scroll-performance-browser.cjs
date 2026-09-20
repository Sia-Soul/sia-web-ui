// 58 列场景覆盖分页大小及虚拟开关；同时验证滚动不会反复测量已有单元格。
const assert = require('node:assert/strict');
const { chromium } = require(require('node:path').join(process.argv[2], 'playwright'));
(async () => {
  const browser = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1500, height: 950 } });
    await page.goto('http://127.0.0.1:4173/components/table', { waitUntil: 'domcontentloaded' });
    await page.evaluate(async () => {
      const { default: R } = await import('/node_modules/.vite/deps/react.js');
      const { default: { createRoot } } = await import('/node_modules/.vite/deps/react-dom_client.js');
      const { Table } = await import('/@fs/C:/Users/12235/Documents/SiaWebUI/packages/react/src/components/Table/index.ts');
      document.body.innerHTML = '';
      const host = document.createElement('div'); document.body.append(host);
      const root = createRoot(host);
      const original = Element.prototype.cloneNode;
      window.cloneCount = 0;
      Element.prototype.cloneNode = function (...args) { window.cloneCount++; return original.apply(this, args); };
      window.renderTable = (count, virtual) => root.render(R.createElement(Table, {
        key: `${count}-${virtual}`, height: 650, virtual, rowKey: 'id',
        columns: Array.from({ length: 58 }, (_, i) => ({ key: 'c' + i, title: '列' + i, dataIndex: 'c' + i, autoWidth: i === 57,
          render: i % 3 === 0 ? value => R.createElement('span', { className: 'sia-tag' }, value) : undefined })),
        dataSource: Array.from({ length: count }, (_, id) => Object.fromEntries([['id', id], ...Array.from({ length: 58 }, (_, i) => ['c' + i, `内容${id}-${i}`])])),
      }));
    });
    for (const count of [100, 101, 500]) for (const virtual of [true, false]) {
      await page.evaluate(({ count, virtual }) => window.renderTable(count, virtual), { count, virtual });
      await page.waitForTimeout(1200);
      // 等待首次布局和观察器提交，再测量滚动；超过 100 行均应使用虚拟窗口。
      await page.evaluate(async () => { for (let i = 0; i < 4; i++) await new Promise(requestAnimationFrame); });
      const result = await page.evaluate(async () => {
        const el = document.querySelector('.sia-table__viewport');
        const samples = []; const before = window.cloneCount;
        for (let i = 0; i < 12; i++) {
          const t = performance.now(); el.scrollTop = i * 170; el.scrollLeft = i * 100;
          await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
          samples.push(Math.round(performance.now() - t));
        }
        return { cells: document.querySelectorAll('td').length, samples, clones: window.cloneCount - before };
      });
      console.log(JSON.stringify({ count, virtual, ...result }));
      assert(count <= 100 && !virtual ? result.cells >= count * 58 : result.cells < count * 58, "超过 100 行必须窗口化，即使 virtual=false");
      if (!virtual && count <= 100) assert.equal(result.clones, 0, '非虚拟滚动不得重新复制单元格测宽');
      assert(result.clones < 100, '虚拟滚动只允许测量新挂载的自动宽度单元格');
      assert(Math.max(...result.samples) < 1000, '单次滚动不能阻塞超过一秒');
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
