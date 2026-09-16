const assert = require('node:assert/strict');
const { chromium } = require(require('node:path').join(process.argv[2], 'playwright'));
(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: process.argv[3] });
  try {
    const page = await browser.newPage();
    await page.goto('http://127.0.0.1:4173/components/select');
    const trigger = page.getByRole('combobox', { name: '弹框多选标签', exact: true });
    const dialog = page.getByRole('dialog');
    await trigger.click();
    await dialog.getByText('移除以下标签', { exact: true }).click();
    await dialog.getByRole('textbox', { name: '操作备注', exact: true }).fill('批量移除测试');
    await dialog.getByRole('option', { name: '标签 1', exact: true }).click();
    await dialog.getByRole('button', { name: '取消', exact: true }).click();
    await dialog.waitFor({ state: 'hidden' });
    assert.equal(await page.locator('[aria-label="扩展确认结果"]').innerText(), '');
    await trigger.click();
    await dialog.getByRole('option', { name: '标签 2', exact: true }).click();
    await dialog.getByRole('button', { name: '确定', exact: true }).click();
    await dialog.waitFor({ state: 'hidden' });
    const result = JSON.parse(await page.locator('[aria-label="扩展确认结果"]').innerText());
    assert.deepEqual(result.value, [1]);
    assert.equal(result.option[0].label, '标签 2');
    assert.deepEqual(result.extraValues, { action: 'remove', remark: '批量移除测试' });
    assert.match(await trigger.innerText(), /标签 2/);

    // Exercise the imperative API with live updates, false/async confirmation.
    await page.evaluate(async () => {
      const { openSelectModal } = await import('/@fs/C:/Users/12235/Documents/SiaWebUI/packages/react/src/components/SelectModal.tsx');
      window.extraCalls = [];
      window.extraHandle = openSelectModal({
        title: '扩展数据回归', options: [{ value: 'a', label: '选项 A' }], value: 'a',
        headerExtra: '自定义扩展区域', extraValues: { action: 'old' },
        onConfirm: (...args) => { window.extraCalls.push(args); return false; },
      });
      window.extraHandle.update({ extraValues: { action: 'updated', enabled: true } });
    });
    await dialog.getByRole('button', { name: '确定', exact: true }).click();
    assert.equal(await dialog.isVisible(), true);
    assert.deepEqual(await page.evaluate(() => window.extraCalls[0]), ['a', { value: 'a', label: '选项 A' }, { action: 'updated', enabled: true }]);
    await page.evaluate(() => window.extraHandle.update({ onConfirm: (...args) => {
      window.extraCalls.push(args); return new Promise(resolve => { window.finishExtraConfirm = resolve; });
    } }));
    await dialog.getByRole('button', { name: '确定', exact: true }).click();
    assert.equal(await dialog.isVisible(), true);
    await page.evaluate(() => window.finishExtraConfirm(true));
    await dialog.waitFor({ state: 'hidden' });
    console.log('PASS: wrapped multiple controls, latest values, selection details, cancel, imperative updates, false and async confirmation');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
