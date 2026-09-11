import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const url='http://static.dtws110.com/echarts-2.2.7/doc/example/eventRiver2_data.js';
const response=await fetch(url);if(!response.ok)throw new Error(`原始数据请求失败 ${response.status}`);
const source=await response.text();
const match=source.match(/^\s*var\s+eventRiver2Data\s*=\s*([\s\S]*?)\s*;?\s*$/);
if(!match)throw new Error('原始数据声明不匹配');
// Only parse JSON; never evaluate downloaded JavaScript.
const groups=JSON.parse(match[1]);
if(!Array.isArray(groups)||groups.some(group=>group.type!=='eventRiver'||!Array.isArray(group.data)))throw new Error('原始系列结构变化');
const metadata={url,sha256:createHash('sha256').update(source).digest('hex'),characters:source.length,series:groups.map(group=>({name:group.name,weight:group.weight,events:group.data.length,points:group.data.reduce((sum,event)=>sum+event.evolution.length,0)}))};
const archiveGroup=process.argv.find(arg=>arg.startsWith('--archive-group='));
if(process.argv.includes('--verify-archive')){
 const archived=await Promise.all(groups.map(group=>readFile(new URL(`../docs/chart-event-river2-archive/group-${group.name}.json`,import.meta.url),'utf8').then(JSON.parse)));
 assert.deepEqual(archived,groups,'完整归档必须逐字段匹配原始数据');
 const plot=JSON.parse(await readFile(new URL('../apps/docs/src/pages/chartLargeEventRiverPlotSource.json',import.meta.url),'utf8'));
 assert.deepEqual(plot.metadata,metadata,'归档原文件校验值与绘图快照来源一致');
 assert.deepEqual(plot.groups,archived.map(group=>({name:group.name,type:group.type,weight:group.weight,data:group.data.map(event=>({name:event.name,weight:event.weight,event_id:event.event_id,evolution:event.evolution}))})),'绘图快照必须来自完整归档');
 console.log('eventRiver2 完整6系列83事件逐字段在线比对、SHA-256和绘图快照一致性通过。');
}else if(archiveGroup){
 const index=Number(archiveGroup.split('=')[1]);if(!Number.isInteger(index)||index<0||index>=groups.length)throw new Error('归档系列索引无效');
 console.log(JSON.stringify(groups[index]));
}else if(process.argv.includes('--plot-data')){
 console.log(JSON.stringify({metadata,groups:groups.map(group=>({name:group.name,type:group.type,weight:group.weight,data:group.data.map(event=>({name:event.name,weight:event.weight,event_id:event.event_id,evolution:event.evolution}))}))}));
}else console.log(JSON.stringify(metadata));
