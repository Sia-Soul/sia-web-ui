const path=require('node:path');const {chromium}=require(path.join(process.argv[2],'playwright'));
const source=require('../apps/docs/src/pages/chartPhoneTreeSource.json');
const images=[];function visit(node){if(node.symbol?.startsWith('image://'))images.push({name:node.name,url:node.symbol.slice(8)});node.children?.forEach(visit);}visit(source[0].option.series[0].data[0]);
(async()=>{const browser=await chromium.launch({headless:true,executablePath:process.argv[3]});try{
 const page=await browser.newPage({viewport:{width:1600,height:1100}});await page.goto('http://static.dtws110.com/echarts-2.2.7/doc/example/tree1.html',{waitUntil:'domcontentloaded'});await page.locator('#main canvas').first().waitFor();
 const assets=await Promise.all(images.map(async asset=>{let transport;try{const response=await page.request.get(asset.url,{timeout:12000});transport={status:response.status(),url:response.url(),contentType:response.headers()['content-type']};}catch(error){transport={error:error.message.split('\n')[0]};}return {...asset,...transport};}));
 const decoded=await page.evaluate(async assets=>Promise.all(assets.map(asset=>new Promise(resolve=>{const img=new Image();let done=false;const finish=result=>{if(done)return;done=true;clearTimeout(timer);resolve({name:asset.name,...result});};const timer=setTimeout(()=>finish({decoded:false,reason:'timeout'}),12000);img.onload=()=>finish({decoded:true,width:img.naturalWidth,height:img.naturalHeight});img.onerror=()=>finish({decoded:false,reason:'load-error'});img.src=asset.url;}))),images);
 const shapes=await page.evaluate(()=>myChart.chart.tree.shapeList.map(shape=>({type:shape.type,x:shape.style.x,y:shape.style.y,width:shape.style.width,height:shape.style.height,text:shape.style.text,points:shape.style.pointList})));
 console.log(JSON.stringify({assets,decoded,shapes}));
}finally{await browser.close();}})().catch(error=>{console.error(error);process.exitCode=1;});
