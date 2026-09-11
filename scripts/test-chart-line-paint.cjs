const assert=require('node:assert/strict'),path=require('node:path');
const {createRequire}=require('node:module');
const local=createRequire(path.resolve('apps/docs/package.json'));
const React=local('react'),{renderToStaticMarkup}=local('react-dom/server');
const {LineChart}=require('../packages/react/dist/chart.cjs');
const html=renderToStaticMarkup(React.createElement(LineChart,{animation:false,categories:['周一','周二'],series:[
 {name:'面积',data:[120,132],area:true,areaGradient:{start:[0,200],end:[0,400],stops:[{offset:0,color:'rgba(255,0,0,0.8)'},{offset:.8,color:'rgba(255,255,255,0.1)'}]}},
 {name:'阴影',data:[620,732],lineShadow:{color:'rgba(0,0,0,0.5)',blur:10,offsetX:8,offsetY:8}},
 {name:'星形',data:[201,390],symbol:'none',pointStyles:[{symbol:'star',symbolSize:30},{symbol:'star6',symbolSize:40,symbolRotate:10}]},
]}));
assert.match(html,/gradientUnits="userSpaceOnUse" x1="0" y1="200" x2="0" y2="400"/);
assert.match(html,/offset="0.8" stop-color="rgba\(255,255,255,0.1\)"/);
assert.match(html,/<path[^>]+fill="url\(#[^"]+-area\)"[^>]+style="opacity:1"[^>]+sia-chart__area/);
assert.ok(html.includes('drop-shadow(8px 8px 10px rgba(0,0,0,0.5))'));
const icon=require('node:fs').readFileSync('apps/docs/src/pages/chartPersonalizedLineIcon.ts','utf8').match(/data:image\/png;base64,[^']+/)[0];
const images=renderToStaticMarkup(React.createElement(LineChart,{animation:false,categories:['周一','周二'],series:[{name:'图片',data:[120,82],symbol:'image',symbolImage:icon,symbolSize:16,pointStyles:[{}, {symbol:'star',symbolSize:30}]}]}));
assert.equal((images.match(/data-chart-symbol="image"/g)||[]).length,1);assert.ok(images.includes(`href="${icon}"`));assert.match(images,/<image[^>]+width="16" height="16" preserveAspectRatio="none"/);assert.ok(images.includes('data-chart-symbol="star"'));
assert.match(html,/data-chart-symbol="star"/);assert.match(html,/data-chart-symbol="star6"/);assert.match(html,/transform="rotate\(10 /);
for(const symbol of ['heart','emptyHeart','droplet','pin','emptyPin','arrow']){
 const marker=renderToStaticMarkup(React.createElement(LineChart,{animation:false,categories:['周一'],series:[{name:'特殊标记',data:[10],symbol,symbolSize:20,color:'red'}]}));
 assert.ok(marker.includes(`data-chart-symbol="${symbol}"`));
 if(symbol.startsWith('empty'))assert.match(marker,/<path data-chart-symbol="[^"]+" d="[^"]+" fill="#fff" stroke="red"/);
}
console.log('LineChart 面积绝对坐标渐变、alpha 保留、折线独立阴影 SSR 渲染通过。');
