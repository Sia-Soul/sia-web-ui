const assert=require('node:assert/strict'),path=require('node:path');const {chromium}=require(path.join(process.argv[2],'playwright'));
const source=require('../apps/docs/src/pages/chartDataZoomSource.json');
(async()=>{const browser=await chromium.launch({headless:true,executablePath:process.argv[3]});try{
 const page=await browser.newPage({viewport:{width:1600,height:1100},reducedMotion:'reduce'}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://localhost:4174/components/chart?reference='+encodeURIComponent(source.url));const root=page.locator('.chart-datazoom-reference');await root.scrollIntoViewIfNeeded();
 const marks=root.locator('[aria-label^="dz，"]');assert.equal(await marks.count(),30);
 const labels=await marks.evaluateAll(nodes=>nodes.map(n=>n.getAttribute('aria-label')));
 assert.deepEqual(labels,source.option.series[0].data.slice(60,90).map((v,i)=>`dz，${61+i}，${v}`));
 const control=root.locator('foreignObject.sia-chart__inline-zoom');assert.deepEqual(await control.evaluate(n=>['x','y','width','height'].map(k=>Number(n.getAttribute(k)))),[80.5,36,835,20]);
 assert.equal(await root.locator('.sia-chart-data-zoom').count(),1,'画布内单一缩放条');
 await root.getByRole('slider',{name:'图表可见范围起点'}).fill('0');await root.getByRole('slider',{name:'图表可见范围终点'}).fill('100');assert.equal(await marks.count(),150);
 assert.deepEqual(await marks.evaluateAll(nodes=>nodes.map(n=>n.getAttribute('aria-label'))),source.option.series[0].data.map((v,i)=>`dz，${1+i}，${v}`));
 assert.deepEqual(errors,[]);console.log('dataZoom 保存150个原站运行样本、初始61–90共30项、上方缩放条和全量窗口150原值通过。');
}finally{await browser.close();}})().catch(error=>{console.error(error);process.exitCode=1;});
