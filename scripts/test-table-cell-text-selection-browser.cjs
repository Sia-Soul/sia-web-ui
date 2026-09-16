const assert = require('node:assert/strict');
const { chromium } = require(require('node:path').join(process.argv[2], 'playwright'));

(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: process.argv[3] });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    await page.goto('http://127.0.0.1:4173/components/table');
    const table = page.locator('.cell-selection-table-demo');
    await table.scrollIntoViewIfNeeded();
    const cell = table.locator('tbody tr').first().locator('td[data-column-key="name"]');
    await cell.click();
    const selectedCount = () => table.locator('tbody .sia-table__cell--range-selected').count();
    assert.equal(await selectedCount(), 1);
    const textPoints = async () => cell.evaluate(el => {
      const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
      let text;
      while ((text = walker.nextNode())) if (text.textContent.trim().length >= 3) break;
      const range = document.createRange();
      range.setStart(text, 0); range.setEnd(text, 2);
      const rect = range.getBoundingClientRect();
      return { x: rect.x + 1, end: rect.right, y: rect.y + rect.height / 2 };
    });
    const readText = () => page.evaluate(() => window.getSelection().toString());
    const copy = () => page.evaluate(() => {
      const data = new DataTransfer();
      const event = new ClipboardEvent('copy', { clipboardData: data, bubbles: true, cancelable: true });
      document.activeElement.dispatchEvent(event);
      return { prevented: event.defaultPrevented, text: data.getData('text/plain') };
    });
    let point = await textPoints();
    await page.mouse.move(point.x, point.y); await page.mouse.down();
    await page.mouse.move(point.end, point.y, { steps: 8 }); await page.mouse.up();
    assert.ok((await readText()).length > 0, 'Same-cell drag selects native text');
    assert.equal(await selectedCount(), 1);
    assert.equal((await copy()).prevented, false, 'Partial text copy remains native');

    const endCell = table.locator('tbody tr').nth(1).locator('td[data-column-key="category"]');
    const end = await endCell.boundingBox();
    point = await textPoints();
    await page.mouse.move(point.x, point.y); await page.mouse.down();
    await page.mouse.move(end.x + end.width / 2, end.y + end.height / 2, { steps: 15 });
    await page.waitForTimeout(50);
    assert.equal(await readText(), '', 'Cross-cell drag clears native text');
    assert.ok(await selectedCount() > 1, 'Cross-cell drag selects a rectangle');
    // Returning to the starting cell stays in range-selection mode for this drag.
    await page.mouse.move(point.end, point.y, { steps: 10 });
    assert.equal(await readText(), '');
    await page.mouse.move(end.x + end.width / 2, end.y + end.height / 2, { steps: 10 });
    await page.mouse.up();
    const copied = await copy();
    assert.equal(copied.prevented, true);
    assert.ok(copied.text.includes('\t') && copied.text.includes('\r\n'), 'Range copy produces rows and columns');

    point = await textPoints();
    await page.mouse.move(point.x, point.y); await page.mouse.down();
    await page.mouse.move(point.end, point.y, { steps: 8 }); await page.mouse.up();
    assert.ok((await readText()).length > 0, 'A new drag restores native text selection');
    assert.equal(await selectedCount(), 1);
    await endCell.click({ modifiers: ['Shift'] });
    assert.ok(await selectedCount() > 1, 'Shift-click still extends selection');
    assert.equal(await readText(), '');
    point = await textPoints();
    await page.mouse.dblclick(point.x + 5, point.y);
    assert.ok((await readText()).length > 0, 'Double-click still selects a word');
    await table.locator('th[data-column-key="name"]').click();
    assert.ok(await selectedCount() > 1, 'Header selection remains available');
    assert.equal(await readText(), '');
    await table.evaluate(el => { const blank = document.createElement('div'); blank.id='selection-blank'; blank.style.height='30px'; el.append(blank); });
    await page.locator('#selection-blank').click();
    assert.equal(await selectedCount(), 0, 'Table whitespace clears cell range');
    await cell.click(); assert.equal(await selectedCount(), 1);
    await page.evaluate(() => { const button=document.createElement('button'); button.id='outside-clear'; button.textContent='outside'; button.style='position:fixed;top:0;left:0;z-index:99999'; document.body.append(button); });
    await page.locator('#outside-clear').click();
    assert.equal(await selectedCount(), 0, 'Outside click clears cell range');
    console.log('PASS: click, same-cell text drag/native copy, cross-cell rectangle/TSV copy, return-to-anchor, fresh text drag and Shift-click');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
