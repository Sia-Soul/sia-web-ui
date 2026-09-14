const assert = require('node:assert/strict');
const { chromium } = require(require('node:path').join(process.argv[2], 'playwright'));
(async () => {
  const browser = await chromium.launch({headless:true, executablePath:process.argv[3]});
  try {
    const page = await browser.newPage({viewport:{width:1000,height:900}});
    await page.goto('http://127.0.0.1:4173/components/table');
    const table = page.locator('.cell-selection-table-demo');
    await table.scrollIntoViewIfNeeded();
    await table.locator('tbody td').nth(1).click();
    const selected = () => table.locator('.sia-table__cell--range-selected').evaluateAll(es=>es.map(e=>e.parentElement.dataset.rowKey+':'+e.dataset.columnKey));
    const before = await selected();
    assert(before.length > 0, "Fixture must start with a selected cell");
    await table.locator("tbody td").evaluateAll(es=>es.forEach(el=>{el.style.zIndex="100";el.style.position="relative"}));
    for (const forcePassthrough of [false, true]) {
    await table.locator('.sia-table__scrollbar').evaluateAll((tracks,force)=>tracks.forEach(track=>track.style.setProperty('pointer-events',force?'none':'auto','important')),forcePassthrough);
    for (const axis of ['vertical','horizontal']) {
      const track = table.locator('.sia-table__scrollbar--'+axis);
      const box = await track.boundingBox();
      await page.mouse.move(box.x+box.width-2,box.y+box.height/2);
      await page.waitForTimeout(200);
      for (let offset=0.5;offset<10;offset++) {
        const thumb = await track.locator('.sia-table__scrollbar-thumb').boundingBox();
        const px = axis==='vertical' ? thumb.x+thumb.width-offset : thumb.x+thumb.width/2;
        const py = axis==='vertical' ? thumb.y+thumb.height/2 : thumb.y+thumb.height-offset;
        await page.mouse.move(px,py);
        assert(await track.evaluate(el=>el.hasAttribute('data-pointer-hover')), 'Coordinate hover must cover both halves');
        await page.mouse.click(px,py);
        assert.deepEqual(await selected(),before,'Scrollbar click changed selection '+axis+' '+offset);
      }
      const viewport = table.locator('.sia-table__viewport');
      await viewport.evaluate(el=>{el.scrollTop=0;el.scrollLeft=0});
      await page.waitForTimeout(100);
      const thumb = await track.locator('.sia-table__scrollbar-thumb').boundingBox();
      const px = axis==='vertical' ? thumb.x+2 : thumb.x+thumb.width/2;
      const py = axis==='vertical' ? thumb.y+thumb.height/2 : thumb.y+2;
      await page.mouse.move(px,py);
      await page.mouse.down();
      await page.mouse.move(px+(axis==='horizontal'?10:0),py+(axis==='vertical'?10:0),{steps:4});
      await page.mouse.up();
      assert(await viewport.evaluate((el,axis)=>axis==='vertical'?el.scrollTop>0:el.scrollLeft>0,axis),'Both scrollbar halves must drag even during passthrough');
      assert.deepEqual(await selected(),before,'Scrollbar drag must preserve selection');
    }
    }
    console.log('PASS: both scrollbar halves hover/click without changing selection, including forced DOM hit-test passthrough');
  } finally { await browser.close(); }
})().catch(e=>{console.error(e);process.exitCode=1;});
