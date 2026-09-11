const path=require('node:path');const {chromium}=require(path.join(process.argv[2],'playwright'));
(async()=>{const browser=await chromium.launch({headless:true,executablePath:process.argv[3]});try{
 const page=await browser.newPage({viewport:{width:1600,height:1100}});await page.goto('http://static.dtws110.com/echarts-2.2.7/doc/example/axis.html');await page.locator('#main canvas').first().waitFor();
 const result=[];
 for(const type of ['bar','line']){
  await page.evaluate(type=>myChart.component.toolbox.setMagicType({[type]:true}),type);await page.waitForTimeout(2500);
  result.push(await page.evaluate(type=>({type,axes:[0,1].map(index=>({gap:myChart.component.xAxis.getAxis(index).option.boundaryGap,first:myChart.component.xAxis.getAxis(index).getCoordByIndex(0)})),bars:myChart.chart.bar?.shapeList.filter(shape=>shape.type==='rectangle').map(shape=>shape.style)??[],lines:myChart.chart.line?.shapeList.filter(shape=>shape.type==='polyline').map(shape=>({color:shape.style.strokeColor,points:shape.style.pointList}))??[]}),type));
 }
 console.log(JSON.stringify(result));
}finally{await browser.close();}})().catch(error=>{console.error(error);process.exitCode=1;});
