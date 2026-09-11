const assert=require('node:assert/strict'),path=require('node:path');
const {chromium}=require(path.join(process.argv[2],'playwright'));
const source=require('../apps/docs/src/pages/chartLegendReferenceSource.json')[0].option;
(async()=>{const browser=await chromium.launch({headless:true,executablePath:process.argv[3]});try{
 const page=await browser.newPage({viewport:{width:1600,height:1100},reducedMotion:'reduce'}),errors=[];
 page.on('pageerror',error=>errors.push(error.message));
 await page.goto('http://localhost:4174/components/chart?reference='+encodeURIComponent('http://static.dtws110.com/echarts-2.2.7/doc/example/legend.html'));
 const root=page.locator('.chart-legend-reference');await root.scrollIntoViewIfNeeded();
 const legend=root.locator('.sia-chart__legend'),items=legend.locator('[role="button"]');
 assert.deepEqual(await items.locator('text').allTextContents(),['蒸发量','降水量','最高气温','最低气温']);
 assert.deepEqual(await items.evaluateAll(nodes=>nodes.map(node=>node.getAttribute('aria-pressed'))),['true','false','true','false']);
 assert.equal(await root.locator('[data-mixed-series][data-mixed-index]').count(),14);
 assert.deepEqual(await legend.locator('[data-legend-background]').evaluate(node=>Object.fromEntries(['x','y','width','height','fill','stroke','stroke-width'].map(key=>[key,node.getAttribute(key)]))),{x:'629',y:'4',width:'348',height:'34',fill:'#eee',stroke:'rgba(178,34,34,0.8)','stroke-width':'4'});
 assert.deepEqual(await items.evaluateAll(nodes=>nodes.map(node=>node.getAttribute('transform'))),['translate(639 21)','translate(720 21)','translate(801 21)','translate(894 21)']);
 assert.deepEqual(await items.locator('text').evaluateAll(nodes=>nodes.map(node=>[getComputedStyle(node).fill,getComputedStyle(node).fontWeight])),[['rgb(0, 128, 0)','700'],['rgb(204, 204, 204)','400'],['rgb(255, 0, 0)','400'],['rgb(204, 204, 204)','400']]);
 const icon=await legend.locator('image').getAttribute('href');assert.equal(icon,'http://static.dtws110.com/echarts-2.2.7/doc/asset/ico/favicon.png');
 const imageResponse=await page.request.get(icon);assert.equal(imageResponse.status(),200,'原站图片资源可访问');
 await items.nth(1).click();assert.equal(await root.locator('[data-mixed-series][data-mixed-index]').count(),21);
 for(let i=0;i<source.series.length;i++){
  const values=await root.locator(`[data-mixed-series="${i}"]`).evaluateAll(nodes=>nodes.map(node=>node.getAttribute('aria-label')));
  source.series[i].data.forEach((value,index)=>assert.ok(values[index].includes(String(value)),`${i}/${index} 原始值`));
 }
 await items.nth(0).focus();await page.keyboard.press('Enter');assert.equal(await root.locator('[data-mixed-series="0"]').count(),0);
 await items.nth(0).focus();await page.keyboard.press('Space');assert.equal(await root.locator('[data-mixed-series="0"]').count(),7);
 const started=Date.now();await items.nth(3).click();await root.getByText('数据获取中',{exact:true}).waitFor();assert.equal(await root.locator('[data-mixed-series][data-mixed-index]').count(),21);
 await root.locator('[data-mixed-series="3"]').first().waitFor();assert.ok(Date.now()-started>=1900,'保留2秒加载时延');
 assert.equal(await root.locator('[data-mixed-series][data-mixed-index]').count(),28);
 const addedValues=await root.locator('[data-mixed-series="3"]').evaluateAll(nodes=>nodes.map(node=>node.getAttribute('aria-label')));
 [-2,1,2,5,3,2,0].forEach((value,index)=>assert.ok(addedValues[index].includes(String(value))));
 assert.equal(await items.nth(3).locator('circle').count(),1,'追加后改为折线图例');
 await items.nth(3).click();assert.equal(await root.locator('[data-mixed-series="3"]').count(),0);
 await items.nth(3).click();assert.equal(await root.locator('[data-mixed-series="3"]').count(),7);assert.equal(await root.getByText('数据获取中',{exact:true}).count(),0);
 await items.nth(1).click();assert.equal(await root.locator('[data-mixed-series][data-mixed-index]').count(),21);
 await page.screenshot({path:'apps/docs/chart-legend-preparation.png'});assert.deepEqual(errors,[]);
 console.log('legend 初始21原值及动态7原值、2秒加载、图例符号更新、重复选择不重复追加、背景定位和鼠标/键盘筛选通过；原站全量一致性待验收，未注册。');
}finally{await browser.close();}})().catch(error=>{console.error(error);process.exitCode=1;});
