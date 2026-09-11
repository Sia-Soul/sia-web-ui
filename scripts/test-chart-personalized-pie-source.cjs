const assert=require('node:assert/strict'),{execFileSync}=require('node:child_process');
const source=require('../apps/docs/src/pages/chartPersonalizedPieSource.json');
const current=JSON.parse(execFileSync(process.execPath,['scripts/inspect-chart-references.mjs','--options','--match=^pie$'],{encoding:'utf8'}));assert.deepEqual(source,current);
assert.deepEqual(source[0].option.series.map(series=>series.data.length),[3,8,5]);console.log('pie 原站配置重新采集深比较与三组数据数量通过。');
