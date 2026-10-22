const assert = require('node:assert/strict');
const { chromium } = require(process.argv[2] || 'playwright');

// 用真实焦点和键盘输入验证打开行为，关闭完成后核对焦点归还。
(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  try {
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto((process.argv[3] || 'http://127.0.0.1:4197') + '/tests/modal-autofocus.html');
    const focused = async locator => {
      await locator.waitFor();
      await page.waitForFunction(el => el === document.activeElement, await locator.elementHandle());
    };
    const parent = page.getByRole('dialog', { name: '父弹框', exact: true });
    for (let i = 0; i < 2; i++) {
      const trigger = page.getByRole('button', { name: '默认', exact: true });
      await trigger.click();
      await focused(parent.getByLabel('首个输入', { exact: true }));
      await page.keyboard.type('hello');
      assert.equal(await parent.getByLabel('首个输入', { exact: true }).inputValue(), 'hello');
      await parent.getByRole('button', { name: '打开子弹框' }).click();
      const child = page.getByRole('dialog', { name: '子弹框', exact: true });
      await focused(child.getByLabel('子输入'));
      await page.keyboard.press('Escape');
      await child.waitFor({ state: 'detached' });
      await focused(parent.getByRole('button', { name: '打开子弹框' }));
      await page.keyboard.press('Escape');
      await parent.waitFor({ state: 'detached' });
      await focused(trigger);
    }
    for (const [mode, selector] of [['关闭自动聚焦', '.sia-modal__close'], ['无输入', '.sia-modal__close'], ['显式焦点', 'input[aria-label="第二个输入"]'], ['选择器', '[role="combobox"]']]) {
      await page.getByRole('button', { name: mode, exact: true }).click();
      await focused(parent.locator(selector));
      await parent.getByRole('button', { name: '取消', exact: true }).click();
      await parent.waitFor({ state: 'detached' });
    }
    await page.getByRole('button', { name: '静态调用' }).click();
    await focused(page.getByLabel('静态输入'));
    await page.keyboard.press('Escape');
    await page.getByRole('dialog', { name: '静态', exact: true }).waitFor({ state: 'detached' });
    assert.deepEqual(errors, []);
    console.log('PASS 首个可用输入、直接键入、重开、禁用/隐藏/只读跳过、显式焦点、选择器、静态调用、嵌套焦点归还');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
