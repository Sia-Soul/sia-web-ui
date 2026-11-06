// 回归真实鼠标选字、常显排序与滚轮同步，不向任何业务接口写入数据。
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const { chromium } = require(path.join(process.argv[2], 'playwright'));
(async () => {
  const browser = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: false });
  const failures = [], checks = [];
  const check = (name, fn) => { try { fn(); checks.push(name); } catch (e) { failures.push(`${name}: ${e.message}`); } };
  try {
    fs.mkdirSync('logs/table-feedback', { recursive: true });
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, recordVideo: { dir: 'logs/table-feedback', size: { width: 1440, height: 900 } } });
    await page.goto('http://127.0.0.1:4173/components/table');
    await page.evaluate(async () => {
      const { default: R } = await import('/node_modules/.vite/deps/react.js');
      const { default: { createRoot } } = await import('/node_modules/.vite/deps/react-dom_client.js');
      const { Table, createSortPlugin } = await import('/@fs/C:/Users/12235/Documents/SiaWebUI/packages/react/src/components/Table/index.ts');
      document.body.innerHTML = ''; const host = document.createElement('div'); document.body.append(host);
      createRoot(host).render(R.createElement(Table, { height: 700, renderMode: 'canvas', rowKey: 'id',
        columns: Array.from({ length: 40 }, (_, i) => ({ key: 'c' + i, dataIndex: 'c' + i, title: '销售数据同步方式' + i, width: 180, sortable: true,
          fixed: i < 2 ? 'left' : i === 39 ? 'right' : undefined,
          canvasRender: i === 3 ? value => ({ text: value, background: '#237b38', color: '#fff' }) : undefined })),
        dataSource: Array.from({ length: 5000 }, (_, id) => Object.fromEntries([['id', id], ...Array.from({ length: 40 }, (_, i) => ['c' + i, `编号${id}公司测试${i}`])])),
        plugins: [createSortPlugin()],
      }));
    });
    const cell = page.locator('tbody td[data-column-key="c0"]').first(); await cell.waitFor();
    await cell.hover(); await page.waitForTimeout(100);
    const box = await cell.boundingBox();
    await page.mouse.move(box.x + 10, box.y + box.height / 2); await page.mouse.down();
    await page.mouse.move(box.x + 85, box.y + box.height / 2, { steps: 12 }); await page.mouse.up();
    const selected = await page.evaluate(() => getSelection().toString());
    check('Canvas 固定列支持局部文字选取', () => assert(selected.length > 0));
    await page.screenshot({ path: 'logs/table-feedback/text-selection.png' });
    // 横跨单元格仍须框选，不能被新加入的原生文字层阻挡。
    const next = await page.locator('tbody tr').nth(1).locator('td[data-column-key="c1"]').boundingBox();
    await page.mouse.move(box.x + 14, box.y + box.height / 2); await page.mouse.down();
    await page.mouse.move(next.x + 60, next.y + next.height / 2, { steps: 12 }); await page.mouse.up();
    const nativeRange = await page.evaluate(() => getSelection().toString());
    check('跨格时清除局部文字选区', () => assert.equal(nativeRange, ''));
    const range = await page.locator('tbody .sia-table__cell--range-selected').count();
    check('矩形框选覆盖四个单元格', () => assert.equal(range, 4));
    const position = await page.locator('.sia-table__sort-button').first().evaluate(el => getComputedStyle(el).position);
    check('排序按钮参与标题布局', () => assert.notEqual(position, 'absolute'));
    const sort = page.locator('th[data-column-key="c0"] .sia-table__sort-button');
    await sort.focus();
    const opacity = await sort.evaluate(el => getComputedStyle(el).opacity);
    check('排序入口聚焦时可见', () => assert.equal(opacity, '1'));
    await page.keyboard.press('Enter'); await page.mouse.move(1100, 800);
    const order = await sort.getAttribute('data-sort-order');
    check('键盘排序切换升序', () => assert.equal(order, 'ascend'));
    await page.screenshot({ path: 'logs/table-feedback/sorted.png' });
    await sort.click(); await sort.click();
    await page.mouse.move(800, 300);
    await page.evaluate(() => {
      window.wheels = []; window.paintOffsets = [];
      const ctx = document.querySelector('canvas.sia-table__canvas-layer').getContext('2d'), original = ctx.fillText;
      ctx.fillText = function(text, x, y, ...rest) {
        if (text === '编号0公司测试3') {
          const head = document.querySelector('th[data-column-key="c3"]'), canvas = document.querySelector('canvas.sia-table__canvas-layer');
          const padding = parseFloat(getComputedStyle(document.querySelector('td[data-column-key]')).paddingLeft);
          window.paintOffsets.push(x - (head.getBoundingClientRect().left - canvas.getBoundingClientRect().left + padding + 8));
        }
        return original.call(this, text, x, y, ...rest);
      };
      document.addEventListener('wheel', e => window.wheels.push(e.defaultPrevented));
    });
    for (let i = 0; i < 8; i++) {
      await page.mouse.wheel(80, 0); await page.waitForTimeout(30);
      if (i < 3) await page.screenshot({ path: `logs/table-feedback/wheel-${i}.png` });
    }
    const wheel = await page.evaluate(() => ({ left: document.querySelector('.sia-table__viewport').scrollLeft, events: window.wheels }));
    check('Canvas 滚轮由同步绘制路径处理', () => { assert(wheel.left > 0); assert(wheel.events.every(Boolean)); });
    const offsets = await page.evaluate(() => window.paintOffsets);
    check('滚轮每次绘制与表头位置一致', () => { assert(offsets.length > 0); assert(offsets.every(x => Math.abs(x) < 1)); });
    fs.mkdirSync('logs/table-feedback', { recursive: true });
    await page.screenshot({ path: 'logs/table-feedback/table.png' });
    await page.setViewportSize({ width: 1000, height: 800 }); await page.mouse.wheel(-240, 0); await page.waitForTimeout(100);
    await page.screenshot({ path: 'logs/table-feedback/narrow.png' });
    await page.close();
    fs.writeFileSync('logs/table-feedback/result.json', JSON.stringify({ checks, failures, selected, wheel }, null, 2));
    console.log(JSON.stringify({ checks, failures }));
    assert.equal(failures.length, 0);
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
