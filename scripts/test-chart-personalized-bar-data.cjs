const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {execFileSync}=require('node:child_process'),{createRequire}=require('node:module'),ts=require('typescript');
const saved=require('../apps/docs/src/pages/chartPersonalizedBarSource.json');
const current=JSON.parse(execFileSync(process.execPath,['scripts/inspect-chart-references.mjs','--options','--match=^bar$'],{encoding:'utf8'}));
assert.deepEqual(current,saved,'重新获取原站配置，不执行原站表达式');
const filename=path.resolve('apps/docs/src/pages/chartPersonalizedBarData.ts'),moduleData={exports:{}};
new Function('require','module','exports',ts.transpileModule(fs.readFileSync(filename,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,esModuleInterop:true,target:ts.ScriptTarget.ES2022}}).outputText)(createRequire(filename),moduleData,moduleData.exports);
const {original,series}=moduleData.exports;
assert.deepEqual(series.map(s=>s.name),original.legend.data);
assert.equal(original.xAxis[0].data.length,7);
for(let row=0;row<4;row++){
 assert.equal(series[row].stack,original.series[row].stack);
 assert.deepEqual(series[row].data.map(d=>typeof d==='number'?d:Number.isFinite(d.value)?d.value:null),original.series[row].data.map(d=>typeof d==='number'?d:typeof d==='string'?null:d.value));
}
assert.deepEqual(series[0].fillGradient,{start:[0,400],end:[0,300],stops:[{offset:0,color:'green'},{offset:1,color:'yellow'}]});
assert.deepEqual(series[0].emphasisFillGradient.stops,[{offset:0,color:'red'},{offset:1,color:'orange'}]);
assert.equal(series[0].emphasisLabelFormatter(220,'周一',0),'邮件营销 周一 220');
assert.equal(series[1].data[1].hidden,true);
assert.deepEqual(series[2].data[4],{value:390,symbolSize:10,color:'lime',emphasisColor:'skyBlue'});
assert.equal(series[3].data[2].labelPosition,'inside');assert.equal(series[3].barWidth,40);
assert.deepEqual(series[3].statisticLines,['average','max','min']);
assert.deepEqual(series[3].labelStyle,{fontSize:20,fontFamily:'微软雅黑',fontWeight:'bold'});
console.log('bar 原站配置深比较、28 个数据位置含缺失项、堆叠、个性化样式和标签通过。');
