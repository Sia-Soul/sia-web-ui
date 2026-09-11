const assert=require('node:assert/strict');
const {execFileSync}=require('node:child_process');
const saved=require('../apps/docs/src/pages/chartPersonalizedMapSource.json');
const image=require('../apps/docs/src/pages/chartPersonalizedMapImage.json');
(async()=>{
 const current=JSON.parse(execFileSync(process.execPath,['scripts/inspect-chart-references.mjs','--options','--match=^map$'],{encoding:'utf8'}));assert.deepEqual(saved,current);
 const response=await fetch(image.url);assert.ok(response.ok);
 assert.deepEqual(Buffer.from(image.data.split(',')[1],'base64'),Buffer.from(await response.arrayBuffer()));
 assert.equal(saved[0].option.series[0].data[0].value.$expression,'Math.round(Math.random()*1000)');
 assert.deepEqual(saved[0].option.series[0].markPoint.data.slice(0,2).map(p=>p.value),[350,103]);
 console.log('map：保存配置与原站深比较、原始图片字节比较、随机表达式及标点数值通过。');
})().catch(error=>{console.error(error);process.exitCode=1;});
