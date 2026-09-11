const assert=require('node:assert/strict'),path=require('node:path');const {chromium}=require(path.join(process.argv[2],'playwright'));
(async()=>{const browser=await chromium.launch({headless:true,executablePath:process.argv[3]});try{
 const page=await browser.newPage({viewport:{width:1600,height:1100},reducedMotion:'no-preference'});
 await page.goto('http://localhost:4174/components/chart?reference='+encodeURIComponent('http://static.dtws110.com/echarts-2.2.7/doc/example/axis.html'));
 const root=page.locator('.chart-axis-reference');await root.waitFor();const bar=root.locator('[data-mixed-series="1"][data-mixed-index="7"] .sia-chart__bar');await bar.waitFor({state:'attached'});
 const first=Number(await bar.getAttribute('height'));assert.ok(first>=0&&first<189,'入场不是直接显示最终高度：'+first);
 await page.waitForTimeout(250);const second=Number(await bar.getAttribute('height'));assert.ok(second>first&&second<=189,'实际RAF驱动柱高度递增');
 await page.waitForFunction(()=>Number(document.querySelector('.chart-axis-reference [data-mixed-series="1"][data-mixed-index="7"] .sia-chart__bar')?.getAttribute('height'))===189);
 assert.equal(await bar.evaluate(node=>getComputedStyle(node).animationName),'none','不叠加CSS显现动画');
 await root.getByRole('button',{name:'还原',exact:true}).click();
 const restart=Number(await bar.getAttribute('height'));assert.ok(restart<189,'未编辑数据也必须重播入场');
 const linePoint=root.locator('[data-mixed-series="2"][data-mixed-index="7"] circle');
 assert.ok(Number(await linePoint.getAttribute('cy'))>197.756,'折线也从起始基线重播');
 await page.waitForTimeout(250);const replay=Number(await bar.getAttribute('height'));assert.ok(replay>restart&&replay<=189);
 await page.waitForFunction(()=>Number(document.querySelector('.chart-axis-reference [data-mixed-series="1"][data-mixed-index="7"] .sia-chart__bar')?.getAttribute('height'))===189);
 await page.emulateMedia({reducedMotion:'reduce'});await page.reload();await root.waitFor();assert.equal(Number(await bar.getAttribute('height')),189);
 await root.getByRole('button',{name:'还原',exact:true}).click();assert.equal(Number(await bar.getAttribute('height')),189,'减少动态效果下还原直接完成');
 console.log(`axis 实际柱动画高度 ${first}→${second}→189，CSS重复动画禁用，减少动态效果最终帧通过。`);
}finally{await browser.close();}})().catch(error=>{console.error(error);process.exitCode=1;});
