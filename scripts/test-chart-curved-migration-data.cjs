const assert=require('node:assert/strict'),fs=require('node:fs'),ts=require('typescript'),{execFileSync}=require('node:child_process');
const source=require('../apps/docs/src/pages/chartCurvedMigrationSource.json');
assert.deepEqual(JSON.parse(execFileSync(process.execPath,['scripts/inspect-chart-references.mjs','--options','--match=^map21$'],{encoding:'utf8'})),source);
const code=ts.transpileModule(fs.readFileSync('apps/docs/src/pages/chartCurvedMigrationData.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const target={exports:{}};new Function('module','exports','require',code)(target,target.exports,()=>({default:source}));const {curvedMigrationGroups:groups}=target.exports;
assert.deepEqual(groups.map(g=>g.name),['北京','上海','广州']);const coords=source[0].option.series[0].geoCoord;
for(const [i,group]of groups.entries()){assert.equal(group.lines.length,10);assert.deepEqual(group.lines.map(l=>l.value),[95,90,80,70,60,50,40,30,20,10]);assert.deepEqual(group.lines.map(l=>l.curveness),[.2,.3,.4,.5,.6,.2,.3,.4,.5,.6]);for(const [j,line]of group.lines.entries()){const pair=source[0].option.series[i].markLine.data[j];assert.deepEqual(line.source,coords[pair[0].name]);assert.deepEqual(line.target,coords[pair[1].name]);assert.equal(line.name,pair[0].name+' > '+pair[1].name);}}
assert.equal(source[0].option.animationDurationUpdate,2000);console.log('map21 原页配置、三组30线路、全部原坐标/方向/数值及五档曲率通过；未注册。');
