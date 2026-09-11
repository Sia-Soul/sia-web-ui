const assert=require('node:assert/strict'),path=require('node:path'),{execFileSync}=require('node:child_process');const {chromium}=require(path.join(process.argv[2],'playwright'));
(async()=>{const source=require('../apps/docs/src/pages/chartLargeEventRiverPlotSource.json');assert.deepEqual(source,JSON.parse(execFileSync(process.execPath,['scripts/inspect-chart-large-event-river.mjs','--plot-data'],{encoding:'utf8'})));
const browser=await chromium.launch({headless:true,executablePath:process.argv[3]});try{
 const page=await browser.newPage({viewport:{width:1600,height:1100},reducedMotion:'reduce'}),errors=[];page.on('pageerror',error=>errors.push(error.message));await page.goto('http://localhost:4174/components/chart?reference='+encodeURIComponent('http://static.dtws110.com/echarts-2.2.7/doc/example/eventRiver2.html'));
 const root=page.locator('.chart-large-event-river-reference');await root.scrollIntoViewIfNeeded();
 assert.equal(await root.locator('path.sia-chart__event-river').count(),83);assert.equal(await root.locator('.sia-chart__event-label').count(),0);
 assert.ok(await root.locator('path.sia-chart__event-river').evaluateAll(nodes=>nodes.every(node=>!(/NaN|Infinity/.test(node.getAttribute('d'))))));
 await root.locator('.sia-chart__legend').getByRole('button',{name:'41',exact:true}).click();assert.equal(await root.locator('path.sia-chart__event-river').count(),43);
 await root.getByRole('button',{name:'还原',exact:true}).click();assert.equal(await root.locator('path.sia-chart__event-river').count(),83);
 await page.screenshot({path:'apps/docs/chart-large-event-river-preparation.png'});assert.deepEqual(errors,[]);console.log('eventRiver2 绘图源数据重取、83事件、隐藏标签、系列40事件筛选与还原通过；未注册。');
}finally{await browser.close();}})().catch(error=>{console.error(error);process.exitCode=1;});
