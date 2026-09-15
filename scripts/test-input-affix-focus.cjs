const assert = require('node:assert/strict');
const path = require('node:path');
const { chromium } = require(path.join(process.argv[2], 'playwright'));

(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: process.argv[3] });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });
    await page.goto(process.argv[4] || 'http://127.0.0.1:4173/components/input');
    const search = page.getByRole('textbox', { name: '搜索文档', exact: true });
    await search.fill('focus test');
    await search.evaluate(el => {
      el.setSelectionRange(1, 4);
      window.inputBlurCount = 0;
      el.addEventListener('blur', () => window.inputBlurCount++);
    });
    const control = page.locator('.search .sia-input-control');
    // Wait until the focus transition has settled before comparing computed styles.
    await page.waitForTimeout(200);
    const readStyle = () => control.evaluate(el => ({ border: getComputedStyle(el).borderColor, shadow: getComputedStyle(el).boxShadow }));
    const before = await readStyle();
    for (const target of [page.locator('.search .sia-input-control__affix').first(), page.locator('.search kbd')]) {
      const box = await target.boundingBox();
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await page.mouse.down();
      await page.waitForTimeout(200);
      assert.deepEqual(await search.evaluate(el => ({ focused: document.activeElement === el, blur: window.inputBlurCount, start: el.selectionStart, end: el.selectionEnd })), { focused: true, blur: 0, start: 1, end: 4 });
      assert.deepEqual(await readStyle(), before, 'Focus border and shadow must remain while mouse is held down');
      await page.mouse.up();
    }
    await search.evaluate(el => el.blur());
    await page.locator('.search kbd').click();
    assert.equal(await search.evaluate(el => document.activeElement === el), true);
    console.log('PASS: prefix/suffix mousedown preserves focus, border, shadow and selection without blur; affix click focuses an inactive input.');
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
