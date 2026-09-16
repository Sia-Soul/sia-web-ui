const assert = require('node:assert/strict');
const path = require('node:path');
const { chromium } = require(path.join(process.argv[2], 'playwright'));

(async () => {
  const browser = await chromium.launch({ headless: true, channel: 'msedge' });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    await page.goto('http://127.0.0.1:4173/components/dropdown');
    const button = page.getByRole('button', { name: '项目操作', exact: true });
    await button.waitFor();
    assert.equal(await button.locator('.sia-dropdown__trigger-icon').count(), 1);
    assert.equal(await button.locator('.sia-button__icon svg').count(), 1);
    assert(await button.locator('.sia-dropdown__trigger-content').evaluate(node => {
      const text = document.createRange();
      text.selectNodeContents(node.firstChild);
      return node.lastElementChild.getBoundingClientRect().left >= text.getBoundingClientRect().right;
    }));
    await button.click();
    await page.locator('.sia-dropdown__popup.is-open').waitFor();
    await page.locator('.sia-dropdown__popup.is-open').getByText('编辑项目', { exact: true }).click();
    await page.locator('.sia-dropdown__popup.is-open').waitFor({ state: 'hidden' });
    const hover = page.getByRole('button', { name: '悬停展开', exact: true });
    assert.equal(await hover.locator('.sia-dropdown__trigger-icon').count(), 1);
    await hover.hover();
    await page.locator('.sia-dropdown__popup.is-open').waitFor();
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('.sia-dropdown-button .sia-dropdown__trigger-icon').count(), 0);
    for (const arrow of await page.locator('.sia-dropdown-button__arrow').all()) {
      assert.equal(await arrow.locator('svg').count(), 1);
    }
    assert.equal(await page.locator('.dropdown-context-demo .sia-dropdown__trigger-icon').count(), 0);
    await page.locator('.demo-card').filter({ has: page.getByRole('heading', { name: '悬停与多级菜单', exact: true }) }).screenshot({ path: path.join(require('node:os').tmpdir(), 'sia-dropdown-trigger-icon.png') });
    console.log('Dropdown: trailing icon position, existing icon, click/hover menus, split-button single icon and custom trigger passed.');
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
