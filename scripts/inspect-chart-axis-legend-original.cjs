const path=require('node:path');const {chromium}=require(path.join(process.argv[2],'playwright'));
(async()=>{const browser=await chromium.launch({headless:true,executablePath:process.argv[3]});try{
 const page=await browser.newPage({viewport:{width:1600,height:1100}});await page.goto('http://static.dtws110.com/echarts-2.2.7/doc/example/axis.html');await page.locator('#main canvas').first().waitFor();
 console.log(JSON.stringify(await page.evaluate(()=>myChart.component.legend.shapeList.map(shape=>({type:shape.type,style:shape.style})))));
 for(const type of ['bar','line']){
  await page.evaluate(type=>myChart.component.toolbox.setMagicType({[type]:true}),type);
  console.log(JSON.stringify({type,icons:await page.evaluate(()=>myChart.component.legend.shapeList.filter(shape=>shape.type==='icon').map(shape=>shape.style.iconType))}));
 }
}finally{await browser.close();}})().catch(error=>{console.error(error);process.exitCode=1;});
