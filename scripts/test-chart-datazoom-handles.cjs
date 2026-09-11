const assert=require('node:assert/strict'),path=require('node:path');const {chromium}=require(path.join(process.argv[2],'playwright'));
(async()=>{const browser=await chromium.launch({headless:true,executablePath:process.argv[3]});try{
 const page=await browser.newPage({viewport:{width:1600,height:1100},reducedMotion:'reduce'});await page.goto('http://localhost:4174/components/chart?reference='+encodeURIComponent('http://static.dtws110.com/echarts-2.2.7/doc/example/dataZoom.html'));
 const root=page.locator('.chart-datazoom-reference');await root.scrollIntoViewIfNeeded();
 const filler=root.locator('.sia-chart-data-zoom__track i');assert.deepEqual(await filler.evaluate(n=>({left:n.style.left,right:n.style.right,width:getComputedStyle(n).width})),{left:'342px',right:'342px',width:'151px'});
 const control=root.locator('.sia-chart-data-zoom'),bounds=await control.boundingBox();
 const scale=bounds.width/835;
 await page.mouse.move(bounds.x+334*scale+4*scale,bounds.y+10*scale);await page.mouse.down();await page.mouse.move(bounds.x+251*scale+4*scale,bounds.y+10*scale,{steps:8});await page.mouse.up();
 const start=root.getByRole('slider',{name:'图表可见范围起点'}),end=root.getByRole('slider',{name:'图表可见范围终点'});
 assert.ok(Math.abs(Number(await start.inputValue())-30)<=1);assert.equal(await end.inputValue(),'60');
 await start.focus();await page.keyboard.press('ArrowRight');assert.ok(Number(await start.inputValue())>=30);
 await end.focus();await page.keyboard.press('ArrowRight');assert.equal(await end.inputValue(),'61');
 await control.screenshot({path:'apps/docs/chart-datazoom-handles.png'});
 console.log('dataZoom 初始填充151宽/左右8单位手柄留白、左手柄真实拖动及两端键盘调整通过。手柄文字像素与悬停细节仍待核对。');
}finally{await browser.close();}})().catch(error=>{console.error(error);process.exitCode=1;});
