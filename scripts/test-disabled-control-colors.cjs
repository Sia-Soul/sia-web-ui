// 检查最终截图像素和祖先透明度，避免 CSS 色值一致但合成后的背景、边框深浅不同。
const assert = require('node:assert/strict');
const path = require('node:path');
const modules = process.argv[2] || path.join(process.env.USERPROFILE, '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules');
const { chromium } = require(path.join(modules, 'playwright'));
const sharp = require(path.join(modules, 'sharp'));
(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1400, height: 1100 } });
    await page.goto(`${process.env.DOCS_TEST_URL || 'http://127.0.0.1:4173'}/components/form`);
    const demo = page.locator('.disabled-controls-demo');
    await demo.waitFor();
    const selectors = ['.sia-input-control', '.sia-input-number', '.sia-select__trigger', '.sia-picker:not(.sia-time-picker)', '.sia-time-picker', '.sia-tree-select__trigger', '.sia-cascader__trigger', '.sia-number-range', '.sia-time-range', '.sia-textarea-control'];
    for (const theme of ['light', 'dark']) {
      await page.evaluate(theme => document.documentElement.dataset.siaTheme = theme, theme);
      const colors = theme === 'light' ? [253, 240] : [48, 73];
      for (const selector of selectors) {
        const node = demo.locator(selector).first();
        await node.hover({ force: true });
        await page.waitForTimeout(160);
        const state = await node.evaluate(node => {
          let opacity = 1;
          for (let current = node; current; current = current.parentElement) opacity *= Number(getComputedStyle(current).opacity);
          const css = getComputedStyle(node);
          return { opacity, background: css.backgroundColor, border: css.borderTopColor };
        });
        assert.equal(state.opacity, 1, `${theme} ${selector} 不得由祖先叠加透明度`);
        assert.equal(state.background, `rgb(${colors[0]}, ${colors[0]}, ${colors[0]})`);
        assert.equal(state.border, `rgb(${colors[1]}, ${colors[1]}, ${colors[1]})`);
        const { data, info } = await sharp(await node.screenshot()).removeAlpha().raw().toBuffer({ resolveWithObject: true });
        const pixel = (x, y) => [...data.subarray((y * info.width + x) * info.channels, (y * info.width + x) * info.channels + 3)];
        assert.deepEqual(pixel(8, 5), [colors[0], colors[0], colors[0]], `${theme} ${selector} 背景实际像素`);
        // 浮点布局可能使边框落在相邻像素，检查上边中央三行内的实际边框色。
        assert.ok([0, 1, 2].some(y => pixel(Math.floor(info.width / 2), y).every(value => value === colors[1])), `${theme} ${selector} 边框实际像素`);
      }
      if (process.env.DISABLED_SCREENSHOT_DIR) await demo.screenshot({ path: path.join(process.env.DISABLED_SCREENSHOT_DIR, `disabled-controls-${theme}.png`) });
    }
    // 配色统一不改变禁用行为；恢复启用后保留当前值。
    const input = demo.locator('input').first();
    assert.equal(await input.isDisabled(), true);
    await page.getByRole('switch', { name: '禁用控件' }).click({ force: true });
    assert.equal(await input.isEnabled(), true);
    assert.equal(await input.inputValue(), '商品名称');
    console.log('PASS 十类禁用控件：亮暗主题的背景/边框实际像素一致、无透明度叠加、悬停稳定、恢复启用保留值。');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
