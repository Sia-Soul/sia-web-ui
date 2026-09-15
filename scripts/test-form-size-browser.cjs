const assert = require('node:assert/strict');
const path = require('node:path');
const { chromium } = require(path.join(process.argv[2], 'playwright'));

(async () => {
  const browser = await chromium.launch({ headless: true, channel: 'msedge' });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1200 } });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto('http://127.0.0.1:4173/components/form');
    const form = page.locator('.form-size-demo');
    await form.waitFor();
    const field = key => form.locator(`[data-size-control="${key}"]`);
    const sizes = page.getByRole('radiogroup', { name: '表单尺寸', exact: true });
    const height = locator => locator.evaluateAll(elements => elements.map(element => element.getBoundingClientRect().height));
    async function checkHeight(locator, expected, label) {
      const actual = await height(locator);
      assert(actual.length > 0, `${label}: no controls found`);
      assert(actual.every(value => Math.abs(value - expected) < .1), `${label}: expected ${expected}px, got ${actual}`);
    }
    await checkHeight(sizes, 30, 'Default size outside Form');
    await field('input').locator('input').fill('切换尺寸保留内容');
    await field('select').getByRole('combobox').click();
    await page.getByRole('option', { name: '研发', exact: true }).click();
    await field('checkbox').getByText('研发', { exact: true }).click();
    await field('radio').getByText('研发', { exact: true }).click();
    await field('switch').getByText('启用', { exact: true }).click();

    const singleLine = {
      input: '.sia-input-control', number: '.sia-input-number', 'input-select': '.sia-input-control',
      select: '.sia-select__trigger', 'multiple-select': '.sia-select__trigger', tree: '.sia-tree-select__trigger',
      cascader: '.sia-cascader__trigger', 'multiple-cascader': '.sia-cascader__trigger', date: '.sia-picker', 'date-range': '.sia-picker', time: '.sia-picker',
      'time-range': '.sia-time-range', 'select-date-range': '.sia-select__trigger, .sia-picker',
      'radio-button': '.sia-radio--button', 'switch-segmented': '.sia-switch', color: '.sia-color-picker__trigger',
      segmented: '.sia-segmented', button: '.sia-button', pagination: '.sia-button, .sia-select__trigger',
    };
    for (const floating of [false, true]) {
      if (floating) {
        // Populate date controls through their actual popups, then verify selected-value typography.
        for (const key of ['date', 'date-range', 'select-date-range']) {
          await field(key).locator('.sia-picker__trigger').click();
          const calendar = page.locator('.sia-date-panel:visible').first();
          const day = calendar.getByRole('button', { name: /^\d{4}-\d{2}-\d{2}$/ }).filter({ visible: true }).first();
          const dateLabel = await day.getAttribute('aria-label');
          await day.click();
          if (key !== 'date') await calendar.getByRole('button', { name: dateLabel, exact: true }).first().click();
          assert(!(await field(key).locator('.sia-picker__value.is-placeholder, .sia-picker-range-control__value.is-placeholder').count()));
        }
        await field('time').locator('input').click();
        await page.locator('.sia-time-panel').getByRole('button', { name: '此刻', exact: true }).click();
        await page.locator('.sia-time-panel').getByRole('button', { name: '确定', exact: true }).click();
        assert((await field('time').locator('input').inputValue()).length > 0);
        await page.getByText('浮动占位符', { exact: true }).click();
      }
      await field('input').locator('input').fill('切换尺寸保留内容');
      for (const [index, size] of ['small', 'medium', 'large'].entries()) {
        await sizes.getByRole('radio', { name: new RegExp(`^${size}`) }).click();
        for (const [key, selector] of Object.entries(singleLine)) {
          await checkHeight(field(key).locator(selector), [22, 30, 38][index], `${size}/${floating}/${key}`);
        }
        for (const key of ['date', 'date-range', 'time', 'time-range', 'select-date-range']) {
          const fonts = await field(key).locator('.sia-picker__value, .sia-picker-range-control__value, .sia-picker-range-control__separator, .sia-time-range__separator, input, .sia-floating-placeholder').evaluateAll(nodes => nodes.flatMap(node => [
            parseFloat(getComputedStyle(node).fontSize),
            ...(node.tagName === 'INPUT' ? [parseFloat(getComputedStyle(node, '::placeholder').fontSize)] : []),
          ]));
          assert(fonts.length > 0 && fonts.every(value => value === [12, 14, 16][index]), `${size}/${key}: expected ${[12, 14, 16][index]}px text, got ${fonts}`);
        }
        for (const key of ['checkbox', 'radio']) {
          await checkHeight(field(key).locator(`.sia-${key}__control`), [14, 16, 18][index], key);
          const overrides = await height(field(`override-${key}`).locator(`.sia-${key}__control`));
          assert.deepEqual(overrides, [18, 14], `${key}: group size and individual size take priority`);
        }
        for (const key of ['multiple-select', 'tree', 'multiple-cascader']) {
          assert(await field(key).evaluate(wrapper => {
            const trigger = wrapper.querySelector('button');
            const rect = trigger.getBoundingClientRect();
            return [...trigger.querySelectorAll('.sia-select__tag, .sia-tree-select__tag, .sia-cascader__tag')].every(tag => {
              const tagRect = tag.getBoundingClientRect();
              return tagRect.top >= rect.top && tagRect.bottom <= rect.bottom;
            });
          }), `${size}/${key}: selected tags must fit the trigger`);
        }
        for (const key of ['switch', 'switch-text']) {
          await checkHeight(field(key).locator('.sia-switch'), [16, 22, 28][index], key);
          // The thumb must fit inside its track, including the unchecked position.
          assert(await field(key).locator('.sia-switch').evaluate(track => {
            const rect = track.getBoundingClientRect();
            const thumb = track.querySelector('.sia-switch__thumb').getBoundingClientRect();
            return thumb.top >= rect.top && thumb.bottom <= rect.bottom && thumb.left >= rect.left && thumb.right <= rect.right;
          }));
        }
        const starSizes = await field('rate').locator('.sia-rate__item button').evaluateAll(nodes => nodes.map(node => parseFloat(getComputedStyle(node).fontSize)));
        assert(starSizes.every(value => value === [15, 20, 25][index]));
        assert.equal(await field('textarea').locator('textarea').evaluate(node => parseFloat(getComputedStyle(node).fontSize)), [12, 14, 16][index]);
        await checkHeight(field('override-button').locator('.sia-button'), 22, 'Explicit small');
        await checkHeight(field('override-input').locator('.sia-input-control'), 38, 'Explicit large');
        assert.equal(await field('input').locator('input').inputValue(), '切换尺寸保留内容');
        assert.equal(await field('select').getByRole('combobox').textContent(), floating ? '研发选择部门' : '研发');
        assert(await field('checkbox').getByLabel('研发').isChecked());
        assert(await field('radio').getByLabel('研发').isChecked());
        assert(!(await field('switch').getByRole('switch').isChecked()));
        assert.equal(await form.locator('input[size], button[size], form[size]').count(), 0);
        if (floating) await form.screenshot({ path: path.join(require('node:os').tmpdir(), `sia-form-size-${size}.png`) });
      }
    }
    // Resizing does not stop popups, range controls or pagination from working.
    await field('date').getByRole('button').click();
    await page.locator('.sia-date-panel').first().waitFor();
    await sizes.getByRole('radio', { name: /^small/ }).click();
    await field('pagination').getByRole('button', { name: '下一页', exact: true }).click();
    assert(await field('pagination').getByText('2 / 5', { exact: true }).isVisible());
    assert.deepEqual(errors, []);
    console.log('Form sizes: all 22/30/38px controls, choice/switch/rating sizes, floating labels, group/individual overrides, retained values and popup/pagination interactions passed.');
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
