const assert = require('node:assert/strict');
const path = require('node:path');
const { chromium } = require(path.join(process.argv[2], 'playwright'));

(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: process.argv[3] });
  try {
    const page = await browser.newPage({ viewport: { width: 1500, height: 1000 } });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto('http://127.0.0.1:4173/components/form');
    const form = page.locator('.floating-placeholder-demo');
    await form.waitFor();
    await form.locator('.sia-markdown-editor[data-ready="true"]').waitFor();
    const labels = form.locator('[data-sia-form-field] .sia-floating-placeholder, [data-sia-form-field] .sia-input-control__floating-placeholder, [data-sia-form-field] .sia-input-number__floating-placeholder');
    const positions = () => labels.evaluateAll(elements => elements.map(element => ({ text: element.textContent, top: parseFloat(getComputedStyle(element).top) })));
    assert.equal(await labels.count(), 18);
    assert((await positions()).every(label => label.top > 0), 'Empty fields must show inline placeholders');
    assert.equal(await form.locator('[data-sia-form-field="normal"] .sia-input-control--floating').count(), 0, 'Explicit default mode must override Form');

    for (const name of ['name', 'quantity', 'select', 'tree', 'cascader', 'inputSelect', 'date', 'time', 'notes']) {
      const field = form.locator(`[data-sia-form-field="${name}"]`);
      await field.locator('input, textarea, button').first().focus();
      await page.waitForTimeout(180);
      const top = await field.locator('.sia-floating-placeholder, .sia-input-control__floating-placeholder, .sia-input-number__floating-placeholder').first().evaluate(element => parseFloat(getComputedStyle(element).top));
      assert.equal(top, 0, `${name} must float on focus`);
      await page.evaluate(() => document.activeElement?.blur());
    }
    // Search inputs live in portals, so the trigger must stay raised after focus leaves it.
    const tree = form.locator('[data-sia-form-field="tree"]');
    await tree.locator('.sia-tree-select__trigger').click();
    await page.locator('.sia-tree-select__search input').focus();
    await page.waitForTimeout(180);
    assert.equal(await tree.locator('.sia-floating-placeholder').evaluate(el => getComputedStyle(el).top), '0px');
    await tree.locator('.sia-tree-select__trigger').click();
    const inputSelect = form.locator('[data-sia-form-field="inputSelect"]');
    await inputSelect.locator('input').click();
    await page.locator('.sia-input-select__popup input').focus();
    await page.waitForTimeout(180);
    assert.equal(await inputSelect.locator('.sia-input-control__floating-placeholder').evaluate(el => getComputedStyle(el).top), '0px');

    await form.getByRole('button', { name: '填入示例值', exact: true }).click();
    await page.waitForTimeout(250);
    assert((await positions()).every(label => label.top === 0), 'Filled fields including zero, arrays and editors must stay raised');
    assert(await labels.evaluateAll(elements => elements.every(element => Number(getComputedStyle(element).zIndex) >= 20)), 'All floating labels must paint above ordinary overlapping content');
    assert.equal(await form.locator('[data-sia-form-field="quantity"] input').inputValue(), '0');
    assert.equal(await form.locator('.sia-select__trigger.sia-placeholder-floating').first().evaluate(el => getComputedStyle(el).overflow), 'visible', 'Select must not clip the label');
    await form.getByRole('button', { name: '清空并重置', exact: true }).click();
    await page.waitForTimeout(250);
    assert((await positions()).every(label => label.top > 0), 'Reset must return every empty label to its placeholder position');

    // Verify real editor input updates, not just form.setFieldsValue.
    for (const name of ['rich', 'markdown']) {
      const field = form.locator(`[data-sia-form-field="${name}"]`);
      const editor = field.locator('[contenteditable="true"]').first();
      await editor.click();
      await page.keyboard.insertText('输入内容');
      await page.waitForTimeout(400);
      await form.getByRole('button', { name: '清空并重置', exact: true }).focus();
      await page.waitForTimeout(250);
      assert.equal(await field.locator('.sia-floating-placeholder').evaluate(el => getComputedStyle(el).top), '0px', `${name} must retain its label after typing and blur`);
      await editor.click();
      await page.keyboard.press('ControlOrMeta+A');
      await page.keyboard.press('Backspace');
      await form.getByRole('button', { name: '清空并重置', exact: true }).focus();
      await page.waitForTimeout(250);
      assert(parseFloat(await field.locator('.sia-floating-placeholder').evaluate(el => getComputedStyle(el).top)) > 0, `${name} must return after deletion`);
    }
    assert.deepEqual(errors, []);
    console.log('PASS: 18 floating labels; Form inheritance and explicit override; focus and portal focus; zero, multiple and range values; fill/reset; real editor typing/deletion; no runtime errors.');
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
