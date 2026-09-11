const assert=require('node:assert/strict'),path=require('node:path');const {chromium}=require(path.join(process.argv[2],'playwright'));
(async()=>{const browser=await chromium.launch({headless:true,executablePath:process.argv[3]});try{
 const page=await browser.newPage({viewport:{width:1600,height:1100},reducedMotion:'reduce'});await page.goto('http://localhost:4174/components/chart?reference='+encodeURIComponent('http://static.dtws110.com/echarts-2.2.7/doc/example/dataZoom.html'));
 const root=page.locator('.chart-datazoom-reference');await root.scrollIntoViewIfNeeded();const detail=root.locator('[data-zoom-handle-detail]'),control=root.locator('.sia-chart-data-zoom'),b=await control.boundingBox();
 assert.equal(await detail.count(),0);await page.mouse.move(b.x+b.width*334/835+b.width*4/835,b.y+b.height/2);await detail.waitFor();assert.equal(await detail.innerText(),'61');await page.mouse.move(b.x,b.y+60);assert.equal(await detail.count(),0);
 const start=root.getByRole('slider',{name:'图表可见范围起点'}),end=root.getByRole('slider',{name:'图表可见范围终点'});
 await end.focus();assert.equal(await detail.innerText(),'90');await page.keyboard.press('ArrowRight');assert.equal(await detail.innerText(),'92');
 await start.focus();assert.equal(await detail.innerText(),'61');await page.keyboard.press('ArrowLeft');assert.equal(await detail.innerText(),'59');
 await start.fill('0');assert.equal(await detail.innerText(),'1');await end.focus();await end.fill('100');assert.equal(await detail.innerText(),'150');
 await root.getByRole('button',{name:'还原',exact:true}).focus();assert.equal(await detail.count(),0);
 console.log('dataZoom 初始手柄鼠标提示61/90、离开隐藏、焦点/键盘更新59/92和完整范围1/150通过。');
}finally{await browser.close();}})().catch(error=>{console.error(error);process.exitCode=1;});
