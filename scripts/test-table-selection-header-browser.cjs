/** 对比滚动后表头的真实像素，确保正文选区不会穿透普通、分组或固定列表头。 */
const assert = require('node:assert/strict');
const path = require('node:path');
const { chromium } = require(path.join(process.argv[2], 'playwright'));

(async () => {
  const browser = await chromium.launch({ headless: true, channel: 'msedge' });
  try {
    const page = await browser.newPage({ viewport: { width: 1100, height: 700 } });
    await page.goto('http://127.0.0.1:4173/components/table');
    await page.evaluate(async (sourcePath) => {
      const { default: React } = await import('/node_modules/.vite/deps/react.js');
      const { default: { createRoot } } = await import('/node_modules/.vite/deps/react-dom_client.js');
      const { Table, createCellSelectionPlugin } = await import('/@fs/' + sourcePath + '/packages/react/src/index.ts');
      const host = document.createElement('div');
      host.style = 'position:fixed;inset:0;z-index:10000;background:white;padding:30px';
      document.body.append(host);
      window.renderSelectionFixture = (grouped) => {
        const columns = [
          { key: 'left', dataIndex: 'text', title: '固定左列', fixed: 'left', width: 160 },
          { key: 'text', dataIndex: 'text', title: '操作内容', width: 500 },
          { key: 'other', dataIndex: 'text', title: '其他内容', width: 500 },
          { key: 'right', dataIndex: 'text', title: '固定右列', fixed: 'right', width: 160 },
        ];
        window.selectionFixtureRoot ??= createRoot(host);
        window.selectionFixtureRoot.render(React.createElement(Table, {
          key: String(grouped), className: 'selection-header-fixture', rowKey: 'id',
          height: 320, virtual: false, stickyHeader: true, pagination: false,
          columns: grouped ? [columns[0], { key: 'group', title: '操作记录', children: columns.slice(1, 3) }, columns[3]] : columns,
          dataSource: Array.from({ length: 35 }, (_, id) => ({ id, text: `操作记录 ${id}` })),
          plugins: [createCellSelectionPlugin({ defaultRange: { anchor: { rowKey: 0, columnKey: 'text' }, focus: { rowKey: 8, columnKey: 'other' } } })],
        }));
      };
      window.renderSelectionFixture(false);
    }, path.resolve(__dirname, '..').replaceAll('\\', '/'));
    // 固定列阴影随横向滚动渐显；禁用装饰过渡，避免像素对照受时间差影响。
    await page.addStyleTag({ content: '.selection-header-fixture *, .selection-header-fixture *::before, .selection-header-fixture *::after { transition: none !important; }' });
    for (const grouped of [false, true]) {
      if (grouped) await page.evaluate(() => window.renderSelectionFixture(true));
      const table = page.locator('.selection-header-fixture');
      await table.locator('.sia-table__cell--range-selected').first().waitFor();
      const viewport = table.locator('.sia-table__viewport');
      await viewport.evaluate(el => { el.scrollTop = 95; el.scrollLeft = 180; });
      await page.mouse.move(1080, 680);
      await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
      const clip = await table.evaluate(el => {
        const view = el.querySelector('.sia-table__viewport').getBoundingClientRect();
        const heads = [...el.querySelectorAll('thead th')].map(th => th.getBoundingClientRect());
        return { x: view.x + 2, y: view.y + 2, width: view.width - 4, height: Math.max(...heads.map(rect => rect.bottom)) - view.y - 4 };
      });
      const selected = await page.screenshot({ clip });
      // 只隐藏正文选区描边作为对照，表头自身选择效果和布局不变。
      const override = await page.addStyleTag({ content: '.selection-header-fixture .sia-table__cell--range-selected::after { visibility: hidden !important; }' });
      const reference = await page.screenshot({ clip });
      await override.evaluate(el => el.remove());
      // 用旧层级作负对照，确认截图区域确实能捕捉曾经越过表头的正文边框。
      const legacy = await page.addStyleTag({ content: '.selection-header-fixture .sia-table__cell--range-selected::after { z-index: 7; }' });
      const legacyImage = await page.screenshot({ clip });
      await legacy.evaluate(el => el.remove());
      assert(!legacyImage.equals(reference), '负对照必须能够复现旧层级的选区穿透');
      // 失败时保留像素对照，便于区分布局变化与真实的描边穿透。
      if (!selected.equals(reference)) {
        const fs = require('node:fs');
        fs.writeFileSync(path.join(require('node:os').tmpdir(), 'sia-header-selected.png'), selected);
        fs.writeFileSync(path.join(require('node:os').tmpdir(), 'sia-header-reference.png'), reference);
        console.log(clip);
      }
      assert(selected.equals(reference), `${grouped ? '分组' : '普通'}表头被正文选区边框覆盖`);
      assert(await table.locator('.sia-table__cell--range-selected').count() > 0, '滚动后选区应保留');
    }
    console.log('PASS 滚动选区保留，普通、分组及左右固定列表头均遮住正文选区描边');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
