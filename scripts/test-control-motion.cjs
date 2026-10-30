// 真实浏览器验证控件回弹、选中背景滑动、查询布局切换和键盘操作，记录帧间隔但不硬编码设备帧率。
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
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'sia-control-motion-'));
  buildSync({ entryPoints: ['scripts/fixtures/control-motion.tsx'], bundle: true, nodePaths: [path.resolve('packages/react/node_modules')], format: 'iife', platform: 'browser', jsx: 'automatic', outfile: path.join(directory, 'fixture.js'), define: { 'process.env.NODE_ENV': '"development"' } });
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
    const errors=[]; page.on('pageerror',error=>errors.push(error.message));
    await page.getByText('复选反馈',{exact:true}).waitFor();
    await page.getByText('复选反馈',{exact:true}).click();
    assert.equal(await page.getByRole('checkbox',{name:'复选反馈',exact:true}).isChecked(),true);
    const check=page.locator('.sia-checkbox').first().locator('.sia-checkbox__control');
    const feedback=await check.evaluate(node=>{
      const animation=node.getAnimations().find(a=>a.effect.getKeyframes().some(f=>f.scale));
      animation.pause();const samples=[];
      // 小图形压缩谷值很短，以 1ms 密集采样验证幅度，避免 8ms 步长跨过谷值导致误报。
      for(let t=0;t<animation.effect.getTiming().duration;t+=1){animation.currentTime=t;samples.push(parseFloat(getComputedStyle(node).scale))}
      animation.currentTime=120; const before=getComputedStyle(node).scale;
      node.parentElement.querySelector('input').click();
      const next=node.getAnimations().find(a=>a.effect.getKeyframes().some(f=>f.scale));next.pause();next.currentTime=0;
      const after=getComputedStyle(node).scale;next.finish();return {min:Math.min(...samples),max:Math.max(...samples),before,after};
    });
    // 小图形须达到明显的压缩与过冲，连续点击仍从当前比例接续。
    assert.ok(feedback.min<.72 && feedback.max>1.3,JSON.stringify(feedback));assert.equal(feedback.before,feedback.after);
    await page.getByRole('checkbox',{name:'复选反馈',exact:true}).focus();await page.keyboard.press('Space');
    assert.ok(await check.evaluate(node=>node.getAnimations().some(a=>a.effect.getKeyframes().some(f=>f.scale))));
    await page.getByText('单选 B',{exact:true}).click();assert.equal(await page.getByRole('radio',{name:'单选 B',exact:true}).isChecked(),true);
    assert.ok(await page.getByRole('radio',{name:'单选 B',exact:true}).evaluate(input=>input.nextElementSibling.getAnimations().some(a=>a.effect.getKeyframes().some(f=>f.scale))));
    await page.getByRole('radio',{name:'单选 B',exact:true}).focus();await page.keyboard.press('ArrowLeft');
    assert.equal(await page.getByRole('radio',{name:'单选 A',exact:true}).isChecked(),true);
    await page.getByRole('checkbox',{name:'禁用复选'}).evaluate(input=>input.click());
    assert.equal(await page.getByRole('checkbox',{name:'禁用复选'}).evaluate(input=>input.nextElementSibling.getAnimations().length),0);
    for(const selector of ['.horizontal-test','.vertical-test']){
      const root=page.locator(selector),indicator=root.locator('.sia-segmented__selection');
      const before=await indicator.boundingBox();
      await root.getByRole('radio').nth(2).click();
      const during=await indicator.evaluate(node=>{const a=node.getAnimations()[0];a.pause();a.currentTime=100;return node.getBoundingClientRect().toJSON()});
      const target=await root.getByRole('radio').nth(2).boundingBox();
      const axis=selector.includes('vertical')?'y':'x';assert.ok(during[axis]>before[axis]&&during[axis]<target[axis]);
      await root.getByRole('radio').nth(0).click();await page.waitForTimeout(300);
      const final=await indicator.boundingBox(),selected=await root.getByRole('radio').nth(0).boundingBox();
      for(const key of ['x','y','width','height'])assert.ok(Math.abs(final[key]-selected[key])<1);
    }
    assert.equal(await page.locator('.zigzag-test .sia-segmented__selection').count(),0);
    await page.locator('.disabled-test').evaluate(el=>el.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowRight',bubbles:true})));
    assert.equal(await page.locator('.disabled-test button').first().getAttribute('aria-checked'),'true');
    const row=page.locator('.query-test .sia-query-form__motion');
    await page.waitForTimeout(350);const expanded=await row.evaluate(el=>el.offsetHeight);
    await page.getByLabel('条件 8',{exact:true}).fill('保留的查询值');
    const closing=await row.evaluate(async el=>{
      window.toggleQuery(true);await Promise.resolve();const animations=el.getAnimations();animations.forEach(a=>a.pause());
      return {duration:animations[0]?.effect.getTiming().duration,ghosts:el.querySelectorAll('[inert]').length};
    });
    assert.equal(closing.duration,240);assert.ok(closing.ghosts>0);
    await row.evaluate(el=>el.getAnimations({subtree:true}).forEach(animation=>{animation.pause();animation.currentTime=100}));
    // 收起状态与容纳数量会在同批提交中变化，退场字段必须仍位于原来的多行布局内。
    const midpoint=await row.evaluate(el=>({shell:el.getBoundingClientRect().toJSON(),ghost:el.querySelectorAll('.sia-query-form__field')[8].getBoundingClientRect().toJSON()}));
    assert.ok(midpoint.ghost.x>=midpoint.shell.x && midpoint.ghost.right<=midpoint.shell.right);
    assert.ok(midpoint.ghost.y>midpoint.shell.y+30 && midpoint.ghost.y<midpoint.shell.bottom);
    await page.screenshot({path:'logs/control-switching-midpoint.png'});
    await row.evaluate(el=>el.getAnimations().forEach(a=>a.finish()));await page.waitForTimeout(60);
    const collapsed=await row.evaluate(el=>el.offsetHeight);assert.ok(collapsed<expanded);
    assert.equal(await row.locator('[inert]').count(),0);
    assert.equal(await page.getByLabel('条件 8',{exact:true}).inputValue(),'保留的查询值');
    // 采样重内容场景；只记录设备实际帧间隔，不用虚构固定 FPS 作为保证。
    const perf=await page.evaluate(async()=>{
      const times=[];let done=false;const longTasks=[];
      const observer=new PerformanceObserver(list=>longTasks.push(...list.getEntries().map(entry=>entry.duration)));try{observer.observe({type:'longtask',buffered:false});}catch{}
      const sample=time=>{times.push(time);if(!done)requestAnimationFrame(sample)};requestAnimationFrame(sample);
      const start=window.queryRenders,commits=window.queryCommits;window.toggleQuery(false);
      await new Promise(resolve=>setTimeout(resolve,300));
      window.toggleQuery(true);await new Promise(resolve=>setTimeout(resolve,300));
      done=true;longTasks.push(...observer.takeRecords().map(e=>e.duration));observer.disconnect();
      const delta=times.slice(1).map((time,i)=>time-times[i]).sort((a,b)=>a-b);
      return {frames:times.length,p50:delta[Math.floor(delta.length*.5)],p95:delta[Math.floor(delta.length*.95)],longTasks,renders:window.queryRenders-start,commits:window.queryCommits-commits};
    });
    assert.ok(perf.renders<8,'过渡不能逐帧重渲染父组件');
    assert.ok(perf.commits<10,'查询区域不能逐帧提交 React 更新');
    // 折返时同时核对坐标和透明度，不能只验证动画最终状态正确。
    const reverse=await row.evaluate(async el=>{
      window.toggleQuery(false);await Promise.resolve();
      el.getAnimations({subtree:true}).forEach(a=>{a.pause();a.currentTime=100});
      const field=el.querySelectorAll('.sia-query-form__field')[8];
      const before={rect:field.getBoundingClientRect().toJSON(),opacity:Number(getComputedStyle(field).opacity)};
      window.toggleQuery(true);await Promise.resolve();
      el.getAnimations({subtree:true}).forEach(a=>{a.pause();a.currentTime=0});
      const after={rect:field.getBoundingClientRect().toJSON(),opacity:Number(getComputedStyle(field).opacity)};
      el.getAnimations({subtree:true}).forEach(a=>a.finish());return {before,after};
    });
    assert.ok(Math.abs(reverse.before.rect.y-reverse.after.rect.y)<1,JSON.stringify(reverse));
    assert.ok(Math.abs(reverse.before.opacity-reverse.after.opacity)<.01,JSON.stringify(reverse));
    await page.evaluate(()=>window.toggleQuery(false));await page.waitForTimeout(60);await page.evaluate(()=>window.toggleQuery(true));await page.waitForTimeout(60);await page.evaluate(()=>window.toggleQuery(false));await page.waitForTimeout(350);
    assert.equal(await row.locator('[inert]').count(),0);assert.equal(await row.locator('[hidden]').count(),0);
    assert.ok(await row.evaluate(el=>Math.abs(el.offsetHeight-el.scrollHeight)<3));
    await page.emulateMedia({reducedMotion:'reduce'});await page.evaluate(()=>window.toggleQuery(true));
    assert.equal(await row.evaluate(el=>el.getAnimations().length),0);
    assert.equal(await row.locator('[inert]').count(),0);
    assert.deepEqual(errors,[]);console.log('PASS 控件回弹、分段滑动、查询收起/展开/中断和值保留。性能采样',JSON.stringify(perf));
  } finally {await browser.close();await new Promise(resolve=>server.close(resolve));fs.rmSync(directory,{recursive:true,force:true});}
})().catch(error=>{console.error(error);process.exitCode=1});
