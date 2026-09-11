const assert=require('node:assert/strict');
const path=require('node:path');
const {createRequire}=require('node:module');
const localRequire=createRequire(path.resolve('packages/react/package.json'));
const React=localRequire('react');
const {renderToStaticMarkup}=localRequire('react-dom/server');
const {MixedChart}=localRequire('./dist/chart.cjs');
const series=[{name:'GDP',type:'bar',data:[25000],valueAxisIndex:0},{name:'房地产',type:'line',data:[250],valueAxisIndex:1}];
const render=(extra={})=>renderToStaticMarkup(React.createElement(MixedChart,{
 categories:['北京'],series,animation:false,
 valueAxes:[{name:'GDP（亿元）',domain:[0,50000,10000]},{name:'其他（亿元）',domain:[0,500,100]}],...extra,
}));
function mark(html,name){return html.split(`aria-label="${name}，北京，`)[1]?.split('</g>')[0]??'';}
const html=render();
assert.equal((html.match(/data-value-axis=/g)||[]).length,2);
assert.match(html,/GDP（亿元）/);assert.match(html,/其他（亿元）/);
assert.match(mark(html,'GDP'),/y="173"/);
assert.match(mark(html,'房地产'),/cy="173"/);
assert.match(mark(render({legendSelected:{GDP:false}}),'房地产'),/cy="173"/);
const independent=render({series:[series[0],{...series[1],data:[400]}],valueAxes:[{domain:[0,50000,10000]},{}]});
assert.match(mark(independent,'房地产'),/cy="48"/);
const legacy=render({valueAxes:undefined});
assert.equal((legacy.match(/data-value-axis=/g)||[]).length,0);
console.log('MixedChart 双轴：柱与线按各自固定域定位、隐藏系列不改变另一固定轴、独立自动域和单轴兼容通过。');
const stackedSeries=[{name:'A',type:'bar',data:[20],valueAxisIndex:0},{name:'B',type:'bar',data:[30],valueAxisIndex:0},{name:'C',type:'bar',data:[200],valueAxisIndex:1}];
const stacked=render({series:stackedSeries,stacked:true,valueAxes:[{domain:[0,100,20]},{domain:[0,1000,200]}]});
const rect=(html,name)=>{const match=mark(html,name).match(/<rect ([^>]+)/);return Object.fromEntries([...match[1].matchAll(/(\w+)="([\d.-]+)"/g)].map(m=>[m[1],Number(m[2])]));};
assert.equal(rect(stacked,'A').x,rect(stacked,'B').x);
assert.notEqual(rect(stacked,'A').x,rect(stacked,'C').x);
assert.equal(rect(stacked,'A').y,248);
assert.equal(rect(stacked,'B').y,173);
assert.equal(rect(stacked,'B').height,75);
assert.equal(rect(stacked,'C').y,248);
const tiled=render({series:stackedSeries,stacked:false,valueAxes:[{domain:[0,100,20]},{domain:[0,1000,200]}]});
assert.notEqual(rect(tiled,'A').x,rect(tiled,'B').x);
assert.equal(rect(tiled,'B').y,223);
const hiddenStack=render({series:stackedSeries,stacked:true,legendSelected:{A:false},valueAxes:[{domain:[0,100,20]},{domain:[0,1000,200]}]});
assert.equal(rect(hiddenStack,'B').y,223);
const negative=render({series:[{name:'A',type:'bar',data:[-20]},{name:'B',type:'bar',data:[-30]},{name:'C',type:'bar',data:[20]}],stacked:true,valueAxes:[{domain:[-100,100,40]}]});
assert.equal(rect(negative,'A').y,173);
assert.equal(rect(negative,'B').y,198);
assert.equal(rect(negative,'C').y,148);
const lines=render({series:stackedSeries.slice(0,2).map(s=>({...s,type:'line'})),stacked:true,valueAxes:[{domain:[0,100,20]}]});
assert.match(mark(lines,'B'),/cy="173"/);
console.log('MixedChart 堆叠：同轴累计、跨轴隔离、平铺、隐藏重算、正负分离及折线累计通过。');
for(const type of ['bar','line']){
 const average=render({categories:['北京','天津'],series:[{name:'GDP',type,data:[20,40],markAverage:true,markColor:'orange',markFormatter:value=>`平均 ${Math.round(value)}`}],valueAxes:[{domain:[0,100,20]}]});
 const marker=average.split('data-mixed-average="GDP"')[1].split('</g>')[0];
 assert.match(marker,/y1="223"/);
 assert.match(marker,/stroke:orange/);
 assert.match(marker,/>平均 30<\/text>/);
}
console.log('MixedChart GDP 均值：柱/线模式均按原始值计算，轴定位、颜色与格式回调通过。');
for(const type of ['bar','line']){
 const missing=render({categories:['A','B','C','D','E'],series:[{name:'GDP',type,data:[10,20,null,30,40],area:true,markAverage:true}],valueAxes:[{domain:[0,100,20]}]});
 assert.equal((missing.match(/role="graphics-symbol"/g)||[]).length,4);
 assert.doesNotMatch(missing,/GDP，C，0/);
 assert.match(missing,/data-mixed-average="GDP"[\s\S]*?>25<\/text>/);
 if(type==='line'){
  assert.equal((missing.match(/class="sia-chart__line sia-chart__line--draw"/g)||[]).length,2);
  assert.equal((missing.match(/class="sia-chart__area"/g)||[]).length,2);
 }
}
const allMissing=render({series:[{name:'GDP',type:'line',data:[null],markAverage:true}],valueAxes:[{}]});
assert.doesNotMatch(allMissing,/role="graphics-symbol"|data-mixed-average|NaN/);
console.log('MixedChart 空槽：柱项省略、折线/面积断开、均值排除缺失、全部为空不产生 NaN 通过。');
