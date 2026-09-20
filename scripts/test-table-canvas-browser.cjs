// Canvas 必须保留选区、勾选和自定义操作；同时限定滚动时挂载的交互组件数量。
const assert = require('node:assert/strict');
const { chromium } = require(require('node:path').join(process.argv[2], 'playwright'));
(async () => {
  const browser = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1500, height: 950 }, deviceScaleFactor: 1.25 });
    await page.goto('http://127.0.0.1:4173/components/table', { waitUntil: 'domcontentloaded' });
    await page.evaluate(async () => {
      const { default: R } = await import('/node_modules/.vite/deps/react.js');
      const { default: { createRoot } } = await import('/node_modules/.vite/deps/react-dom_client.js');
      const { Table, createSelectionPlugin, createColumnSettingPlugin, createSortPlugin } = await import('/@fs/C:/Users/12235/Documents/SiaWebUI/packages/react/src/components/Table/index.ts');
      const { Button } = await import('/@fs/C:/Users/12235/Documents/SiaWebUI/packages/react/src/components/Button.tsx');
      document.body.innerHTML = ''; const host = document.createElement('div'); document.body.append(host);
      const root = createRoot(host); window.tableRef = R.createRef(); window.actions = [];
      window.mountTable = count => root.render(R.createElement(Table, {
        key: count, ref: window.tableRef, height: 700, renderMode: 'canvas', rowKey: 'id',
        columns: Array.from({ length: 58 }, (_, i) => ({ key: 'c' + i, title: '字段' + i, dataIndex: 'c' + i, width: 150, sortable: true,
          fixed: i === 57 ? 'right' : undefined,
          canvasRender: i % 4 === 0 ? value => ({ text: value, background: '#52c41a', color: '#fff' }) : undefined,
          render: i === 57 ? (_value, row) => R.createElement(Button, { variant: 'link', onClick: () => window.actions.push(row.id) }, '查看') : undefined })),
        dataSource: Array.from({ length: count }, (_, id) => Object.fromEntries([['id', id], ...Array.from({ length: 58 }, (_, i) => ['c' + i, `内容${id}-${i}`])])),
        plugins: [createSelectionPlugin({ mode: 'multiple' }), createSortPlugin(), createColumnSettingPlugin()],
      }));
    });
    for (const count of [100, 500, 1000]) {
      await page.evaluate(count => window.mountTable(count), count);
      await page.locator('canvas.sia-table__canvas-layer').waitFor(); await page.waitForTimeout(500);
      assert.equal(await page.locator('.sia-table').getAttribute('data-render-mode'), 'canvas');
      assert(await page.locator('tbody tr').count() < 45);
      await page.locator('tbody').getByRole('checkbox').first().locator('..').click();
      assert.deepEqual(await page.evaluate(() => window.tableRef.current.getSelectedRows().map(r => r.id)), [0]);
      await page.getByRole('button', { name: '查看', exact: true }).first().click();
      assert.equal(await page.evaluate(() => window.actions.at(-1)), 0);
      // 模拟 React 尚未提交的交互单元格，验证骨架可见且提交后自动清除，无需再次滚动。
      const skeleton = await page.evaluate(async () => {
        const cell = document.querySelector('tbody td[data-column-key="c57"]');
        const canvas = document.querySelector('canvas.sia-table__canvas-layer');
        const bounds = cell.getBoundingClientRect(), origin = canvas.getBoundingClientRect();
        const x = Math.round((bounds.left - origin.left + 12) * devicePixelRatio);
        const y = Math.round((bounds.top - origin.top + bounds.height / 2) * devicePixelRatio);
        const alpha = () => canvas.getContext('2d').getImageData(x, y, 1, 1).data[3];
        const settled = () => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
        const children = [...cell.childNodes];
        cell.replaceChildren(); cell.removeAttribute('data-canvas-dom-ready');
        await settled(); const pending = alpha();
        cell.replaceChildren(...children); cell.setAttribute('data-canvas-dom-ready', 'true');
        await settled(); return { pending, ready: alpha() };
      });
      assert(skeleton.pending > 0, '待渲染交互单元格应有骨架');
      assert.equal(skeleton.ready, 0, '交互内容提交后必须清除骨架');
      // 同一次横向滚动事件结束前，普通列 Canvas 文字和原生表头必须移动相同距离。
      const sync = await page.evaluate(() => {
        const viewport = document.querySelector('.sia-table__viewport');
        const head = document.querySelector('th[data-column-key="c1"]');
        const ctx = document.querySelector('canvas.sia-table__canvas-layer').getContext('2d');
        const original = ctx.fillText, positions = [];
        ctx.fillText = function(text, x, y, ...rest) {
          if (text === '内容0-1') positions.push(x);
          return original.call(this, text, x, y, ...rest);
        };
        try {
          viewport.dispatchEvent(new Event('scroll'));
          const before = positions.at(-1), headBefore = head.getBoundingClientRect().left;
          viewport.scrollLeft = 40; viewport.dispatchEvent(new Event('scroll'));
          return { painted: positions.length, canvasDelta: positions.at(-1) - before, headDelta: head.getBoundingClientRect().left - headBefore };
        } finally { ctx.fillText = original; viewport.scrollLeft = 0; viewport.dispatchEvent(new Event('scroll')); }
      });
      assert(sync.painted >= 2, '滚动事件必须立即绘制，不能等到下一 RAF');
      assert.equal(sync.canvasDelta, -40);
      assert.equal(sync.headDelta, sync.canvasDelta);
      const metrics = await page.evaluate(async () => {
        const viewport = document.querySelector('.sia-table__viewport'), ms = [];
        for (let i = 0; i < 12; i++) { const t = performance.now(); viewport.scrollTop = i * 140; viewport.scrollLeft = i * 160; await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))); ms.push(Math.round(performance.now() - t)); }
        return { ms, domContents: document.querySelectorAll('tbody .sia-table__cell-content').length, rows: document.querySelectorAll('tbody tr').length };
      });
      assert(metrics.domContents < 150); assert.deepEqual(await page.evaluate(() => window.tableRef.current.getSelectedRows().map(r => r.id)), [0]);
      // Canvas 文本没有浏览器文字节点，复制应从原生选区插件读取展示值。
      await page.locator('tbody td[data-column-key="c12"]').first().click();
      assert.match(await page.evaluate(() => window.tableRef.current.getPluginApi('cellSelection').getCopyText()), /^内容\d+-12$/);
      assert(await page.locator('tbody .sia-table__cell--range-selected').count() > 0);
      assert(await page.locator('td').count() < 500, '离屏列必须合并占位，不可保留全部单元格');
      await page.locator('th[data-column-key="c12"] .sia-table__sort-button').click();
      assert(await page.evaluate(() => window.tableRef.current.getSortInfo()));
      const resize = page.locator('th[data-column-key="c12"] .sia-table__resize-handle');
      const box = await resize.boundingBox();
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2); await page.mouse.down();
      await page.mouse.move(box.x + box.width / 2 + 40, box.y + box.height / 2, { steps: 4 }); await page.mouse.up();
      assert(await page.evaluate(() => window.tableRef.current.getColumns().find(c => c.key === 'c12').width > 150));
      await page.evaluate(() => window.tableRef.current.openColumnSetting());
      await page.getByRole('dialog').waitFor();
      await page.getByRole('dialog').getByRole('button', { name: '取消', exact: true }).click();
      console.log(JSON.stringify({ count, ...metrics }));
    }
    await page.screenshot({ path: require('node:path').join(require('node:os').tmpdir(), 'sia-canvas-table-validation.png') });
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
