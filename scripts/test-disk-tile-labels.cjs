// 用法：node scripts/test-disk-tile-labels.cjs <包含 playwright 的 node_modules 路径> [开发服务地址]
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require(path.join(process.argv[2], 'playwright'));

async function main() {
  const root = path.resolve(__dirname, '..');
  const app = fs.readFileSync(path.join(root, 'apps/disk-space/src/App.tsx'), 'utf8');
  const minLabelHeight = Number(app.match(/minLabelHeight=\{(\d+)\}/)[1]);
  const component = `/@fs/${root.replaceAll('\\', '/')}/packages/react/src/index.ts`;
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  try {
    const page = await browser.newPage();
    // 使用实际组件、应用样式及应用标签阈值，固定尺寸复现密集网格。
    await page.route('**/src/App.tsx*', route => route.fulfill({
      contentType: 'application/javascript',
      body: `import React from '/node_modules/.vite/deps/react.js';
        import { Treemap } from ${JSON.stringify(component)};
        export default function App() {
          return React.createElement('div', {}, [8, 12, 18, 19.5, 20, 21, 24, 30].map(height =>
            React.createElement(Treemap, {
              key: height, id: 'tile-' + height, className: 'space-treemap',
              style: { width: 44, height, border: 0, marginBottom: 8 },
              data: [{ key: 'sample', label: '中文 Folder gyp', value: 1024, color: '#d7b184' }],
              minLabelWidth: 8, minLabelHeight: ${minLabelHeight},
              minTileWidth: 44, minTileHeight: 24, gap: 0,
              aggregateOverflow: false, showValueInCompactTiles: true,
              valueFormatter: () => '1.00 KB'
            })));
        }`,
    }));
    await page.goto(process.argv[3] || 'http://127.0.0.1:16460/');
    await page.locator('[id="tile-20"] .sia-treemap__tile').waitFor();
    await page.waitForFunction(() => {
      const tile = document.querySelector('[id="tile-24"] .sia-treemap__tile');
      const label = tile?.querySelector('.sia-treemap__label');
      return label && getComputedStyle(label).fontSize === '8px' && tile.getBoundingClientRect().width === 44;
    });
    for (const theme of ['light', 'dark']) {
      await page.evaluate(theme => document.documentElement.dataset.siaTheme = theme, theme);
      for (const height of [12, 18, 19.5, 20, 21, 24, 30]) {
        const tile = page.locator(`[id="tile-${height}"] .sia-treemap__tile`);
        assert.equal(await tile.locator('.sia-treemap__label').count(), 1, `${theme} ${height}px 应显示名称`);
        assert.equal(await tile.locator('.sia-treemap__value').isVisible(), height >= 20, `${height}px 的容量行自适应`);
        const contained = await tile.evaluate(el => {
          const bounds = el.getBoundingClientRect();
          return [...el.querySelectorAll('.sia-treemap__content > span')].every(row => {
            const style = getComputedStyle(row);
            if (style.display === 'none') return true;
            const rect = row.getBoundingClientRect();
            return rect.top >= bounds.top && rect.bottom <= bounds.bottom
              && rect.height >= parseFloat(style.lineHeight) - 0.1;
          });
        });
        assert.ok(contained, `${theme} ${height}px 不得纵向裁剪文字`);
      }
      assert.equal(await page.locator('[id="tile-8"] .sia-treemap__label').count(), 0);
    }
    if (process.env.DISK_TILE_SCREENSHOT) await page.screenshot({ path: process.env.DISK_TILE_SCREENSHOT });
    console.log('PASS：明暗主题下 12–30px 格子显示名称、20px 起显示两行，文字未纵向裁剪。');
  } finally {
    await browser.close();
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
