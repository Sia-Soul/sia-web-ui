const assert=require('node:assert/strict'),path=require('node:path');
const {chromium}=require(path.join(process.argv[2],'playwright'));
(async()=>{const browser=await chromium.launch({headless:true,executablePath:process.argv[3]});try{
 const page=await browser.newPage({viewport:{width:1600,height:1100},reducedMotion:'reduce'});
 await page.goto('http://static.dtws110.com/echarts-2.2.7/doc/example/axis.html');await page.locator('#main canvas').first().waitFor();
 await page.waitForTimeout(2500);
 const original=await page.evaluate(()=>myChart.chart.bar.shapeList.filter(shape=>shape.type==='rectangle').map(shape=>({x:shape.style.x,y:shape.style.y,width:shape.style.width,height:shape.style.height,color:shape.style.color,radius:shape.style.radius})));
 assert.equal(original.length,24);
 await page.goto('http://localhost:4174/components/chart?reference='+encodeURIComponent('http://static.dtws110.com/echarts-2.2.7/doc/example/axis.html'));
 const root=page.locator('.chart-axis-reference');await root.waitFor();
 const read=()=>root.locator('.sia-chart__bar').evaluateAll(nodes=>nodes.map(node=>({x:Number(node.getAttribute('x')),y:Number(node.getAttribute('y')),width:Number(node.getAttribute('width')),height:Number(node.getAttribute('height')),color:node.getAttribute('fill'),radius:Number(node.getAttribute('rx'))})));
 const actual=await read();assert.equal(actual.length,24);
 for(const expected of original){const found=actual.find(item=>item.color===expected.color&&item.x===expected.x);assert.ok(found,JSON.stringify(expected));assert.deepEqual(found,expected,'原站最终柱几何');}
 await root.locator('.sia-chart__legend [role="button"]').first().click();
 const single=await read();assert.equal(single.length,12);assert.ok(single.every(rect=>rect.width===56),'隐藏一个系列后重新分配类别宽度');
 await root.getByRole('button',{name:'还原',exact:true}).click();assert.deepEqual(await read(),actual);
 await root.getByRole('button',{name:'切换为柱状图',exact:true}).click();const four=await read();assert.equal(four.length,48);assert.equal(four.filter(rect=>rect.width===56).length,12,'顶部轴单系列独立占用类别');assert.equal(four.filter(rect=>rect.width===16).length,36,'底部轴三系列并排');
 console.log('axis 24柱最终x/y/宽/高/颜色/圆角与原站逐项一致；图例隐藏和四系列切换重新分配宽度通过。未验证对应动态变化的原站全帧。');
}finally{await browser.close();}})().catch(error=>{console.error(error);process.exitCode=1;});
