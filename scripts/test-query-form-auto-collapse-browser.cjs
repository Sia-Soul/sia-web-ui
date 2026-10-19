/** 验证三行临界值、显式覆盖、云配置、响应式布局及手动选择保持。 */
const assert = require('node:assert/strict');
const { chromium } = require(process.argv[2] || 'playwright');
(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1400, height: 1200 } });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto((process.argv[3] || 'http://127.0.0.1:4197') + '/tests/query-form-auto-collapse.html');
    const expectState = async (id, expected) => page.waitForFunction(({ id, expected }) => {
      const row = document.querySelector(`#${id} .sia-query-form__fields`);
      const form = document.querySelector(`#${id} .sia-query-form`);
      const target = row || form?.querySelector('.is-collapsed');
      return !!form && Boolean(target?.classList.contains('is-collapsed')) === expected;
    }, { id, expected });
    for (const id of ['auto', 'more', 'default-closed', 'controlled-closed', 'cloud-empty', 'cloud-closed']) await expectState(id, true);
    for (const id of ['two', 'default-open', 'controlled-open', 'disabled-collapse', 'cloud-open']) await expectState(id, false);
    assert.equal(await page.locator('#events').innerText(), '0');
    await page.getByRole('button', { name: '加宽', exact: true }).click();
    await expectState('auto', false);
    await page.getByRole('button', { name: '缩窄', exact: true }).click();
    await expectState('auto', true);
    await page.getByRole('button', { name: '减少字段', exact: true }).click();
    await expectState('auto', false);
    await page.getByRole('button', { name: '增加字段', exact: true }).click();
    await expectState('auto', true);
    await page.locator('#auto').getByRole('button', { name: /展开/ }).click();
    await expectState('auto', false);
    await page.getByRole('button', { name: '加宽', exact: true }).click();
    await page.getByRole('button', { name: '缩窄', exact: true }).click();
    await expectState('auto', false);
    assert.equal(await page.locator('#events').innerText(), '1');
    assert.deepEqual(errors, []);
    console.log('PASS 两行展开、三行及以上收起、显式覆盖、云记录优先、宽度与字段变化、手动展开保持、自动判断无回调');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
