const assert=require('node:assert/strict');
const path=require('node:path');
const {createRequire}=require('node:module');
const localRequire=createRequire(path.resolve('packages/react/package.json'));
const React=localRequire('react');
const {renderToStaticMarkup}=localRequire('react-dom/server');
const {ScatterChart}=localRequire('./dist/chart.cjs');
const render=(points,extra={})=>renderToStaticMarkup(React.createElement(ScatterChart,{
 data:points,animation:false,showLegend:false,showPointLabels:true,
 xDomain:[0,3400,680],yDomain:[0,53500,10700],
 plotBounds:{x:80,y:80,width:500,height:200},...extra,
}));
const a=render([{name:'北京',x:1700,y:26750,size:5}]);
assert.match(a,/cx="330" cy="180" r="5"/);
assert.match(a,/>北京<\/text>/);
assert.match(a,/>3\.4k<\/tspan>/);
assert.match(a,/>53\.5k<\/tspan>/);
const b=render([{name:'北京',x:850,y:13375,size:5}]);
assert.match(b,/cx="205" cy="230" r="5"/);
assert.match(b,/>53\.5k<\/tspan>/);
const hidden=render([{name:'北京',x:850,y:13375,size:5}],{showPointLabels:false});
assert.doesNotMatch(hidden,/>北京<\/text>/);
console.log('固定散点坐标跨数据更新保持范围、坐标投影及名称标签开关通过。');
