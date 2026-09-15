const assert = require('node:assert/strict');
const path = require('node:path');
const { chromium } = require(path.join(process.argv[2], 'playwright'));

(async () => {
  const browser = await chromium.launch({ headless: true, channel: 'msedge' });
  try {
    const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
    await page.goto('http://127.0.0.1:4173/components/form');
    const form = page.locator('.form-size-demo');
    const field = form.locator('[data-size-control="date-range"]');
    await field.waitFor();
    for (const width of [1920, 1600, 1200, 900, 560]) {
      await page.setViewportSize({ width, height: 1080 });
      for (const size of ['small', 'medium', 'large']) {
        await page.getByRole('radiogroup', { name: '表单尺寸', exact: true }).getByRole('radio', { name: new RegExp(`^${size}`) }).click();
        const bounds = await field.evaluate(element => {
          const container = element.getBoundingClientRect();
          const control = element.querySelector('.sia-picker-range-control').getBoundingClientRect();
          return { available: container.width, width: control.width, overflow: control.right - container.right };
        });
        assert(bounds.overflow <= 1, `${width}/${size}: date range overflows its grid cell: ${JSON.stringify(bounds)}`);
        const expected = width <= 650 ? bounds.available : Math.min(420, bounds.available);
        assert(Math.abs(bounds.width - expected) < 1, `Expected capped desktop width or full-width mobile control: ${JSON.stringify(bounds)}`);
      }
    }
    await page.setViewportSize({ width: 1600, height: 1080 });
    await field.locator('.sia-picker__trigger').click();
    const calendar = page.locator('.sia-date-panel:visible').first();
    const firstDay = calendar.getByRole('button', { name: /^\d{4}-\d{2}-\d{2}$/ }).first();
    const date = await firstDay.getAttribute('aria-label');
    await firstDay.click();
    await calendar.getByRole('button', { name: date, exact: true }).first().click();
    assert.equal(await field.locator('.sia-picker-range-control__value.is-placeholder').count(), 0);
    const item = field.locator('xpath=ancestor::*[contains(@class,"sia-form-item")][1]');
    await item.screenshot({ path: path.join(require('node:os').tmpdir(), 'sia-date-range-grid-fixed.png') });
    console.log('Date range stays within grid cells across 5 viewport widths and all 3 sizes; wide cells retain 420px and date selection works.');
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
