const path=require('node:path');const {chromium}=require(path.join(process.argv[2],'playwright'));
(async()=>{const browser=await chromium.launch({headless:true,executablePath:process.argv[3]});try{
 const page=await browser.newPage({viewport:{width:1600,height:1100}});await page.goto('http://static.dtws110.com/echarts-2.2.7/doc/example/axis.html');await page.locator('#main canvas').first().waitFor();
 const results=[];
 await page.waitForTimeout(2500);
 const canvas=page.locator('#main canvas').first();await canvas.scrollIntoViewIfNeeded();const box=await canvas.boundingBox();
 for(const seriesIndex of [3,0,2]){
  const position=await page.evaluate(seriesIndex=>{const color=['#2ec7c9','#b6a2de','#5ab1ef','#ffb980'][seriesIndex],shape=myChart.chart[seriesIndex===0?'bar':'line'].shapeList.find(shape=>shape.type===(seriesIndex===0?'rectangle':'icon')&&(shape.style.color===color||shape.style.strokeColor===color));const s=shape.style;return {x:s.x+s.width/2,y:s.y+s.height/2,width:myChart.getZrender().getWidth(),height:myChart.getZrender().getHeight()};},seriesIndex);
  await page.mouse.move(box.x+position.x*box.width/position.width,box.y+position.y*box.height/position.height);
  await page.waitForTimeout(350);
  results.push(await page.evaluate(seriesIndex=>({seriesIndex,text:myChart.component.tooltip._tDom?.innerText,html:myChart.component.tooltip._tDom?.innerHTML,pointer:myChart.component.tooltip.shapeList?.map(shape=>({type:shape.type,invisible:shape.invisible,z:shape.z,style:shape.style})),computed:((s)=>({fontSize:s.fontSize,lineHeight:s.lineHeight,fontWeight:s.fontWeight,boxShadow:s.boxShadow,whiteSpace:s.whiteSpace}))(getComputedStyle(myChart.component.tooltip._tDom)),tooltipStyle:myChart.component.tooltip._tDom?.style.cssText}),seriesIndex));
 }
 console.log(JSON.stringify(results));
}finally{await browser.close();}})().catch(error=>{console.error(error);process.exitCode=1;});
