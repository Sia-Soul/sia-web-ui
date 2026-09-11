const path=require('node:path');const {chromium}=require(path.join(process.argv[2],'playwright'));
(async()=>{const browser=await chromium.launch({headless:true,executablePath:process.argv[3]});try{
 const page=await browser.newPage({viewport:{width:1600,height:1100}});await page.goto('http://static.dtws110.com/echarts-2.2.7/doc/example/legend.html');await page.locator('#main canvas').first().waitFor();
 await page.evaluate(()=>{window.whirlShapes={};const storage=myChart.getZrender().storage,add=storage.addHover;storage.addHover=function(s){window.whirlShapes[s.type]={type:s.type,style:s.highlightStyle,rotation:s.rotation};return add.call(this,s);};myChart.showLoading({text:'数据获取中',effect:'whirling'});});await page.waitForTimeout(160);
 console.log(JSON.stringify(await page.evaluate(()=>window.whirlShapes)));
}finally{await browser.close();}})().catch(error=>{console.error(error);process.exitCode=1;});
