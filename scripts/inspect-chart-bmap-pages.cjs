const assert=require('node:assert/strict');
(async()=>{
 for(const id of ['BMap','example']){
  const url=`http://static.dtws110.com/echarts-2.2.7/extension/BMap/doc/${id}.html`;
  const response=await fetch(url);assert.ok(response.ok);const html=await response.text();
  console.log(JSON.stringify({url,links:[...html.matchAll(/(?:src|href)\s*=\s*["']([^"']+)["']/g)].map(m=>new URL(m[1],url).href),scripts:[...html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)].map(m=>m[1]).filter(Boolean)}));
 }
})().catch(error=>{console.error(error);process.exitCode=1;});
