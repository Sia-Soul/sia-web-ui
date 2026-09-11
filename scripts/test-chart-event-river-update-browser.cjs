const assert=require('node:assert/strict'),path=require('node:path');const {chromium}=require(path.join(process.argv[2],'playwright'));
(async()=>{const browser=await chromium.launch({headless:true,executablePath:process.argv[3]});try{
 const page=await browser.newPage({viewport:{width:1600,height:1100}}),errors=[];page.on('pageerror',error=>errors.push(error.message));
 await page.goto('http://localhost:4174/components/chart?reference='+encodeURIComponent('http://static.dtws110.com/echarts-2.2.7/doc/example/eventRiver1.html'));
 const root=page.locator('.chart-event-river-reference');await root.scrollIntoViewIfNeeded();
 await page.waitForFunction(()=>[...document.querySelectorAll('.chart-event-river-reference [data-event-scale]')].every(node=>Number(node.dataset.eventScale)===1));
 const mark=root.locator('[aria-label="政治事件，Apec峰会，123"]'),shape=mark.locator('path'),before=await shape.getAttribute('d');
 await root.locator('.sia-chart__legend').getByRole('button',{name:'财经事件',exact:true}).click();
 await page.waitForTimeout(80);const early=await shape.getAttribute('d');await page.waitForTimeout(140);const middle=await shape.getAttribute('d');await page.waitForTimeout(400);const final=await shape.getAttribute('d');
 assert.notEqual(before,early);assert.notEqual(early,middle);assert.notEqual(middle,final);
 await page.waitForTimeout(100);assert.equal(await shape.getAttribute('d'),final,'500ms更新收敛');
 assert.equal(Number(await mark.locator('[data-event-scale]').getAttribute('data-event-scale')),1,'保留事件不重复缩放入场');
 const pathCenter=Number(await shape.getAttribute('data-event-center')),labelY=Number(await mark.locator('text').getAttribute('y'));assert.ok(Math.abs(labelY-pathCenter-4)<1e-8);
 assert.deepEqual(errors,[]);console.log('eventRiver1 图例更新实际路径多帧插值、500ms收敛、保留入场状态、文字同步通过。');
 }finally{await browser.close();}})().catch(error=>{console.error(error);process.exitCode=1;});
