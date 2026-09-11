const assert=require('node:assert/strict'),path=require('node:path');
const {chromium}=require(path.join(process.argv[2],'playwright'));
(async()=>{const browser=await chromium.launch({headless:true,executablePath:process.argv[3]});try{
 const page=await browser.newPage({viewport:{width:1600,height:1100}});
 await page.addInitScript(()=>{const serialize=XMLSerializer.prototype.serializeToString;XMLSerializer.prototype.serializeToString=function(node){const result=serialize.call(this,node);if(node.querySelector?.('[data-chart-export-heading]'))window.__riverExport=result;return result;};});
 await page.goto('http://localhost:4174/components/chart?reference='+encodeURIComponent('http://static.dtws110.com/echarts-2.2.7/doc/example/eventRiver1.html'));
 const root=page.locator('.chart-event-river-reference');await root.scrollIntoViewIfNeeded();
 const axisLabels=root.locator('.sia-chart__axis--bottom .sia-chart__axis-label');
 assert.deepEqual(await axisLabels.evaluateAll(nodes=>nodes.map(node=>[...node.querySelectorAll('tspan')].map(t=>t.textContent).join('\n'))),['04 - 30\n2014','05 - 05\n2014','05 - 12\n2014','05 - 17\n2014']);
 const positions=await axisLabels.evaluateAll(nodes=>nodes.map(node=>Number(node.getAttribute('x'))));
 [0,5,12,17.25].forEach((days,index)=>assert.ok(Math.abs(positions[index]-(80.5+835*days/17.25))<1e-8,'原站时间比例刻度'));
 const scales=root.locator('[data-event-scale]'),first=Number(await scales.first().getAttribute('data-event-scale'));
 await page.waitForTimeout(300);const second=Number(await scales.first().getAttribute('data-event-scale'));
 assert.ok(first>=.1&&second>first&&second<=1,'真实缩放入场推进');
 await page.waitForFunction(()=>[...document.querySelectorAll('.chart-event-river-reference [data-event-scale]')].every(node=>Number(node.dataset.eventScale)===1));
 // Captured from original runtime, not generated from our implementation.
 const expected=[['三星业绩暴跌',102.41314270955536,213.6159420289855],['阿里巴巴上市',175.35556155916845,116.80434782608695],['阿里巴巴上市2',255.07042947176234,165.21014492753625],['Apec峰会',156.47668984865587,358.8333333333333],['底层公务员收入超过副部长',96.21478526411886,600.8623188405797],['运城官帮透视',213.36982617968488,455.6449275362319]];
 for(const [name,y,x] of expected){const shape=root.locator(`[aria-label*="，${name}，"] path`);assert.ok(Math.abs(Number(await shape.getAttribute('data-event-center'))-y)<1e-8,name+' 原站Y');const start=Number((await shape.getAttribute('d')).match(/^M([^,]+)/)[1]);assert.ok(Math.abs(start-x)<1e-8,name+' 原站X');}
 assert.equal(await root.locator('path.sia-chart__event-river').first().getAttribute('fill'),'#2ec7c9');
 await root.locator('.sia-chart__legend').getByRole('button',{name:'财经事件',exact:true}).click();assert.equal(await scales.count(),3);
 assert.deepEqual(await axisLabels.evaluateAll(nodes=>nodes.map(node=>[...node.querySelectorAll('tspan')].map(t=>t.textContent).join('\n'))),['05 - 05\n2014','05 - 12\n2014','05 - 17\n2014']);
 await root.getByRole('button',{name:'还原',exact:true}).click();assert.equal(await scales.count(),6);
 await page.waitForFunction(()=>[...document.querySelectorAll('.chart-event-river-reference [data-event-scale]')].every(node=>Number(node.dataset.eventScale)===1));
 const downloadPromise=page.waitForEvent('download');await root.getByRole('button',{name:'保存为图片',exact:true}).click();const download=await downloadPromise;assert.equal(await download.failure(),null);await download.saveAs('apps/docs/chart-event-river-export.png');
 const exported=await page.evaluate(()=>{
  const doc=new DOMParser().parseFromString(window.__riverExport,'image/svg+xml'),svg=document.importNode(doc.documentElement,true);svg.style.position='fixed';svg.style.left='-10000px';document.body.appendChild(svg);
  try{return [...svg.querySelectorAll('[data-chart-export-heading]')].map(node=>{const box=node.getBBox();return {text:node.textContent,x:box.x,y:box.y,right:box.x+box.width,bottom:box.y+box.height};});}finally{svg.remove();}
 });
 assert.deepEqual(exported.map(item=>item.text),['Event River','纯属虚构']);
 assert.ok(exported.every(item=>item.x>=0&&item.y>=0&&item.right<=1015&&item.bottom<=398),'导出标题完整位于画布内');
 await page.emulateMedia({reducedMotion:'reduce'});await root.getByRole('button',{name:'还原',exact:true}).click();assert.equal(Number(await scales.first().getAttribute('data-event-scale')),1);
 console.log('eventRiver1 原站6事件X/Y匹配、真实缩放动画、配色、图例还原、PNG导出与减少动态效果通过。');
 }finally{await browser.close();}})().catch(error=>{console.error(error);process.exitCode=1;});
