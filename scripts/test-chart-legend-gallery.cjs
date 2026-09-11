const assert=require('node:assert/strict'),path=require('node:path');const {chromium}=require(path.join(process.argv[2],'playwright'));
(async()=>{const browser=await chromium.launch({headless:true,executablePath:process.argv[3]});try{
 const page=await browser.newPage({viewport:{width:1440,height:1000},reducedMotion:'reduce'}),errors=[],scripts=[];page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(r.resourceType()==='script')scripts.push(r.url());});
 await page.goto('http://localhost:4174/components/chart/components');const card=page.locator('#chart-example-legend');await card.scrollIntoViewIfNeeded();await card.locator('.chart-legend-reference').waitFor();
 assert.equal(await page.locator('.chart-reference-card').count(),3);assert.equal(await page.locator('.chart-reference-pending li').count(),6);
 assert.equal(await card.locator('[data-mixed-series][data-mixed-index]').count(),14);
 await card.locator('.sia-chart__legend [role="button"]').filter({hasText:'最低气温'}).click();await card.getByRole('status',{name:'数据获取中'}).waitFor();await card.locator('[data-mixed-series="3"]').first().waitFor();assert.equal(await card.locator('[data-mixed-series][data-mixed-index]').count(),21);
 await card.getByRole('link',{name:'单独查看',exact:true}).click();await page.waitForURL(/reference=.*legend/);await page.locator('.chart-legend-reference').first().waitFor();
 await page.getByRole('heading',{name:'Chart 图表',exact:true,level:1}).waitFor();
 assert.equal(await page.locator('.chart-legend-reference').first().locator('[data-mixed-series][data-mixed-index]').count(),14,'单独查看是独立初始实例');
 assert.deepEqual(errors,[]);assert.deepEqual(scripts.filter(url=>/echarts|zrender/i.test(url)),[]);
 console.log('legend 分类独立卡片、真实动态加载、单独查看初始状态和无图表运行时脚本请求检查通过。');
}finally{await browser.close();}})().catch(error=>{console.error(error);process.exitCode=1;});
