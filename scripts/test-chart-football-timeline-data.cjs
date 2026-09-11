const assert=require('node:assert/strict'),fs=require('node:fs'),ts=require('typescript'),{execFileSync}=require('node:child_process');
const source=require('../apps/docs/src/pages/chartFootballTimelineSource.json')[0],option=source.option;
const code=ts.transpileModule(fs.readFileSync('apps/docs/src/pages/chartFootballTimelineData.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const target={exports:{}};new Function('module','exports',code)(target,target.exports);const {createFootballTimelineData,resolveFootballCoordinate,footballTimelineLabel}=target.exports;
const online=JSON.parse(execFileSync(process.execPath,['scripts/inspect-chart-references.mjs','--options','--match=^map19$'],{encoding:'utf8'}));assert.deepEqual(online[0].option,option,'完整原页配置复核');
let calls=0;const frames=createFootballTimelineData(option.options,()=>{calls++;return .5;});assert.equal(calls,30);assert.equal(frames.length,12);assert.deepEqual(option.timeline.data,[1,2,3,4,5,6,7,8,9,10,11,12]);assert.equal(option.timeline.playInterval,500);assert.equal(option.timeline.autoPlay,true);
const expectedExpression={'110+(Math.random()*3)':111.5,'750-(Math.random()*3)':748.5,'110+(Math.random()*2)':111,'296.913+(Math.random()*3)':298.413,'750+(Math.random()*5)':752.5};
const expectedCoordinate=point=>point.geoCoord.map(value=>typeof value==='number'?value:expectedExpression[value.$expression]);
for(const [i,frame] of frames.entries()){
 const original=option.options[i].series[0];assert.equal(frame.points.length,22);assert.equal(frame.lines.length,1);
 for(const [j,point] of frame.points.entries()){const raw=original.markPoint.data[j];assert.equal(point.name,raw.name);assert.equal(point.value,raw.value);assert.deepEqual(point.coordinate,expectedCoordinate(raw));assert.equal(point.symbol,'circle');assert.equal(point.size,8);assert.equal(point.color,j<11?'blue':'red');}
 const line=frame.lines[0],pair=original.markLine.data[0];assert.deepEqual(line.source,expectedCoordinate(pair[0]));assert.deepEqual(line.target,expectedCoordinate(pair[1]));assert.equal(line.color,'gold');assert.equal(line.width,1);assert.equal(line.smooth,true);assert.deepEqual(line.effect,{show:true,scaleSize:1.5,period:1.5,color:'#fff'});
}
assert.equal(footballTimelineLabel(9),'00:09');assert.equal(footballTimelineLabel(10),'00:010');assert.equal(footballTimelineLabel(11),'00:11');
assert.throws(()=>resolveFootballCoordinate({$expression:'globalThis.injected=true'},()=>0),/未支持/);assert.equal(globalThis.injected,undefined);
assert.equal(resolveFootballCoordinate({$expression:'750-(Math.random()*3)'},()=>0),750);assert.equal(resolveFootballCoordinate({$expression:'750-(Math.random()*3)'},()=>.999),747.003);
let independent=0;const different=createFootballTimelineData(option.options,()=>++independent/100);assert.notDeepEqual(different[11].lines[0].target,different[11].points[11].coordinate,'终点和门将坐标表达式各自采样，不强行吸附');
console.log('map19数据：12帧/264球员/12传球线、30采样、继承样式/效果、原时间标签与拒绝执行表达式通过；未注册。');
