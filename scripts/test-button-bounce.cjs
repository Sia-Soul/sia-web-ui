// 浏览器回归验证真实点击反馈、连续点击衔接和原生激活语义。
const assert = require('node:assert/strict');
const { chromium } = require(process.env.USERPROFILE + '/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
(async () => {
 const browser = await chromium.launch({channel:'msedge',headless:true});
 try {
  const page = await browser.newPage({viewport:{width:1400,height:1000}});
  const errors=[]; page.on('pageerror', e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:4173/components/button');
  const demo=page.locator('.button-bounce-demo'); await demo.waitFor();
  const button=demo.getByRole('button',{name:'点击体验回弹'});
  // 立即回调、完整回弹、尺寸不触发布局变化；从中段重启时缩放连续。
  const result=await button.evaluate(el=>{
   const width=el.offsetWidth; el.click();
   const animation=el.getAnimations().find(a=>a.effect.getKeyframes().some(f=>f.scale));
   if(!animation) throw Error('没有回弹动画');
   animation.pause();
   const scales=[];
   for(let t=0;t<=320;t+=8){animation.currentTime=t;scales.push(getComputedStyle(el).scale === 'none' ? 1 : parseFloat(getComputedStyle(el).scale));}
   animation.currentTime=120;
   const before=getComputedStyle(el).scale;
   el.click();
   const restarted=el.getAnimations().find(a=>a.effect.getKeyframes().some(f=>f.scale));
   restarted.pause(); restarted.currentTime=0;
   const after=getComputedStyle(el).scale;
   const unchanged=width===el.offsetWidth;
   restarted.finish();
   return {minimum:Math.min(...scales),maximum:Math.max(...scales),before,after,unchanged};
  });
  assert.ok(result.minimum<.95 && result.maximum>1.05,JSON.stringify(result));
  assert.equal(result.before,result.after);assert.ok(result.unchanged);
  assert.match(await demo.innerText(),/已点击 2 次/);
  await button.focus();await page.keyboard.press('Enter');await page.keyboard.press('Space');
  assert.match(await demo.innerText(),/已点击 4 次/);
  // 所有视觉类型和尺寸共用同一行为，图标按钮同样支持。
  const variants=await page.locator('.button-demo .sia-button, .secondary-demo-card .sia-button, .button-bounce-demo .sia-button').evaluateAll(elements=>elements.map(el=>{
   el.click();return {disabled:el.disabled,animated:el.getAnimations().some(a=>a.effect.getKeyframes().some(f=>f.scale))};
  }));
  for(const item of variants) assert.equal(item.animated,!item.disabled);
  // 宿主的 transform 和 scale 在动画完成后仍保留。
  const custom=await button.evaluate(el=>{
   el.getAnimations().forEach(a=>a.cancel());el.style.transform='rotate(2deg)';el.style.scale='1.2';
   const transform=getComputedStyle(el).transform;el.click();
   const a=el.getAnimations().find(a=>a.effect.getKeyframes().some(f=>f.scale));a.finish();
   return {before:transform,after:getComputedStyle(el).transform,scale:getComputedStyle(el).scale};
  });
  assert.equal(custom.before,custom.after);assert.equal(custom.scale,'1.2');
  await page.waitForTimeout(400);await page.emulateMedia({reducedMotion:'reduce'});
  assert.equal(await button.evaluate(el=>{el.click();return el.getAnimations().filter(a=>a.effect.getKeyframes().some(f=>f.scale)).length}),0);
  const touch=await browser.newPage({hasTouch:true,viewport:{width:390,height:844}});
  await touch.goto('http://127.0.0.1:4173/components/button');
  await touch.getByRole('button',{name:'点击体验回弹',exact:true}).tap();
  assert.match(await touch.locator('.button-bounce-demo').innerText(),/已点击 1 次/);
  assert.deepEqual(errors,[]);
  console.log('PASS Button 回弹幅度、连续点击、即时回调、键盘/触摸、禁用/加载、宿主样式及减少动态效果',result);
 } finally {await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1});
