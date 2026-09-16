const assert = require('node:assert/strict');
const { chromium } = require(require('node:path').join(process.argv[2], 'playwright'));
(async () => {
  const browser = await chromium.launch({ headless: true, channel: 'msedge' });
  try {
    const page = await browser.newPage({ viewport: { width: 1200, height: 800 } });
    await page.goto('http://127.0.0.1:4173/components/floating-scrollbar');
    await page.evaluate(() => {
      const host = document.createElement('div');
      host.id = 'scrollbar-hit-fixture';
      host.style.cssText = 'position:fixed;left:100px;top:100px;width:400px;height:240px;overflow:auto;z-index:9999;background:white';
      const button = document.createElement('button');
      button.style.cssText = 'display:block;width:1200px;height:1200px;border:0;padding:0';
      button.textContent = '底层内容';
      window.contentClicks = 0;
      button.onclick = () => window.contentClicks++;
      host.append(button); document.body.append(host);
    });
    const host = page.locator('#scrollbar-hit-fixture');
    await page.locator('#scrollbar-hit-fixture[data-sia-floating-scrollbar]').waitFor();
    await host.hover();
    await page.waitForTimeout(180);
    await page.evaluate(() => {
      const rect = document.getElementById('scrollbar-hit-fixture').getBoundingClientRect();
      for (const axis of ['vertical', 'horizontal']) {
        const track = [...document.querySelectorAll('.sia-floating-scrollbar--' + axis)].find(el => {
          const r = el.getBoundingClientRect();
          return !el.hidden && (axis === 'vertical' ? Math.abs(r.right - rect.right) < 1 && Math.abs(r.top - rect.top) < 1 : Math.abs(r.bottom - rect.bottom) < 1 && Math.abs(r.left - rect.left) < 1);
        });
        assertTrack(track, axis);
      }
      function assertTrack(track, axis) { if (!track) throw Error('Missing ' + axis); track.id = 'hit-' + axis; }
    });
    for (const axis of ['vertical', 'horizontal']) {
      const vertical = axis === 'vertical';
      const thumb = page.locator('#hit-' + axis + ' .sia-floating-scrollbar__thumb');
      // The full hit box exists before the visual expansion starts.
      const initial = await thumb.boundingBox();
      assert.equal(vertical ? initial.width : initial.height, 10);
      for (const inset of [1, 3, 4]) {
        await host.evaluate(el => { el.scrollTop = 0; el.scrollLeft = 0; });
        await page.mouse.move(250, 220);
        await page.waitForTimeout(180);
        const r = await thumb.boundingBox();
        const x = vertical ? r.x + inset : r.x + r.width / 2;
        const y = vertical ? r.y + r.height / 2 : r.y + inset;
        await page.mouse.move(x, y);
        assert(await thumb.evaluate(el => el.matches(':hover')), axis + ' hover at ' + inset);
        assert(await page.evaluate(({x,y}) => document.elementFromPoint(x,y)?.classList.contains('sia-floating-scrollbar__thumb'), {x,y}));
        // Start dragging immediately, while the visual width is still animating.
        await page.mouse.down();
        await page.mouse.move(x + (vertical ? 0 : 45), y + (vertical ? 45 : 0), {steps: 8});
        await page.mouse.up();
        assert(await host.evaluate((el, v) => v ? el.scrollTop > 0 : el.scrollLeft > 0, vertical), axis + ' drag at ' + inset);
        await page.waitForTimeout(180);
        assert.equal(await thumb.evaluate((el,v) => getComputedStyle(el,'::after')[v ? 'width' : 'height'], vertical), '10px');
      }
      await host.evaluate(el => { el.scrollTop = 0; el.scrollLeft = 0; });
      await page.waitForTimeout(100);
      const tr = await page.locator('#hit-' + axis).boundingBox();
      await page.mouse.click(vertical ? tr.x + 2 : tr.x + tr.width - 20, vertical ? tr.y + tr.height - 20 : tr.y + 2);
      assert(await host.evaluate((el,v) => v ? el.scrollTop > 0 : el.scrollLeft > 0, vertical));
    }
    assert.equal(await page.evaluate(() => window.contentClicks), 0, 'Clicks must not reach content');
    await page.mouse.move(650, 450); await page.waitForTimeout(800);
    assert.equal(await page.locator('#hit-vertical').evaluate(el => getComputedStyle(el).pointerEvents), 'none');
    console.log('PASS both axes: full hit box, inner-half hover, immediate drag, expanded visual, track clicks, no click-through, hidden state');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
