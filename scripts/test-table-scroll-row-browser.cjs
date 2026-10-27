// 真实浏览器验证按行定位，覆盖虚拟窗口、排序后的索引、表头避让和横向位置保留。
const assert = require('node:assert/strict');
const path = require('node:path');
const { chromium } = require(path.join(process.argv[2], 'playwright-core'));
(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 900, height: 700 } });
    await page.goto('http://127.0.0.1:4173/components/table');
    await page.evaluate(async () => {
      const { default: React } = await import('/node_modules/.vite/deps/react.js');
      const { default: { createRoot } } = await import('/node_modules/.vite/deps/react-dom_client.js');
      const { Table } = await import('/@fs/C:/Users/12235/Documents/SiaWebUI/packages/react/src/components/Table/Table.tsx');
      const { createSummaryPlugin } = await import('/@fs/C:/Users/12235/Documents/SiaWebUI/packages/react/src/components/Table/plugins.tsx');
      const host = document.createElement('div');
      document.body.replaceChildren(host);
      const root = createRoot(host);
      window.rowTable = React.createRef();
      window.mountRows = (count, reverse = false, mode = 'dom', sticky = true, summary = false) => {
        const data = Array.from({ length: count }, (_, id) => ({ id, name: `商品${id}` }));
        if (reverse) data.reverse();
        root.render(React.createElement(Table, {
          ref: window.rowTable, rowKey: 'id', showIndex: false, maxBodyHeight: 180,
          renderMode: mode, stickyHeader: sticky,
          plugins: summary ? [createSummaryPlugin({ total: { name: '总计' } })] : [],
          columns: [{ key: 'group', title: '商品信息', children: [{ key: 'name', dataIndex: 'name', title: '商品名称', width: 1200 }] }],
          dataSource: data,
        }));
      };
    });
    const mount = async (...args) => {
      await page.evaluate(args => window.mountRows(...args), args);
      await page.waitForFunction(count => window.rowTable.current?.getRows().length === count, args[0]);
      await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    };
    const locate = async (key, sticky = true) => {
      assert.equal(await page.evaluate(key => window.rowTable.current.scrollToRow(key), key), true);
      await page.waitForFunction(({ key, sticky }) => {
        const viewport = document.querySelector('.sia-table__viewport');
        const row = Array.from(document.querySelectorAll('tr[data-row-key]')).find(row => row.dataset.rowKey === String(key));
        if (!row) return false;
        const bounds = viewport.getBoundingClientRect(), rect = row.getBoundingClientRect();
        const inset = sticky ? document.querySelector('thead').offsetHeight : 0;
        const footerInset = document.querySelector('tfoot')?.offsetHeight ?? 0;
        return rect.top >= bounds.top + inset - 1 && rect.bottom <= bounds.top + viewport.clientHeight - footerInset + 1;
      }, { key, sticky });
    };
    for (const mode of ['dom', 'canvas']) {
      await mount(500, false, mode);
      await page.locator('.sia-table__viewport').evaluate(e => { e.scrollLeft = 80; });
      for (const key of [0, 6, 51, 250, 499, 0]) await locate(key);
      assert.equal(await page.locator('.sia-table__viewport').evaluate(e => e.scrollLeft), 80);
      const before = await page.locator('.sia-table__viewport').evaluate(e => e.scrollTop);
      await locate(0);
      assert.equal(await page.locator('.sia-table__viewport').evaluate(e => e.scrollTop), before);
      assert.equal(await page.evaluate(() => window.rowTable.current.scrollToRow('missing')), false);
      console.log(`PASS ${mode}：首行、跨虚拟窗口、中间行、末行、回首行、横向位置、已可见不移动、无效键`);
    }
    await mount(500, true);
    await locate(0);
    await locate(499);
    console.log('PASS 反向排序后仍按稳定行键定位');
    await mount(500, false, 'dom', true, true);
    await locate(250);
    await locate(499);
    console.log('PASS 多层表头和底部合计同时避让');
    await mount(500);
    // 模拟连续处理和用户手动滚回顶部：下一项处理时必须恢复跟随，不能只定位第一次。
    for (let key = 0; key < 500; key++) {
      if (key === 250) await page.locator('.sia-table__viewport').evaluate(e => { e.scrollTop = 0; });
      await locate(key);
    }
    console.log('PASS 连续500项逐项可见，手动滚动后下一项恢复定位');
    await mount(20);
    await locate(19);
    await locate(0);
    await mount(20, false, 'dom', false);
    await locate(19, false);
    await locate(0, false);
    console.log('PASS 非虚拟列表与非吸顶表头');
    await mount(0);
    assert.equal(await page.evaluate(() => window.rowTable.current.scrollToRow(0)), false);
    await mount(20);
    await page.locator('.sia-table').evaluate(e => { e.style.display = 'none'; });
    assert.equal(await page.evaluate(() => window.rowTable.current.scrollToRow(10)), false);
    await page.locator('.sia-table').evaluate(e => { e.style.display = ''; });
    await locate(10);
    console.log('PASS 空数据、隐藏后重新显示定位');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
