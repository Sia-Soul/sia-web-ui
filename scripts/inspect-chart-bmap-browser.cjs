const path=require('node:path');const {chromium}=require(path.join(process.argv[2],'playwright'));
(async()=>{const browser=await chromium.launch({headless:true,executablePath:process.argv[3]});try{
 for(const id of ['BMap','example']){
  const page=await browser.newPage({viewport:{width:1400,height:900}}),errors=[],failed=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('requestfailed',r=>failed.push({url:r.url(),error:r.failure()?.errorText}));
  await page.goto(`http://static.dtws110.com/echarts-2.2.7/extension/BMap/doc/${id}.html`,{waitUntil:'domcontentloaded',timeout:30000});await page.waitForTimeout(5000);
  console.log(JSON.stringify({id,errors,failed,state:await page.evaluate(()=>({bmap:typeof window.BMap,mapConstructor:typeof window.BMap?.Map,canvases:document.querySelectorAll('#main canvas').length,tiles:[...document.querySelectorAll('#main img')].filter(i=>i.complete&&i.naturalWidth>0).length}))}));await page.close();
 }
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
