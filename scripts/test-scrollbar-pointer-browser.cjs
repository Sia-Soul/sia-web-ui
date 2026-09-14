const assert = require('node:assert/strict');
const { chromium } = require(require('node:path').join(process.argv[2], 'playwright'));
(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: process.argv[3] });
  try {
    const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } });
    await page.goto('http://127.0.0.1:4173/components/table');
    await page.evaluate(async () => {
      const { default: React } = await import('/node_modules/.vite/deps/react.js');
      const { default: { createRoot } } = await import('/node_modules/.vite/deps/react-dom_client.js');
      const { Table } = await import('/@fs/C:/Users/12235/Documents/SiaWebUI/packages/react/src/components/Table/Table.tsx');
      const host = document.createElement('div');
      host.id = 'scrollbar-fixture';
      host.style.cssText = 'position:fixed;left:350px;top:150px;width:600px;z-index:3000;background:white';
      document.body.append(host);
      createRoot(host).render(React.createElement(Table, { height: 350, columns: [{key:'name',title:'Name',width:1000}], dataSource: Array.from({length:100}, (_,id)=>({id,name:'Row '+id})) }));
    });
    const viewport = page.locator('#scrollbar-fixture .sia-table__viewport');
    const vertical = page.locator('#scrollbar-fixture .sia-table__scrollbar--vertical');
    const horizontal = page.locator('#scrollbar-fixture .sia-table__scrollbar--horizontal');
    await vertical.waitFor();
    for (const [track,axis] of [[vertical,'y'],[horizontal,'x']]) {
      const box = await track.boundingBox();
      const thumb = track.locator('.sia-table__scrollbar-thumb');
      await page.mouse.move(axis==='y' ? box.x-15 : box.x+30, axis==='y' ? box.y+30 : box.y-15);
      await page.waitForTimeout(250);
      assert.equal(await track.getAttribute('data-scrollbar-near'),'true');
      assert.equal(await thumb.evaluate((el,axis)=>Number.parseFloat(getComputedStyle(el,'::after')[axis==='y'?'width':'height']),axis),10);
      const t = await thumb.boundingBox();
      const x = axis==='y' ? box.x+0.5 : t.x+t.width/2;
      const y = axis==='y' ? t.y+t.height/2 : box.y+0.5;
      await page.mouse.move(x,y);
      await page.mouse.down();
      await page.mouse.move(x+(axis==='x'?50:0),y+(axis==='y'?50:0),{steps:6});
      await page.mouse.up();
      assert(await viewport.evaluate((el,axis)=>axis==='y'?el.scrollTop:el.scrollLeft,axis)>0,'Transparent edge must drag '+axis);
      await viewport.evaluate((el,axis)=>{if(axis==='y')el.scrollTop=0;else el.scrollLeft=0},axis);
      await page.waitForTimeout(100);
      await page.mouse.click(axis==='y'?box.x+1:box.x+box.width*0.8,axis==='y'?box.y+box.height*0.8:box.y+1);
      assert(await viewport.evaluate((el,axis)=>axis==='y'?el.scrollTop:el.scrollLeft,axis)>0,'Track click must scroll '+axis);
    }
    await viewport.evaluate(el=>{el.scrollTop=el.scrollHeight;el.scrollLeft=el.scrollWidth});
    await page.waitForTimeout(150);
    for (const [track,axis] of [[vertical,'y'],[horizontal,'x']]) {
      const box = await track.boundingBox();
      const thumb = await track.locator('.sia-table__scrollbar-thumb').boundingBox();
      assert(Math.abs(axis==='y' ? box.y+box.height-thumb.y-thumb.height : box.x+box.width-thumb.x-thumb.width)<1.5,'Thumb must reach actual track end '+axis);
    }
    await page.mouse.move(100,100);
    await page.waitForTimeout(250);
    assert.equal(await vertical.getAttribute('data-scrollbar-near'),null);
    assert.equal(await vertical.locator('.sia-table__scrollbar-thumb').evaluate(el=>Number.parseFloat(getComputedStyle(el,'::after').width)),3);
    console.log('PASS: proximity expands both axes, transparent edge drags, empty track clicks scroll, leaving contracts');
  } finally { await browser.close(); }
})().catch(error=>{console.error(error);process.exitCode=1;});
