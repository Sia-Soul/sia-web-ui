const path=require('node:path');const {chromium}=require(path.join(process.argv[2],'playwright'));
(async()=>{const browser=await chromium.launch({headless:true,executablePath:process.argv[3]});try{
 const page=await browser.newPage({viewport:{width:1600,height:1100}});await page.goto('http://static.dtws110.com/echarts-2.2.7/doc/example/axis.html');await page.locator('#main canvas').first().waitFor();
 console.log(JSON.stringify(await page.evaluate(()=>['xAxis','yAxis'].flatMap(kind=>[0,1].map(index=>({kind,index,shapes:myChart.component[kind].getAxis(index).shapeList.filter(shape=>shape.type!=='text').map(shape=>({type:shape.type,z:shape.z,style:shape.style}))}))))));
 }finally{await browser.close();}})().catch(error=>{console.error(error);process.exitCode=1;});
