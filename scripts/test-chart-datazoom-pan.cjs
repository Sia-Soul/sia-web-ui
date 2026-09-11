const assert=require('node:assert/strict'),path=require('node:path');const {chromium}=require(path.join(process.argv[2],'playwright'));
(async()=>{const browser=await chromium.launch({headless:true,executablePath:process.argv[3]});try{
 const page=await browser.newPage({viewport:{width:1600,height:1100},reducedMotion:'reduce'});
 await page.goto('http://localhost:4174/components/chart?reference='+encodeURIComponent('http://static.dtws110.com/echarts-2.2.7/doc/example/dataZoom.html'));
 const root=page.locator('.chart-datazoom-reference');await root.scrollIntoViewIfNeeded();const pan=root.getByRole('slider',{name:'图表可见范围整体移动'}),track=root.locator('.sia-chart-data-zoom');
 const box=await track.boundingBox(),handle=await pan.boundingBox(),x=handle.x+handle.width/2,y=handle.y+handle.height/2;
 await page.mouse.move(x,y);await page.mouse.down();await page.mouse.move(x+box.width*.2,y,{steps:8});
 const start=Number(await pan.getAttribute('aria-valuenow'));assert.ok(Math.abs(start-60)<.2,'拖动中实时更新');
 const range=(await pan.getAttribute('aria-valuetext')).split(' – ').map(Number);assert.ok(Math.abs(range[1]-range[0]-20)<1e-8,'区间宽度不变');
 assert.ok(!(await root.locator('[aria-label^="dz，"]').first().getAttribute('aria-label')).startsWith('dz，61，'),'数据随拖动改变');
 await page.mouse.move(box.x+box.width+100,y,{steps:4});assert.equal(Number(await pan.getAttribute('aria-valuenow')),80);await page.mouse.up();
 await pan.focus();await page.keyboard.press('Home');assert.equal(Number(await pan.getAttribute('aria-valuenow')),0);assert.equal(await root.locator('[aria-label^="dz，"]').count(),30);
 await page.keyboard.press('End');assert.equal(Number(await pan.getAttribute('aria-valuenow')),80);assert.ok((await root.locator('[aria-label^="dz，"]').first().getAttribute('aria-label')).startsWith('dz，121，'));
 await page.keyboard.press('ArrowLeft');assert.equal(Number(await pan.getAttribute('aria-valuenow')),79);
 console.log('dataZoom 鼠标整体拖动实时更新、宽度保持、越界钳制、Home/End/方向键与可见原数据联动通过。');
}finally{await browser.close();}})().catch(error=>{console.error(error);process.exitCode=1;});
