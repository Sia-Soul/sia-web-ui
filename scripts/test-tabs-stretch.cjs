// 逐帧读取真实指示器几何，验证先拉长再收拢，而不是只检查最终位置或 CSS 名称。
const assert = require('node:assert/strict');
const path = require('node:path');
const http = require('node:http');
const root = path.resolve(__dirname, '..');
const { build } = require(require.resolve('esbuild', { paths: [path.dirname(require.resolve('vite', { paths: [path.join(root, 'apps/docs')] }))] }));
const { chromium } = require(path.join(process.env.USERPROFILE, '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));

(async () => {
  const bundle = await build({
    stdin: { resolveDir: path.join(root, 'apps/docs'), loader: 'tsx', contents: `
      import React from 'react'; import {createRoot} from 'react-dom/client'; import {flushSync} from 'react-dom';
      import {Tabs} from '../../packages/react/src/components/Tabs';
      import {Icon} from '../../packages/react/src/components/Icon';
      import '../../packages/react/src/styles.css';
      const root=createRoot(document.getElementById('root')); window.events=[];
      window.renderTabs=(props={})=>flushSync(()=>root.render(<Tabs key={props.testKey ?? 'same'}
        style={{width:700,height:300}} onAfterChange={key=>window.events.push(key)}
        items={[{key:'a',label:'概览',icon:<Icon name="component" size={16}/>,children:'内容 A'},{key:'b',label:'成员和权限',icon:<Icon name="user" size={16}/>,children:'内容 B'},
        {key:'disabled',label:'禁用',disabled:true},{key:'c',label:'设置',icon:<Icon name="settings" size={16}/>,children:'内容 C'}]} {...props}/>));
      window.renderTabs();
    ` }, bundle: true, write: false, outdir: 'out', format: 'iife', jsx: 'automatic',
  });
  const js = bundle.outputFiles.find(file => file.path.endsWith('.js')).text;
  const css = bundle.outputFiles.find(file => file.path.endsWith('.css')).text;
  const server = http.createServer((req, res) => {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.end(`<!doctype html><meta charset="utf-8"><style>${css}</style><div id="root" style="padding:40px"></div><script>${js}</script>`);
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  try {
    const page = await browser.newPage({viewport:{width:1000,height:600}});
    const failures=[];
    page.on('pageerror',error=>failures.push(error.message));
    await page.goto(`http://127.0.0.1:${server.address().port}`);
    await page.getByRole('tab', {name:'概览',exact:true}).waitFor();
    for (const type of ['line','rounded']) for (const position of ['top','bottom','left','right']) {
      await page.evaluate(({position,type})=>{window.events=[];window.renderTabs({testKey:type+position,type,tabPosition:position,indicatorPosition:position});},{position,type});
      for (const target of ['设置','概览']) {
        const frames=await page.evaluate(async target=>{
          const indicator=document.querySelector('.sia-tabs__indicator');
          const read=()=>{const r=indicator.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height};};
          const result=[read()];
          [...document.querySelectorAll('[role=tab]')].find(tab=>tab.textContent===target).click();
          const start=performance.now();
          await new Promise(resolve=>{function sample(){result.push(read());if(performance.now()-start<420)requestAnimationFrame(sample);else resolve();}requestAnimationFrame(sample);});
          return result;
        },target);
        const axis=position==='left'||position==='right'?'height':'width';
        assert.ok(Math.max(...frames.map(frame=>frame[axis]))>Math.max(frames[0][axis],frames.at(-1)[axis])+20,`${position} ${target} 中间必须明显拉长`);
        const end=await page.getByRole('tab',{name:target,exact:true}).boundingBox();
        // 圆角样式以居中短线为最终几何，动画过程仍须显著超出短线长度。
        if(type==='rounded') {
          const offset=axis==='width'?'x':'y';
          const length=axis==='width'?24:16;
          end[offset]+=(end[axis]-length)/2;
          end[axis]=length;
        }
        for(const key of ['x','y','width','height'])assert.ok(Math.abs(frames.at(-1)[key]-end[key])<1,`${position} 最终位置准确`);
      }
    }
    // 属性必须真正改变绘制侧边；默认及无效方向回退保持兼容，动态调整不触发切换回调。
    for (const type of ['line','underline','rounded']) for (const position of ['top','bottom','left','right']) {
      const vertical=['left','right'].includes(position);
      const sides=vertical?['left','right']:['top','bottom'];
      const fallback={top:'bottom',bottom:'top',left:'right',right:'left'}[position];
      for (const side of [undefined,...sides,vertical?'top':'left']) {
        await page.evaluate(props=>{window.events=[];window.renderTabs({testKey:'position-config',activeKey:'a',...props});},{type,tabPosition:position,indicatorPosition:side});
        const expected=sides.includes(side)?side:fallback;
        const actual=await page.locator('.sia-tabs__indicator').evaluate((node,expected)=>{
          const css=getComputedStyle(node,'::after');
          return {side:node.dataset.indicatorPosition,inset:css[expected],width:css.width,height:css.height};
        },expected);
        assert.equal(actual.side,expected);
        assert.equal(actual.inset,type==='rounded'?'4px':'-1px');
        assert.equal(actual[vertical?'width':'height'],'2px');
        if(type==='rounded') {
          // 背景有淡入过渡，等待浏览器绘制首帧后再检查，避免把起始透明帧误判为缺失背景。
          await page.waitForFunction(()=>getComputedStyle(document.querySelector('[role="tab"][aria-selected="true"]')).backgroundColor!=='rgba(0, 0, 0, 0)');
          const visual=await page.getByRole('tab',{name:'概览',exact:true}).evaluate(node=>({radius:getComputedStyle(node).borderRadius,background:getComputedStyle(node).backgroundColor}));
          assert.equal(visual.radius,'8px');
          assert.notEqual(visual.background,'rgba(0, 0, 0, 0)');
        }
      }
    }
    await page.waitForTimeout(40);
    assert.deepEqual(await page.evaluate(()=>window.events),[]);
    // 连续切换从当前动画几何续接，延迟内容不能提前挂载中间目标。
    await page.evaluate(()=>{window.events=[];window.renderTabs({testKey:'rapid',deferContent:true});});
    await page.getByRole('tab',{name:'设置',exact:true}).click();
    await page.waitForTimeout(70);
    assert.equal(await page.getByRole('tabpanel').innerText(),'内容 A');
    const continuity=await page.evaluate(()=>{
      const indicator=document.querySelector('.sia-tabs__indicator');
      const before=indicator.getBoundingClientRect();
      window.renderTabs({testKey:'rapid',deferContent:true,activeKey:'b'});
      const after=indicator.getBoundingClientRect();
      return Math.abs(before.x-after.x)+Math.abs(before.width-after.width);
    });
    assert.ok(continuity<2,'反向切换不能跳回起点');
    await page.getByRole('tabpanel').filter({hasText:'内容 B'}).waitFor();
    assert.deepEqual(await page.evaluate(()=>window.events),['b']);
    assert.equal(await page.getByText('内容 C',{exact:true}).count(),0);
    // 键盘导航跳过禁用项，系统减少动画时无需等待拉伸时长。
    await page.emulateMedia({reducedMotion:'reduce'});
    await page.evaluate(()=>window.renderTabs({testKey:'keyboard'}));
    await page.getByRole('tab',{name:'概览',exact:true}).focus();
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('ArrowRight');
    assert.equal(await page.getByRole('tab',{name:'设置',exact:true}).getAttribute('aria-selected'),'true');
    assert.equal(await page.locator('.sia-tabs__indicator').evaluate(node=>node.getAnimations().length),0);
    // 平移选项仍使用原有 CSS 动画；首次渲染不触发 afterChange。
    await page.emulateMedia({reducedMotion:'no-preference'});
    await page.evaluate(()=>{window.events=[];window.renderTabs({testKey:'slide',indicatorMotion:'slide'});});
    await page.waitForTimeout(40);
    assert.deepEqual(await page.evaluate(()=>window.events),[]);
    assert.equal(await page.locator('.sia-tabs__indicator').evaluate(node=>getComputedStyle(node).transitionDuration),'0.18s, 0.18s, 0.18s');
    // 同一目标被重新渲染不重启动画，删除目标或收起到更多菜单时不残留指示器。
    await page.evaluate(()=>window.renderTabs({testKey:'remove',activeKey:'c'}));
    await page.evaluate(()=>window.renderTabs({testKey:'remove',activeKey:'c',items:[{key:'a',label:'概览'}]}));
    await page.waitForTimeout(350);
    assert.equal(await page.getByRole('tab',{name:'概览',exact:true}).getAttribute('aria-selected'),'true');
    await page.evaluate(()=>window.renderTabs({testKey:'overflow',activeKey:'c',style:{width:130}}));
    await page.waitForTimeout(100);
    assert.equal(await page.locator('.sia-tabs__indicator').evaluate(node=>getComputedStyle(node).visibility),'hidden');
    assert.deepEqual(failures,[]);
    // 可选留存明暗主题的真实渲染，查看圆角背景和内侧短线是否清晰。
    if(process.env.TABS_SCREENSHOT_DIR) for(const theme of ['light','dark']) for(const position of ['left','top']) {
      await page.evaluate(({theme,position})=>{
        document.documentElement.dataset.siaTheme=theme;
        document.body.style.cssText='background:var(--sia-color-surface);color:var(--sia-color-text);font-family:Segoe UI,sans-serif';
        window.renderTabs({testKey:'visual',type:'rounded',tabPosition:position,indicatorPosition:position,activeKey:'b'});
      },{theme,position});
      await page.waitForTimeout(180);
      await page.screenshot({path:path.join(process.env.TABS_SCREENSHOT_DIR,`tabs-rounded-${theme}-${position}.png`)});
    }
    console.log('PASS 线型与圆角矩形四方向往返拉伸、指示线四边定位及默认回退、动态属性、最终几何、快速切换连续、延迟内容及最终回调、键盘、减少动画、平移兼容、删除和溢出。');
  } finally { await browser.close(); server.close(); }
})().catch(error=>{console.error(error);process.exitCode=1;});
