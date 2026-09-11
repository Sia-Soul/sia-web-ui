const assert=require('node:assert/strict'),path=require('node:path');
const {chromium}=require(path.join(process.argv[2],'playwright'));
(async()=>{const browser=await chromium.launch({headless:true,executablePath:process.argv[3]});try{
 const page=await browser.newPage({viewport:{width:1600,height:1100},reducedMotion:'reduce'});
 const url='http://static.dtws110.com/echarts-2.2.7/doc/example/legend.html';
 await page.goto(url);await page.locator('#main canvas').first().waitFor();await page.waitForTimeout(2500);
 const original=()=>page.evaluate(()=>myChart.component.yAxis._axisList.map(axis=>axis.shapeList.filter(s=>s.type==='text').map(s=>s.style.text)));
 const clickOriginal=async(name)=>{const point=await page.evaluate(name=>{const s=myChart.component.legend.shapeList.find(s=>s.type==='text'&&s.style.text===name),r=document.querySelector('#main canvas').getBoundingClientRect();return {x:r.x+s.style.x+5,y:r.y+s.style.y};},name);await page.mouse.move(point.x,point.y,{steps:5});await page.waitForTimeout(80);await page.mouse.click(point.x,point.y);await page.waitForTimeout(2600);};
 const names=['最低气温','最高气温','最低气温','降水量','蒸发量','降水量'];
 const expected=[await original()];for(const name of names){await clickOriginal(name);expected.push(await original());}
 await page.goto('http://localhost:4174/components/chart?reference='+encodeURIComponent(url));
 const root=page.locator('.chart-legend-reference');await root.scrollIntoViewIfNeeded();
 const actual=async()=>Promise.all(['left','right'].map(side=>root.locator(`.sia-chart__axis[data-axis-orientation="${side}"] text`).allTextContents()));
 assert.deepEqual(await actual(),expected[0],'initial');
 for(let index=0;index<names.length;index++){
  await root.locator('.sia-chart__legend [role="button"]').filter({hasText:names[index]}).click();
  if(index===0)await root.locator('[data-mixed-series="3"]').first().waitFor();
  assert.deepEqual(await actual(),expected[index+1],names[index]+' selection '+index);
 }
 console.log('legend 初始、动态追加、仅最低温、隐藏全部温度、水量显示/隐藏与全隐藏7个状态的两侧刻度逐项匹配原站。');
}finally{await browser.close();}})().catch(error=>{console.error(error);process.exitCode=1;});
