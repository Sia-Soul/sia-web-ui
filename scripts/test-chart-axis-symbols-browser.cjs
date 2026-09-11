const assert=require('node:assert/strict'),path=require('node:path');
const {chromium}=require(path.join(process.argv[2],'playwright'));
(async()=>{const browser=await chromium.launch({headless:true,executablePath:process.argv[3]});try{
 const page=await browser.newPage({viewport:{width:1600,height:1100},reducedMotion:'reduce'});
 await page.goto('http://static.dtws110.com/echarts-2.2.7/doc/example/axis.html');await page.locator('#main canvas').first().waitFor();
 const original=await page.evaluate(()=>myChart.chart.line.shapeList.filter(shape=>shape.type==='icon').map(shape=>({x:shape.style._x+shape.style._width/2,y:shape.style._y+shape.style._height/2,size:shape.style._width,color:shape.style.color,stroke:shape.style.strokeColor,width:shape.style.lineWidth,hoverWidth:shape.highlightStyle.lineWidth})));
 assert.equal(original.length,24);
 await page.goto('http://localhost:4174/components/chart?reference='+encodeURIComponent('http://static.dtws110.com/echarts-2.2.7/doc/example/axis.html'));
 const root=page.locator('.chart-axis-reference');await root.scrollIntoViewIfNeeded();
 const nodes=root.locator('circle.sia-chart__mixed-hollow-symbol');assert.equal(await nodes.count(),24);
 const actual=await nodes.evaluateAll(nodes=>nodes.map(node=>({x:Number(node.getAttribute('cx')),y:Number(node.getAttribute('cy')),size:Number(node.getAttribute('r'))*2,color:node.getAttribute('fill'),stroke:node.getAttribute('stroke'),width:parseFloat(getComputedStyle(node).strokeWidth)})));
 for(const expected of original){
  const found=actual.find(item=>item.stroke===expected.stroke&&Math.abs(item.x-expected.x)<1e-8);
  assert.ok(found,'原站数据点必须存在');assert.ok(Math.abs(found.y-expected.y)<1e-8,'数值轴投影');
  for(const field of ['size','color','stroke','width'])assert.equal(found[field],expected[field],field);
 }
 const lines=root.locator('path.sia-chart__line');assert.equal(await lines.count(),2);
 for(const node of await lines.all()){
  assert.equal((await node.getAttribute('d')).match(/C/g).length,11,'12点形成11段平滑曲线');
  assert.equal(await node.evaluate(node=>parseFloat(getComputedStyle(node).strokeWidth)),2);
 }
 const mark=root.locator('[data-mixed-series="2"][data-mixed-index="0"]');await mark.focus();
 assert.equal(await mark.locator('circle').evaluate(node=>parseFloat(getComputedStyle(node).strokeWidth)),4,'焦点高亮保持空心并加粗');
 assert.equal(await mark.locator('circle').getAttribute('fill'),'#fff');
 await page.mouse.move(0,0);await mark.evaluate(node=>node.blur());
 assert.equal(await mark.locator('circle').evaluate(node=>parseFloat(getComputedStyle(node).strokeWidth)),2,'离开后恢复');
 console.log('axis 原站24个空心点中心、直径、颜色和线宽匹配；两条平滑折线与焦点高亮/恢复通过。未以此替代曲线控制点和动画全量比较。');
}finally{await browser.close();}})().catch(error=>{console.error(error);process.exitCode=1;});
