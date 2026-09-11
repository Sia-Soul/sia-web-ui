const assert=require('node:assert/strict'),path=require('node:path');const {chromium}=require(path.join(process.argv[2],'playwright'));const source=require('../apps/docs/src/pages/chartDataZoomSource.json');
(async()=>{const browser=await chromium.launch({headless:true,executablePath:process.argv[3]});try{
 const page=await browser.newPage({viewport:{width:1600,height:1100},reducedMotion:'reduce'});await page.goto(source.url);await page.locator('#main canvas').first().waitFor();await page.evaluate(option=>{myChart.clear();myChart.setOption(option,true);},source.option);await page.waitForTimeout(2500);
 const read=()=>page.evaluate(()=>myChart.chart.line.shapeList.filter(s=>s.type==='icon').map(s=>({x:s.style._x+s.style._width/2,y:s.style._y+s.style._height/2,size:s.style._width,color:s.style.strokeColor})));
 const initial=await read();await page.evaluate(()=>myChart.component.dataZoom.absoluteZoom({start:0,end:100,start2:0,end2:100}));await page.waitForTimeout(1000);const full=await read();
 const fullData=await page.evaluate(()=>({categories:myChart.component.xAxis._axisList[0].option.data,values:myChart.chart.line.series[0].data}));
 assert.equal(fullData.categories.length,150,'原站确实扩展到全范围');assert.deepEqual(fullData.values,source.option.series[0].data,'原站全范围使用同一组150值');
 await page.goto('http://localhost:4174/components/chart?reference='+encodeURIComponent(source.url));const root=page.locator('.chart-datazoom-reference');await root.scrollIntoViewIfNeeded();
 const compare=async(expected)=>{
  const actual=await root.locator('[aria-label^="dz，"] circle').evaluateAll(nodes=>nodes.map(n=>({x:+n.getAttribute('cx'),y:+n.getAttribute('cy'),size:2*+n.getAttribute('r'),color:n.getAttribute('stroke')})));
  for(const point of expected){const found=actual.find(p=>Math.abs(p.x-point.x)<1e-8);assert.ok(found,JSON.stringify(point));assert.ok(Math.abs(found.y-point.y)<1e-8,JSON.stringify({found,point}));assert.equal(found.size,point.size);assert.equal(found.color,point.color);}
  return actual.length;
 };
 const firstCount=await compare(initial);assert.equal(firstCount,30);
 await root.getByRole('slider',{name:'图表可见范围起点'}).fill('0');await root.getByRole('slider',{name:'图表可见范围终点'}).fill('100');const fullCount=await compare(full);assert.equal(fullCount,150);
 console.log(`dataZoom 初始${initial.length}与全范围${full.length}个原站可见符号的中心/大小/颜色匹配；本地保留${firstCount}/${fullCount}个数据点。`);
}finally{await browser.close();}})().catch(error=>{console.error(error);process.exitCode=1;});
