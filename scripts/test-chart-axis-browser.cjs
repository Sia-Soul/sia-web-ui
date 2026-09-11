const assert=require('node:assert/strict'),path=require('node:path');const {chromium}=require(path.join(process.argv[2],'playwright'));
(async()=>{const browser=await chromium.launch({headless:true,executablePath:process.argv[3]});try{
 const page=await browser.newPage({viewport:{width:1600,height:1100},reducedMotion:'reduce'}),errors=[];page.on('pageerror',error=>errors.push(error.message));await page.goto('http://localhost:4174/components/chart?reference='+encodeURIComponent('http://static.dtws110.com/echarts-2.2.7/doc/example/axis.html'));
 const root=page.locator('.chart-axis-reference');await root.scrollIntoViewIfNeeded();assert.equal(await root.locator('.sia-chart__axis').count(),4);assert.equal(await root.locator('[data-mixed-series][data-mixed-index]').count(),48);
 const paths=root.locator('path.sia-chart__line');assert.equal(await paths.count(),2);
 assert.equal(await root.locator('.sia-chart__axis-overlay').count(),4);
 assert.equal(await root.locator('.sia-chart__axis [data-axis-stroke]').count(),0,'背景层不重复绘制主轴线');
 assert.equal(await root.locator('.sia-chart__axis-overlay [data-axis-stroke]').count(),4);
 assert.ok(await root.evaluate(root=>{
  const overlays=[...root.querySelectorAll('.sia-chart__axis-overlay')];
  const behind=[...root.querySelectorAll('.sia-chart__axis-split-area,.sia-chart__bar,path.sia-chart__line')];
  return overlays.every(overlay=>behind.every(node=>Boolean(node.compareDocumentPosition(overlay)&Node.DOCUMENT_POSITION_FOLLOWING)));
 }),'背景分区和数据几何先于主轴线绘制');
 assert.ok(await paths.evaluateAll(nodes=>nodes.every(node=>{const style=getComputedStyle(node);return node.getTotalLength()>100&&style.stroke!=='none'&&parseFloat(style.strokeWidth)>0&&parseFloat(style.strokeDashoffset)===0&&!node.classList.contains('sia-chart__line--draw');})),'坐标动画折线路径实际可见，不遗留描线隐藏样式');
 const bottom=root.locator('.sia-chart__axis--bottom');assert.equal(await bottom.locator('.sia-chart__axis-split-area').count(),12);const sixth=bottom.locator('.sia-chart__axis-label').nth(5);assert.equal(await sixth.textContent(),'6月');assert.equal(await sixth.evaluate(node=>getComputedStyle(node).fontSize),'30px');assert.equal(await sixth.evaluate(node=>getComputedStyle(node).fill),'rgb(255, 0, 0)');
 assert.equal(await root.locator('.sia-chart__axis--top .sia-chart__axis-label').first().textContent(),'Jan');assert.equal(await root.locator('.sia-chart__axis--right .sia-chart__axis-label').last().textContent(),'50 °C');
 for(const side of ['bottom','top','left','right']){
  const labels=await root.locator(`.sia-chart__axis--${side} .sia-chart__axis-label`).evaluateAll(nodes=>nodes.map(node=>({x:Number(node.getAttribute('x')),y:Number(node.getAttribute('y')),anchor:node.getAttribute('text-anchor'),baseline:node.getAttribute('dominant-baseline'),rotation:node.getAttribute('transform')})));
  labels.forEach((label,index)=>{
   const horizontal=side==='bottom'||side==='top',x=horizontal?80.5+835*(index+.5)/12:side==='left'?62.5:923.5,y=horizontal?side==='bottom'?326.5:52.5:318.5-258*index/(side==='left'?5:10);
   assert.ok(Math.abs(label.x-x)<1e-8&&Math.abs(label.y-y)<1e-8,side+' 原站文字锚点 '+index);
   assert.equal(label.anchor,side==='bottom'||side==='left'?'end':side==='right'?'start':'middle');
   assert.equal(label.baseline,side==='bottom'?'hanging':side==='top'?'text-after-edge':'central');
   if(side==='bottom'||side==='left')assert.ok(label.rotation.startsWith(`rotate(${side==='bottom'?-45:45} `),'原站旋转方向');
  });
 }
 await page.screenshot({path:'apps/docs/chart-axis-preparation.png'});assert.deepEqual(errors,[]);console.log('axis：48原始数据标记、四轴、12月份分区、6月特殊文字及温度刻度通过；完整一致性仍未验收。');
 }finally{await browser.close();}})().catch(error=>{console.error(error);process.exitCode=1;});
