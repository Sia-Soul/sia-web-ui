const assert=require('node:assert/strict'),path=require('node:path');const {chromium}=require(path.join(process.argv[2],'playwright'));
(async()=>{const browser=await chromium.launch({headless:true,executablePath:process.argv[3]});try{
 const page=await browser.newPage({viewport:{width:1600,height:1100},reducedMotion:'reduce'}),url='http://static.dtws110.com/echarts-2.2.7/doc/example/legend.html';
 await page.goto(url);await page.locator('#main canvas').first().waitFor();await page.waitForTimeout(2500);
 const read=()=>page.evaluate(()=>({bars:myChart.chart.bar.shapeList.filter(s=>s.type==='rectangle').map(s=>({x:s.style.x,y:s.style.y,width:s.style.width,height:s.style.height,color:s.style.color,radius:s.style.radius})),points:myChart.chart.line.shapeList.filter(s=>s.type==='icon').map(s=>({x:s.style._x+s.style._width/2,y:s.style._y+s.style._height/2,size:s.style._width,color:s.style.strokeColor}))}));
 const first=await read();const pos=await page.evaluate(()=>{const s=myChart.component.legend.shapeList.find(s=>s.type==='text'&&s.style.text==='最低气温'),r=document.querySelector('#main canvas').getBoundingClientRect();return{x:r.x+s.style.x+5,y:r.y+s.style.y};});
 await page.mouse.move(pos.x,pos.y);await page.waitForTimeout(80);await page.mouse.click(pos.x,pos.y);await page.waitForTimeout(4500);const added=await read();
 await page.goto('http://localhost:4174/components/chart?reference='+encodeURIComponent(url));const root=page.locator('.chart-legend-reference');await root.scrollIntoViewIfNeeded();
 const check=async(expected)=>{
  const bars=await root.locator('.sia-chart__bar').evaluateAll(nodes=>nodes.map(n=>({x:+n.getAttribute('x'),y:+n.getAttribute('y'),width:+n.getAttribute('width'),height:+n.getAttribute('height'),color:n.getAttribute('fill'),radius:+n.getAttribute('rx')})));
  assert.deepEqual(bars,expected.bars);
  const points=await root.locator('circle.sia-chart__mixed-hollow-symbol').evaluateAll(nodes=>nodes.map(n=>({x:+n.getAttribute('cx'),y:+n.getAttribute('cy'),size:2*+n.getAttribute('r'),color:n.getAttribute('stroke')})));
  assert.equal(points.length,expected.points.length);
  for(const point of expected.points){const actual=points.find(p=>p.color===point.color&&Math.abs(p.x-point.x)<1e-8);assert.ok(actual);assert.ok(Math.abs(actual.y-point.y)<1e-8,JSON.stringify({actual,point}));assert.equal(actual.size,point.size);}
 };
 await check(first);await root.locator('.sia-chart__legend [role="button"]').filter({hasText:'最低气温'}).click();await root.locator('[data-mixed-series="3"]').first().waitFor();await check(added);
 console.log('legend 初始和动态追加后的柱位置/尺寸/颜色/圆角、全部折线点中心/大小/颜色逐项匹配原站最终几何。');
}finally{await browser.close();}})().catch(error=>{console.error(error);process.exitCode=1;});
