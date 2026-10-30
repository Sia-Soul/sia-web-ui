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
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'sia-motion-'));
  buildSync({ entryPoints: ['scripts/fixtures/popup-style-motion.tsx'], bundle: true, nodePaths: [path.resolve('packages/react/node_modules')], format: 'iife', platform: 'browser', jsx: 'automatic', outfile: path.join(directory, 'fixture.js'), define: { 'process.env.NODE_ENV': '"production"' } });
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
    // 以无动效时的原始 CSS 为基准，逐阶段确认动画不改变最终外观或裁掉边缘。
    for(const theme of ['light','dark']){
      await page.evaluate(theme=>document.documentElement.dataset.siaTheme=theme,theme);
      await page.emulateMedia({reducedMotion:'reduce'});
      await page.getByRole('combobox',{name:'普通列表'}).click();
      const baseline=await page.locator('.sia-select__dropdown').evaluate(node=>{
        const css=getComputedStyle(node);
        return [css.borderRadius,css.borderColor,css.boxShadow,css.backgroundColor];
      });
      assert.equal(baseline[0],'8px','保留 Select 原有圆角');
      await page.keyboard.press('Escape');
      await page.locator('.sia-select__dropdown').waitFor({state:'detached'});
      await page.emulateMedia({reducedMotion:'no-preference'});
      await page.getByRole('combobox',{name:'普通列表'}).click();
      const samples=await page.locator('.sia-select__dropdown').evaluate(node=>{
        const animation=node.getAnimations()[0];animation.pause();
        return [0,.2,.5,.8,1].map(progress=>{
          animation.currentTime=Number(animation.effect.getTiming().duration)*progress;
          const css=getComputedStyle(node);
          const rect=node.getBoundingClientRect();
          return {rect:{left:rect.left,right:rect.right,top:rect.top,width:rect.width,height:rect.height},opacity:css.opacity,appearance:[css.borderRadius,css.borderColor,css.boxShadow,css.backgroundColor],clip:css.clipPath,filter:css.filter};
        });
      });
      // 果冻动效应淡入、弹大再归位；原有面板外观不随动画变化。
      const resting=samples.at(-1).rect;
      assert.equal(samples[0].opacity,'0');assert.equal(samples.at(-1).opacity,'1');
      assert.ok(samples[0].rect.width<resting.width && samples[0].rect.height<resting.height,'从较小面板开始');
      assert.ok(samples.some(sample=>sample.rect.width>resting.width*1.02 && sample.rect.height>resting.height*1.02),'恢复果冻弹大');
      for(const sample of samples){assert.deepEqual(sample.appearance,baseline);assert.equal(sample.clip,'none');assert.equal(sample.filter,'none');}
      await page.locator('.sia-select__dropdown').evaluate(node=>node.getAnimations()[0].finish());
      await page.waitForFunction(()=>document.querySelector('.sia-select__dropdown')?.getAnimations().length===0);
      await page.locator('.sia-select__list[data-sia-floating-scrollbar]').waitFor();
      assert.ok(await page.locator('.sia-select__list').evaluate(node=>{node.scrollTop=node.scrollHeight;const moved=node.scrollTop>0;node.scrollTop=0;return moved}),'局部扫描仍接管长面板的滚动条');
      await page.screenshot({path:'logs/popup-restored-'+theme+'.png'});
      await page.keyboard.press('Escape');
      const closing=await page.locator('.sia-select__dropdown').evaluate(node=>{
        const animation=node.getAnimations()[0];animation.pause();
        return [0,.2,.4,.7,1].map(progress=>{
          animation.currentTime=Number(animation.effect.getTiming().duration)*progress;
          const css=getComputedStyle(node),rect=node.getBoundingClientRect();
          return {top:rect.top,right:rect.right,width:rect.width,opacity:css.opacity,appearance:[css.borderRadius,css.borderColor,css.boxShadow,css.backgroundColor]};
        });
      });
      for(const sample of closing)assert.deepEqual(sample.appearance,baseline,'关闭期间保留原有外观');
      assert.equal(closing[0].opacity,'1');assert.equal(closing.at(-1).opacity,'0');
      assert.ok(closing.every((sample,i)=>!i || (sample.width<=closing[i-1].width && Number(sample.opacity)<=Number(closing[i-1].opacity))),'关闭连续缩小淡出');
      await page.locator('.sia-select__dropdown').evaluate(node=>node.getAnimations()[0].finish());
      await page.locator('.sia-select__dropdown').waitFor({state:'detached'});
    }
    // 采样真实列表的反复开合（包含挂载），而非空白动画色块；不硬编码设备 FPS 门槛。
    const performanceResults=await page.evaluate(async()=>{
      const results=[];
      const originalStyle=window.getComputedStyle;let backgroundStyleReads=0;
      window.getComputedStyle=function(element,pseudo){if(element.id==='unrelated-probe')backgroundStyleReads++;return originalStyle.call(this,element,pseudo)};
      for(const label of ['普通列表','长列表']){
        backgroundStyleReads=0;
        const button=document.querySelector(`[aria-label="${label}"]`);
        const intervals=[],longTasks=[];let running=true,last;
        const observer=new PerformanceObserver(list=>longTasks.push(...list.getEntries().map(entry=>entry.duration)));
        observer.observe({type:'longtask'});
        const tick=time=>{if(last!==undefined)intervals.push(time-last);last=time;if(running)requestAnimationFrame(tick)};
        requestAnimationFrame(tick);
        const waitFor=async predicate=>{for(let i=0;i<120;i++){if(predicate())return;await new Promise(requestAnimationFrame)}throw new Error('面板生命周期超时')};
        let renderedOptions=0;
        for(let i=0;i<5;i++){
          button.click();
          await waitFor(()=>document.querySelector('.sia-select__dropdown')?.getAnimations().length);
          const panel=document.querySelector('.sia-select__dropdown');
          renderedOptions=Math.max(renderedOptions,panel.querySelectorAll('.sia-select__option').length);
          await waitFor(()=>panel.getAnimations().length===0);
          button.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}));
          await waitFor(()=>!document.querySelector('.sia-select__dropdown'));
        }
        await new Promise(resolve=>setTimeout(resolve,0));running=false;observer.disconnect();intervals.sort((a,b)=>a-b);
        results.push({label,backgroundStyleReads,cycles:5,renderedOptions,frames:intervals.length,p50:intervals[Math.floor(intervals.length*.5)],p95:intervals[Math.floor(intervals.length*.95)],max:intervals.at(-1),longTasks});
      }
      window.getComputedStyle=originalStyle;
      return results;
    });
    assert.ok(performanceResults.every(result=>result.backgroundStyleReads===0),'下拉开合不能重复测量无关背景子树');
    assert.equal(performanceResults[0].renderedOptions,15);
    assert.ok(performanceResults[1].renderedOptions>0 && performanceResults[1].renderedOptions<1000,'长列表仍使用虚拟渲染');
    assert.deepEqual(errors,[]);
    fs.writeFileSync('logs/popup-real-content-performance.json',JSON.stringify(performanceResults,null,2),'utf8');
    console.log('REAL_POPUP_PERF',JSON.stringify(performanceResults));
    console.log('PASS 深浅主题真实面板外观不变、开合不裁剪/虚化、15 项及 1000 项虚拟列表开合。');
  } finally {
    await browser.close();
    await new Promise(resolve => server.close(resolve));
    assert.equal(path.dirname(path.resolve(directory)), path.resolve(os.tmpdir()));
    assert.ok(path.basename(directory).startsWith('sia-motion-'));
    fs.rmSync(directory, { recursive: true, force: true });
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
