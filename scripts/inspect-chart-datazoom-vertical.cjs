const path=require('node:path');const {chromium}=require(path.join(process.argv[2],'playwright'));
(async()=>{const browser=await chromium.launch({headless:true,executablePath:process.argv[3]});try{
 const page=await browser.newPage({viewport:{width:1600,height:1100}});await page.goto('http://static.dtws110.com/echarts-2.2.7/doc/example/dataZoom.html');await page.locator('#main canvas').first().waitFor();
 console.log(JSON.stringify(await page.evaluate(()=>{
  const dz=myChart.component.dataZoom,grid=myChart.component.grid.getArea();
  const snapshots=[];for(const y of [.1,.6]){
   dz.absoluteZoom({start:40,end:60,start2:0,end2:100});dz.rectZoom({x:grid.x+grid.width*.25,y:grid.y+grid.height*y,width:grid.width*.5,height:grid.height*.2});
   snapshots.push({zoom:{...dz._zoom},categories:myChart.component.xAxis._axisList[0].option.data,values:myChart.chart.line.series[0].data,axis:myChart.component.yAxis._axisList[0].shapeList.filter(s=>s.type==='text').map(s=>s.style.text)});
  }return snapshots;
 })));
}finally{await browser.close();}})().catch(error=>{console.error(error);process.exitCode=1;});
