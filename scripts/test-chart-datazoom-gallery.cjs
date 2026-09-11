const assert=require('node:assert/strict'),path=require('node:path');
const {chromium}=require(path.join(process.argv[2],'playwright'));
const source=require('../apps/docs/src/pages/chartDataZoomSource.json');
(async()=>{const browser=await chromium.launch({headless:true,executablePath:process.argv[3]});try{
 const page=await browser.newPage({viewport:{width:1440,height:1000},reducedMotion:'reduce'}),errors=[],forbidden=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(r.resourceType()==='script'&&/echarts|zrender/i.test(r.url()))forbidden.push(r.url());});
 await page.goto('http://localhost:4174/components/chart/components');
 const card=page.locator('#chart-example-dataZoom');await card.scrollIntoViewIfNeeded();await card.locator('.chart-datazoom-reference').waitFor();
 assert.equal(await page.locator('.chart-reference-card').count(),3);assert.equal(await page.locator('.chart-reference-pending li').count(),6);
 assert.deepEqual(await card.locator('[aria-label^="dz，"]').evaluateAll(nodes=>nodes.map(n=>n.getAttribute('aria-label'))),source.option.series[0].data.slice(60,90).map((v,i)=>`dz，${61+i}，${v}`));
 await card.getByRole('slider',{name:'图表可见范围起点'}).fill('0');await card.getByRole('slider',{name:'图表可见范围终点'}).fill('100');
 assert.equal(await card.locator('[aria-label^="dz，"]').count(),150);
 await card.getByRole('button',{name:'还原',exact:true}).click();assert.equal(await card.locator('[aria-label^="dz，"]').count(),30);
 await card.getByRole('link',{name:'单独查看',exact:true}).click();await page.waitForURL(/reference=.*dataZoom/);await page.getByRole('heading',{name:'Chart 图表',exact:true,level:1}).waitFor();
 assert.equal(await page.locator('.chart-datazoom-reference').first().locator('[aria-label^="dz，"]').count(),30);
 assert.deepEqual(errors,[]);assert.deepEqual(forbidden,[]);
 console.log('dataZoom 分类独立卡片、30原值/150全量、还原、单独查看及无 ECharts/zrender 脚本请求通过。');
}finally{await browser.close();}})().catch(error=>{console.error(error);process.exitCode=1;});
