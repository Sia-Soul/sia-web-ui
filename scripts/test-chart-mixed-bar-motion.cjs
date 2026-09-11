const assert=require('node:assert/strict'),path=require('node:path'),{createRequire}=require('node:module');
const requireDocs=createRequire(path.resolve('apps/docs/package.json'));
const React=requireDocs('react'),{renderToStaticMarkup}=requireDocs('react-dom/server');
const {MixedChart}=require('../packages/react/dist/chart.cjs');
function render(progress,coordinateAnimation=true){
 const html=renderToStaticMarkup(React.createElement(MixedChart,{categories:['A'],series:[{name:'positive',type:'bar',data:[100]},{name:'negative',type:'bar',data:[-50]}],valueAxes:[{domain:[-100,100,50]}],plotBounds:{x:0,y:0,width:200,height:200},showLegend:false,coordinateAnimation,animationProgress:progress}));
 return [...html.matchAll(/<rect\b[^>]*class="sia-chart__bar"[^>]*>/g)].map(([tag])=>({y:Number(tag.match(/\sy="([^"]+)"/)[1]),height:Number(tag.match(/\sheight="([^"]+)"/)[1]),inline:tag.includes('animation:none')}));
}
assert.deepEqual(render(0),[{y:100,height:0,inline:true},{y:100,height:0,inline:true}]);
assert.deepEqual(render(.1),[{y:50,height:50,inline:true},{y:100,height:25,inline:true}]);
assert.deepEqual(render(1),[{y:0,height:100,inline:true},{y:100,height:50,inline:true}]);
assert.deepEqual(render(undefined,false),[{y:0,height:100,inline:false},{y:100,height:50,inline:false}]);
console.log('MixedChart 正负柱沿基线生长、10%时刻单次指数缓动、最终几何及默认模式通过。');
