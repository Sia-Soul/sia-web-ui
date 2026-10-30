// 在真实文档页面验证默认入口、主题同步、受控范围和标题栏交互隔离。
const assert = require('node:assert/strict');
const path = require('node:path');
const modules = process.argv[2] || path.join(process.env.USERPROFILE, '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules');
const { chromium } = require(path.join(modules, 'playwright'));

(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } });
    await page.goto(`${process.env.DOCS_TEST_URL || 'http://127.0.0.1:4173'}/components/window-frame`);
    const frame = page.locator('.window-frame-demo__frame');
    const toggle = frame.getByRole('switch');
    await toggle.waitFor();
    await page.evaluate(() => { document.documentElement.dataset.siaTheme = 'light'; });
    await page.waitForFunction(() => document.querySelector('.window-frame-demo__frame [role="switch"]')?.getAttribute('aria-checked') === 'false');
    assert.equal(await toggle.count(), 1);
    const before = await frame.locator('.sia-tag').innerText();
    await toggle.click();
    assert.equal(await page.evaluate(() => document.documentElement.dataset.siaTheme), 'dark');
    assert.equal(await toggle.getAttribute('aria-checked'), 'true');
    assert.equal(await frame.locator('.sia-tag').innerText(), before, '点击主题不触发窗口操作');
    // 键盘入口可逆，且多个主题入口跟随外部文档变化。
    await toggle.focus();
    await page.keyboard.press('Space');
    assert.equal(await page.evaluate(() => document.documentElement.dataset.siaTheme), 'light');
    await page.evaluate(() => { document.documentElement.dataset.siaTheme = 'dark'; });
    await page.waitForFunction(() => document.querySelector('.window-frame-demo__frame [role="switch"]')?.getAttribute('aria-checked') === 'true');
    const local = page.locator('.window-frame-theme-demo');
    assert.equal(await local.getAttribute('data-sia-theme'), 'light');
    await local.getByRole('switch').click();
    assert.equal(await local.getAttribute('data-sia-theme'), 'dark');
    await local.getByRole('switch').click();
    assert.equal(await local.getAttribute('data-sia-theme'), 'light');
    assert.equal(await page.evaluate(() => document.documentElement.dataset.siaTheme), 'dark', '受控局部主题不改变文档');
    await page.getByText('显示标题栏主题按钮', { exact: true }).click();
    assert.equal(await local.getByRole('switch').count(), 0);
    await page.getByText('显示标题栏主题按钮', { exact: true }).click();
    assert.equal(await local.getByRole('switch').count(), 1);
    // 调整业务动作位置不会把默认主题入口移到左侧。
    await page.getByText('居左', { exact: true }).click();
    assert.ok(await frame.locator('.sia-window-titlebar').evaluate(bar => {
      const theme = bar.querySelector('.sia-window-titlebar__theme');
      return theme.nextElementSibling?.classList.contains('sia-window-controls');
    }));
    if (process.env.WINDOW_THEME_SCREENSHOT) await frame.screenshot({ path: process.env.WINDOW_THEME_SCREENSHOT });
    console.log('PASS WindowTitleBar: 默认入口、鼠标/键盘切换、外部同步、受控局部主题、隐藏入口及窗口动作隔离。');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
