// 回归取消按钮缩放回弹后的点击波纹、即时回调与原生激活语义。
const assert = require('node:assert/strict');
const { chromium } = require(process.env.USERPROFILE + '/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
(async () => {
 const browser = await chromium.launch({channel:'msedge',headless:true});
 try {
  const page = await browser.newPage({viewport:{width:1400,height:1000}});
  const errors=[]; page.on('pageerror', e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:4173/components/button');
  const demo=page.locator('.button-click-demo'); await demo.waitFor();
  const button=demo.getByRole('button',{name:'点击计数'});
  // 点击不能再创建按钮缩放动画，主按钮波纹和连续两次回调仍生效。
  const result=await button.evaluate(el=>{
   const width=el.offsetWidth; el.click(); el.click();
   return {animated:el.getAnimations().some(a=>a.effect.getKeyframes().some(f=>f.scale)),wave:el.dataset.wave,unchanged:width===el.offsetWidth};
  });
  assert.equal(result.animated,false);assert.equal(result.wave,'active');assert.ok(result.unchanged);
  assert.match(await demo.innerText(),/已点击 2 次/);
  await button.focus();await page.keyboard.press('Enter');await page.keyboard.press('Space');
  assert.match(await demo.innerText(),/已点击 4 次/);
  // 所有视觉类型和尺寸共用同一行为，图标按钮同样支持。
  const variants=await page.locator('.button-demo .sia-button, .secondary-demo-card .sia-button, .button-click-demo .sia-button').evaluateAll(elements=>elements.map(el=>{
   el.click();return {disabled:el.disabled,animated:el.getAnimations().some(a=>a.effect.getKeyframes().some(f=>f.scale))};
  }));
  for(const item of variants) assert.equal(item.animated,false);
  // 点击保持宿主的 transform 和 scale。
  const custom=await button.evaluate(el=>{
   el.getAnimations().forEach(a=>a.cancel());el.style.transform='rotate(2deg)';el.style.scale='1.2';
   const transform=getComputedStyle(el).transform;el.click();
   return {before:transform,after:getComputedStyle(el).transform,scale:getComputedStyle(el).scale};
  });
  assert.equal(custom.before,custom.after);assert.equal(custom.scale,'1.2');
  await page.waitForTimeout(400);await page.emulateMedia({reducedMotion:'reduce'});
  assert.equal(await button.evaluate(el=>{el.click();return el.getAnimations().filter(a=>a.effect.getKeyframes().some(f=>f.scale)).length}),0);
  const touch=await browser.newPage({hasTouch:true,viewport:{width:390,height:844}});
  await touch.goto('http://127.0.0.1:4173/components/button');
  await touch.getByRole('button',{name:'点击计数',exact:true}).tap();
  assert.match(await touch.locator('.button-click-demo').innerText(),/已点击 1 次/);
  assert.deepEqual(errors,[]);
  console.log('PASS Button 无缩放回弹、主按钮波纹、即时回调、键盘/触摸、禁用/加载及宿主样式',result);
 } finally {await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1});
