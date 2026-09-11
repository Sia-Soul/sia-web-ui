const assert=require('node:assert/strict'),fs=require('node:fs');
(async()=>{
 const saved=fs.readFileSync('apps/docs/src/pages/chartPersonalizedLineIcon.ts','utf8').match(/data:image\/png;base64,([^']+)/)[1];
 const bytes=Buffer.from(saved,'base64');
 const response=await fetch('http://static.dtws110.com/echarts-2.2.7/doc/asset/ico/favicon.png');assert.equal(response.status,200);
 assert.deepEqual(bytes,Buffer.from(await response.arrayBuffer()));assert.equal(bytes.readUInt32BE(16),20);assert.equal(bytes.readUInt32BE(20),20);
 console.log('line 图片标记原始 PNG 字节一致，20×20，内嵌资源可离线引用。');
})().catch(error=>{console.error(error);process.exitCode=1;});
