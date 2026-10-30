// 采样真实液体轮廓，验证沙漏细颈、两端体积、双向流动及中断接续。
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),http=require('node:http');
const {createRequire}=require('node:module');
const ui=createRequire(path.resolve('packages/react/package.json'));
const {buildSync}=createRequire(ui.resolve('tsup'))('esbuild');
const {chromium}=require(path.join(process.env.USERPROFILE,'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));
(async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'sia-radio-selection-'));
 buildSync({entryPoints:['scripts/fixtures/radio-selection.tsx'],bundle:true,nodePaths:[path.resolve('packages/react/node_modules')],format:'iife',platform:'browser',jsx:'automatic',outfile:path.join(dir,'fixture.js'),define:{'process.env.NODE_ENV':'"production"'}});
 const server=http.createServer((req,res)=>{
  if(['/fixture.js','/fixture.css'].includes(req.url)){res.setHeader('Content-Type',req.url.endsWith('.css')?'text/css':'application/javascript');res.end(fs.readFileSync(path.join(dir,req.url.slice(1))));}
  else{res.setHeader('Content-Type','text/html; charset=utf-8');res.end('<meta charset="utf-8"><link rel="stylesheet" href="/fixture.css"><div id="root"></div><script src="/fixture.js"></script>');}
 });
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const browser=await chromium.launch({channel:'msedge',headless:true});
 try{
  const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(`http://127.0.0.1:${server.address().port}`);
  const group=page.locator('.solid'),indicator=group.locator('.sia-radio-group__selection');
  await indicator.waitFor({state:'visible'});
  await page.screenshot({path:'logs/radio-selection-initial.png'});
  const initial=await indicator.boundingBox();
  const shapeAt=async time=>indicator.evaluate((el,time)=>{
    const a=el.getAnimations()[0];a.pause();a.currentTime=time;
    const rect=el.getBoundingClientRect(),path=getComputedStyle(el).clipPath;
    const values=path.match(/[-+]?\d*\.?\d+(?:e[-+]?\d+)?/gi).map(Number);
    const points=Array.from({length:26},(_,i)=>[values[i*2]+rect.x,values[i*2+1]+rect.y]);
    return {points,duration:a.effect.getTiming().duration};
  },time);
  await group.getByText('每天',{exact:true}).click();
  assert.equal(await page.locator('output').textContent(),'每天','回调不能等待动画');
  const target=await group.locator('label').first().boundingBox();
  const start=await shapeAt(0),middleShape=await shapeAt(140),end=await shapeAt(280);
  assert.equal(start.duration,280);assert.ok(Math.abs(Math.min(...start.points.map(p=>p[0]))-initial.x)<1);
  const neckHeight=middleShape.points[17][1]-middleShape.points[4][1];
  const bodyHeight=middleShape.points[21][1]-middleShape.points[0][1];
  assert.ok(neckHeight<bodyHeight*.2,'中间必须收成细颈，两侧保持液体体积');
  assert.ok(middleShape.points[1][0]<middleShape.points[4][0] && middleShape.points[7][0]>middleShape.points[4][0]);
  assert.ok(Math.abs(Math.max(...end.points.map(p=>p[0]))-target.x-target.width)<1,'流入后铺满目标');
  const before=await shapeAt(140);
  await page.screenshot({path:'logs/radio-selection-midpoint.png'});
  await group.getByText('每周较长选项',{exact:true}).click();
  const after=await shapeAt(0);
  before.points.forEach((point,i)=>point.forEach((coordinate,axis)=>assert.ok(Math.abs(coordinate-after.points[i][axis])<.1,'快速折返保留当前液体轮廓')));
  await indicator.evaluate(el=>el.getAnimations().forEach(a=>a.finish()));await page.waitForTimeout(30);
  const aligned=await indicator.boundingBox(),middle=await group.locator('label').nth(1).boundingBox();
  assert.ok(Math.abs(aligned.width-middle.width)<1);
  // 自身背景不能与共享背景重复填充；文字没有缩放动画。
  const style=await group.locator('label').nth(1).evaluate(el=>({background:getComputedStyle(el).backgroundColor,animations:el.getAnimations().filter(a=>a.effect.getKeyframes().some(f=>f.scale || f.transform)).length}));
  assert.equal(style.background,'rgb(255, 255, 255)');assert.equal(style.animations,0);
  await group.getByRole('radio',{name:'每周较长选项'}).focus();await page.keyboard.press('ArrowRight');
  assert.equal(await page.locator('output').textContent(),'每月');
  assert.equal(await indicator.evaluate(el=>el.getAnimations()[0].effect.getTiming().duration),280);
  await page.waitForTimeout(350);await group.getByRole('radio',{name:'禁用'}).evaluate(el=>el.click());
  assert.equal(await page.locator('output').textContent(),'每月');
  assert.equal(await page.locator('.outline .sia-radio-group__selection').count(),0);
  await page.locator('.children').getByText('选项 B').click();await page.waitForTimeout(350);
  const child=await page.locator('.children label').last().evaluate(el=>getComputedStyle(el).borderTopRightRadius);assert.notEqual(child,'0px','共享层不能破坏最后一项圆角');
  // 记录当前设备上的真实帧间隔与长任务；轮廓预计算完成后由浏览器播放，没有逐帧 React 更新。
  const perf=await page.evaluate(async()=>{
    const frames=[],longTasks=[];let done=false;
    const observer=new PerformanceObserver(list=>longTasks.push(...list.getEntries().map(entry=>entry.duration)));observer.observe({type:'longtask'});
    const sample=time=>{frames.push(time);if(!done)requestAnimationFrame(sample)};requestAnimationFrame(sample);
    const inputs=[...document.querySelectorAll('.solid input')];
    for(const index of [0,2,1]){inputs[index].click();await new Promise(resolve=>setTimeout(resolve,400));}
    done=true;longTasks.push(...observer.takeRecords().map(entry=>entry.duration));observer.disconnect();
    const delta=frames.slice(1).map((time,index)=>time-frames[index]).sort((a,b)=>a-b);
    return {frames:frames.length,p50:delta[Math.floor(delta.length*.5)],p95:delta[Math.floor(delta.length*.95)],longTasks};
  });
  await page.emulateMedia({reducedMotion:'reduce'});await group.getByText('每天',{exact:true}).click();
  assert.equal(await indicator.evaluate(el=>el.getAnimations().length),0);
  await page.setViewportSize({width:800,height:600});await page.waitForTimeout(80);
  const reduced=await indicator.boundingBox(),selected=await group.locator('label').first().boundingBox();assert.ok(Math.abs(reduced.x-selected.x)<1);
  assert.deepEqual(errors,[]);console.log('PASS Radio 液体沙漏细颈与两端轮廓、双向等时长、连续折返、不等宽、键盘、禁用、子项圆角和减少动态效果。',JSON.stringify(perf));
 }finally{await browser.close();await new Promise(resolve=>server.close(resolve));fs.rmSync(dir,{recursive:true,force:true});}
})().catch(e=>{console.error(e);process.exitCode=1});
