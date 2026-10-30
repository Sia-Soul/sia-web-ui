// 真实浏览器验证外壳先出现、正文延后、开合中断和键盘焦点，记录帧间隔但不硬编码设备帧率。
const assert = require('node:assert/strict');
const { createRequire } = require('node:module');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');
const requireUi = createRequire(path.resolve('packages/react/package.json'));
const { buildSync } = createRequire(requireUi.resolve('tsup'))('esbuild');
const modules = path.join(process.env.USERPROFILE, '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules');
const { chromium } = require(path.join(modules, 'playwright'));
(async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'sia-motion-consistency-'));
  buildSync({ entryPoints: ['scripts/fixtures/motion-consistency.tsx'], bundle: true, nodePaths: [path.resolve('packages/react/node_modules')], format: 'iife', platform: 'browser', jsx: 'automatic', outfile: path.join(directory, 'fixture.js'), define: { 'process.env.NODE_ENV': '"production"' } });
  const server = http.createServer((req, res) => {
    if (req.url === '/fixture.js' || req.url === '/fixture.css') { res.setHeader('Content-Type', req.url.endsWith('.css') ? 'text/css' : 'application/javascript'); res.end(fs.readFileSync(path.join(directory, req.url.slice(1)))); }
    else { res.setHeader('Content-Type', 'text/html; charset=utf-8'); res.end('<meta charset="utf-8"><link rel="stylesheet" href="/fixture.css"><div id="root"></div><script src="/fixture.js"></script>'); }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  try {
    const page = await browser.newPage();
    page.on('pageerror', error => console.error(error.message));
    await page.goto(`http://127.0.0.1:${server.address().port}`);
    const errors=[];page.on('pageerror',error=>errors.push(error.message));
    // 生产渲染只有一次布局副作用，不能依赖 StrictMode 再执行才获得父节点。
    const initialMenu=page.locator('#initial-menu');
    assert.equal(await initialMenu.locator('.sia-menu__selection').evaluate(node=>getComputedStyle(node).display),'block');
    const firstMotion=await initialMenu.evaluate(node=>{
      node.querySelector('[data-menu-key="b"]').click();
      return new Promise(resolve=>requestAnimationFrame(()=>resolve(node.querySelector('.sia-menu__selection').getAnimations().length)));
    });
    assert.equal(firstMotion,1,'首次切换也必须滑动选中背景');
    const sample = async (selector, times) => page.locator(selector).evaluate((node,times)=>{
      const animation=node.getAnimations()[0];animation.pause();
      const values=times.map(time=>{animation.currentTime=time;const css=getComputedStyle(node);return [css.transform,css.opacity,css.clipPath,css.filter]});
      return {values,frames:animation.effect.getKeyframes(),timing:animation.effect.getTiming()};
    },times);
    const finish=selector=>page.locator(selector).evaluate(node=>node.getAnimations().forEach(animation=>animation.finish()));
    const cases=[['popup','bottom'],['popup','top'],['popup','left'],['popup','right'],['drawer','left'],['drawer','right'],['drawer','top'],['drawer','bottom'],['modal','bottom'],['tooltip','bottom'],['message','bottom'],['toast','bottom'],['fade','bottom']];
    for(const [kind,placement] of cases){
      await page.evaluate(([kind,placement])=>{window.configure(kind,placement);window.toggle(true)},[kind,placement]);
      const duration=await page.locator('#surface').evaluate(node=>node.getAnimations()[0].effect.getTiming().duration);
      const times=[.05,.2,.4,.6,.8,.95].map(p=>duration*p);
      const entering=await sample('#surface',times);
      await finish('#surface');await page.waitForTimeout(30);
      await page.evaluate(()=>window.toggle(false));
      const panel=['drawer','modal'].includes(kind);
      const closeDuration=kind==='drawer'?180:160;
      const exiting=await sample('#surface',panel?[0,.25,.5,.75,1].map(p=>p*closeDuration):kind==='popup'?[0,28,56,84,112,140]:times.map(time=>duration-time));
      if(kind==='popup'){
        assert.equal(entering.timing.duration,260);
        assert.equal(exiting.timing.duration,140);
        assert.equal(exiting.timing.direction,'normal');
        assert.equal(exiting.frames.length,2,'收起直接缩小淡出，没有下沉预备段');
        assert.equal(Number(exiting.values[0][1]),1);
        assert.equal(Number(exiting.values.at(-1)[1]),0,'退出恢复渐隐');
        assert.ok(exiting.values.every((value,i)=>!i || Number(value[1])<=Number(exiting.values[i-1][1])),'退场透明度连续减小');
        for(const frame of [...entering.frames,...exiting.frames]){
          assert.ok(!('clipPath' in frame) && !('filter' in frame) && !('borderRadius' in frame),'不能动画昂贵的裁剪、虚化或覆盖最终外观');
        }
        assert.ok(entering.values.every(value=>value[2]==='none' && value[3]==='none'));
        assert.notEqual(entering.values[0][0],entering.values[1][0],'展开连续移动，不重放录制停顿');
      }else if(panel){
        assert.equal(exiting.timing.duration,closeDuration,kind+' 快速关闭');
        assert.equal(exiting.timing.direction,'normal');
        assert.equal(exiting.frames.length,2,'退出没有回弹关键帧');
        const matrices=exiting.values.map(([transform])=>transform);
        const monotonic=await page.evaluate(matrices=>{
          const m=matrices.map(value=>new DOMMatrix(value));
          return m.every((v,i)=>!i || (v.a<=m[i-1].a+.00001 && v.d<=m[i-1].d+.00001 && Math.abs(v.e)>=Math.abs(m[i-1].e)-.00001 && Math.abs(v.f)>=Math.abs(m[i-1].f)-.00001));
        },matrices);
        assert.ok(monotonic,kind+' 关闭位移和缩放单调，不再过冲');
      }else{
      assert.equal(exiting.timing.duration,entering.timing.duration,kind+' 等时长');
      assert.equal(exiting.timing.easing,entering.timing.easing,kind+' 同曲线');
      assert.equal(exiting.timing.direction,'reverse');
      assert.deepEqual(exiting.frames,entering.frames,kind+' 共用关键帧');
      for(let i=0;i<times.length;i++){
        assert.equal(exiting.values[i][0],entering.values[i][0],kind+' 反向变换');
        assert.ok(Math.abs(Number(exiting.values[i][1])-Number(entering.values[i][1]))<.00001,kind+' 反向透明度');
      }
      }
      await finish('#surface');await page.locator('#surface').waitFor({state:'detached'});
    }
    // 快速折返从当前画面交接，两种速度之间也不能跳帧。
    await page.evaluate(()=>{window.configure('popup','bottom');window.toggle(true)});
    const reverse=await page.locator('#surface').evaluate(node=>{
      const first=node.getAnimations()[0];first.pause();first.currentTime=96;
      const css=getComputedStyle(node);const before=[css.clipPath,css.transform,css.filter];
      window.toggle(false);const second=node.getAnimations()[0];second.pause();
      const next=getComputedStyle(node);const closing=[next.clipPath,next.transform,next.filter];const time=second.currentTime;
      window.toggle(true);const third=node.getAnimations()[0];third.pause();
      const reopenedCss=getComputedStyle(node);
      return {before,closing,reopened:[reopenedCss.clipPath,reopenedCss.transform,reopenedCss.filter],time,reopenedTime:third.currentTime};
    });
    assert.deepEqual(reverse.before,reverse.closing);assert.deepEqual(reverse.before,reverse.reopened);
    assert.equal(reverse.time,0);assert.equal(reverse.reopenedTime,0);
    await page.emulateMedia({reducedMotion:'reduce'});await page.evaluate(()=>window.toggle(false));
    await page.locator('#surface').waitFor({state:'detached'});
    await page.emulateMedia({reducedMotion:'no-preference'});
    // 记录基础外壳开合期间帧间隔与长任务；设备刷新率不同，不把固定 FPS 当作通用通过条件。
    const fluidPerf=await page.evaluate(async()=>{
      const intervals=[],longTasks=[];let last=performance.now(),running=true;
      const observer=new PerformanceObserver(list=>longTasks.push(...list.getEntries().map(entry=>entry.duration)));
      observer.observe({type:'longtask'});
      const tick=time=>{intervals.push(time-last);last=time;if(running)requestAnimationFrame(tick)};
      requestAnimationFrame(tick);
      for(let index=0;index<3;index++){
        window.toggle(true);await new Promise(resolve=>setTimeout(resolve,500));
        window.toggle(false);await new Promise(resolve=>setTimeout(resolve,330));
      }
      running=false;observer.disconnect();intervals.sort((a,b)=>a-b);
      return {frames:intervals.length,p50:intervals[Math.floor(intervals.length*.5)],p95:intervals[Math.floor(intervals.length*.95)],longTasks};
    });
    console.log('FLUID_PERF',JSON.stringify(fluidPerf));
    for(const [real,selector,duration] of [['float','.sia-float-button-group__list',260],['image','.sia-image-preview',180],['spin','.sia-spin-mask',180],['tour','.sia-tour',180],['panel','.sia-floating-panel',180]]){
      await page.evaluate(real=>{window.real(real);window.toggle(true)},real);
      await page.locator(selector).waitFor();
      assert.equal(await page.locator(selector).evaluate(node=>node.getAnimations()[0].effect.getTiming().duration),duration);
      await finish(selector);await finish('#surface');await page.waitForTimeout(30);
      await page.evaluate(()=>window.toggle(false));await page.waitForTimeout(20);
      assert.equal(await page.locator(selector).count(),1,real+' 关闭保留节点');
      assert.equal(await page.locator(selector).evaluate(node=>node.getAnimations()[0].effect.getTiming().direction),real==='float'?'normal':'reverse');
      await finish(selector);await finish('#surface');await page.locator(selector).waitFor({state:'detached'});
    }
    await page.evaluate(()=>window.real('alert'));
    await finish('.sia-alert');await page.waitForTimeout(30);
    await page.getByRole('button',{name:'关闭提示'}).click();
    assert.equal(await page.evaluate(()=>window.alertClosed),undefined);
    await finish('.sia-alert');await page.locator('.sia-alert').waitFor({state:'detached'});
    assert.equal(await page.evaluate(()=>window.alertClosed),true);
    await page.evaluate(()=>window.real('title'));
    await page.getByRole('button',{name:'提示目标'}).hover();await page.locator('.sia-title-tooltip').waitFor();
    await finish('.sia-title-tooltip');await page.waitForTimeout(30);
    await page.mouse.move(800,500);await page.waitForTimeout(30);
    assert.equal(await page.locator('.sia-title-tooltip').evaluate(node=>node.getAnimations()[0].effect.getTiming().direction),'normal');
    await page.locator('.sia-title-tooltip').waitFor({state:'detached'});
    assert.deepEqual(errors,[]);
    console.log('PASS 面板快速无回弹关闭、提示等时长反播、连续折返、减少动态效果及 7 类显隐入口。');
  } finally {
    await browser.close();await new Promise(resolve=>server.close(resolve));fs.rmSync(directory,{recursive:true,force:true});
  }
})().catch(error=>{console.error(error);process.exitCode=1});
