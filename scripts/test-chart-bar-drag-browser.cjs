const assert=require('node:assert/strict');
const path=require('node:path');
const {chromium}=require(path.join(process.argv[2],'playwright'));
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.argv[3]});
 try{
  const page=await browser.newPage({viewport:{width:1700,height:1100}});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://localhost:4174/components/chart?reference='+encodeURIComponent('http://static.dtws110.com/echarts-2.2.7/doc/example/bar11.html'));
  const preview=page.locator('.chart-bar-timeline');
  await preview.getByRole('button',{name:'暂停时间轴',exact:true}).click();
  const timeline=preview.getByRole('slider',{name:'图表时间轴',exact:true});await timeline.focus();await timeline.press('Home');
  await preview.scrollIntoViewIfNeeded();
  if(process.env.CHART_DRAG_DEBUG)await page.evaluate(()=>{
   window.__chartDragEvents=[];
   for(const type of ['pointerdown','pointerup'])document.addEventListener(type,event=>window.__chartDragEvents.push({type,x:event.clientX,y:event.clientY,target:event.target.outerHTML?.slice(0,350),hits:document.elementsFromPoint(event.clientX,event.clientY).map(el=>el.closest('[data-mixed-series]')?.getAttribute('aria-label')).filter(Boolean)}),true);
  });
  const cell=(series,index)=>preview.locator(`[data-mixed-series="${series}"][data-mixed-index="${index}"]`);
  const center=async locator=>{const r=await locator.boundingBox();assert.ok(r);return {x:r.x+r.width/2,y:r.y+r.height/2};};
  const drag=async(source,target)=>{await source.scrollIntoViewIfNeeded();const a=await center(source);const b=target.x!==undefined?target:await center(target);assert.ok(await source.evaluate((el,p)=>document.elementsFromPoint(p.x,p.y).some(hit=>el.contains(hit)),a),'拖拽源必须可见且命中');await page.mouse.move(a.x,a.y);await page.mouse.down();await page.mouse.move(b.x,b.y,{steps:20});await page.mouse.up();};
  await drag(cell(0,0),cell(0,1));
  assert.ok((await cell(0,0).getAttribute('aria-label')).includes('空槽'));
  assert.ok((await cell(0,1).getAttribute('aria-label')).includes('6465.76'));
  await preview.getByRole('button',{name:'还原',exact:true}).click();
  await drag(cell(0,0),{x:20,y:100});
  assert.equal(await preview.locator('[data-mixed-series="-1"]').count(),1);
  assert.ok((await cell(0,0).getAttribute('aria-label')).includes('空槽'));
  if(process.env.CHART_DRAG_DEBUG)console.log(JSON.stringify(await cell(-1,0).evaluate(el=>({html:el.outerHTML,rect:el.getBoundingClientRect().toJSON(),ancestors:[el,...(function*(n){while(n.parentElement){n=n.parentElement;yield n;}})(el)].slice(0,9).map(n=>({tag:n.tagName,class:n.getAttribute('class'),style:getComputedStyle(n).pointerEvents,clip:getComputedStyle(n).overflow,rect:n.getBoundingClientRect().toJSON()}))}))));
  await drag(cell(-1,0),cell(0,0));
  if(process.env.CHART_DRAG_DEBUG)console.log(JSON.stringify(await page.evaluate(()=>window.__chartDragEvents)));
  assert.equal(await preview.locator('[data-mixed-series="-1"]').count(),0);
  assert.equal(await cell(0,0).getAttribute('aria-label'),'GDP，北京，4315');
  assert.deepEqual(errors,[]);
  await page.goto('http://localhost:4174/components/chart/bar');
  const card=page.locator('#chart-example-bar11');await card.scrollIntoViewIfNeeded();
  await card.locator('.chart-bar-timeline').waitFor();
  assert.equal(await page.locator('.chart-reference-card').count(),15);
  console.log('bar11 真实鼠标：GDP 跨地区相加、源空槽、拖出孤岛、拖回空槽和还原通过。');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
