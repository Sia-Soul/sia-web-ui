// 回归打开后直接键入，不以 fill() 隐式聚焦掩盖自动聚焦失效。
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),http=require('node:http');
const {createRequire}=require('node:module');
const ui=createRequire(path.resolve('packages/react/package.json'));
const {buildSync}=createRequire(ui.resolve('tsup'))('esbuild');
const {chromium}=require(path.join(process.env.USERPROFILE,'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));
(async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'sia-select-input-'));
 buildSync({entryPoints:['scripts/fixtures/select-input.tsx'],bundle:true,nodePaths:[path.resolve('packages/react/node_modules')],format:'iife',platform:'browser',jsx:'automatic',outfile:path.join(dir,'fixture.js'),define:{'process.env.NODE_ENV':'"production"'}});
 const server=http.createServer((req,res)=>{
  if(['/fixture.js','/fixture.css'].includes(req.url)){res.setHeader('Content-Type',req.url.endsWith('.css')?'text/css':'application/javascript');res.end(fs.readFileSync(path.join(dir,req.url.slice(1))));}
  else{res.setHeader('Content-Type','text/html; charset=utf-8');res.end('<meta charset="utf-8"><link rel="stylesheet" href="/fixture.css"><div id="root"></div><script src="/fixture.js"></script>');}
 });await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const browser=await chromium.launch({channel:'msedge',headless:true});
 try{
  const page=await browser.newPage();
  for(const reducedMotion of ['no-preference','reduce']){
   await page.emulateMedia({reducedMotion});await page.goto(`http://127.0.0.1:${server.address().port}`);
   await page.evaluate(theme=>document.documentElement.dataset.siaTheme=theme,reducedMotion==='reduce'?'light':'dark');
   const longTag=page.locator('#long-select .sia-select__tags > .sia-select__tag').last();
   assert.ok(await longTag.evaluate(node=>node.getBoundingClientRect().width)>200,'长标签应利用剩余宽度，而不是固定截断在 112px');
   const shortTag=page.locator('#long-select .sia-select__tags > .sia-select__tag').first();
   const shortWidth=await shortTag.evaluate(node=>node.getBoundingClientRect().width);
   await page.locator('#long-select').evaluate(node=>node.style.width='280px');
   await page.waitForTimeout(80);
   assert.equal(await shortTag.evaluate(node=>node.getBoundingClientRect().width),shortWidth,'长标签不能挤压短标签');
   assert.ok(await page.locator('#long-select .sia-select__tags').evaluate(node=>Array.from(node.children).filter(child=>!child.classList.contains('sia-overflow-tags__measure')).every(child=>child.getBoundingClientRect().right<=node.getBoundingClientRect().right+1)),'标签和 +N 不溢出');
   await page.locator('#long-select').evaluate(node=>node.style.width='600px');
   await page.waitForTimeout(80);
   assert.ok(await longTag.evaluate(node=>node.getBoundingClientRect().width)>200,'重新放宽恢复长标签宽度');
   fs.mkdirSync('logs',{recursive:true});
   await page.locator('#long-select').screenshot({path:`logs/select-long-tag-${reducedMotion==='reduce'?'light':'dark'}.png`});
   const trigger=page.getByRole('combobox',{name:'自定义技术栈'});
   await trigger.click();await page.waitForTimeout(80);
   assert.equal(await page.locator('.sia-select__search input').evaluate(node=>node===document.activeElement),true,'打开后搜索框必须自动获取焦点');
   assert.equal(await page.locator('.sia-select__search input').getAttribute('placeholder'),'输入或搜索','允许自定义值时提示可输入也可搜索');
   await page.keyboard.type('Angular');await page.keyboard.press('Enter');
   assert.equal(await page.locator('#value').textContent(),'["Angular"]');
   await page.keyboard.type('Solid');await page.getByRole('button',{name:'使用“Solid”'}).click();
   await page.getByRole('option',{name:'React',exact:true}).click();
   assert.equal(await page.locator('#value').textContent(),'["Angular","Solid","React"]');
   // 宽度决定默认折叠数量，缩窄再恢复后重新计算，而不是固定只显示两个。
   const tags=page.locator('#auto-select .sia-select__tags');
   assert.equal(await tags.locator(':scope > .sia-select__tag').count(),3);
   assert.equal(await tags.locator(':scope > .sia-select__tag--rest').count(),0);
   await page.locator('#auto-select').evaluate(node=>node.style.width='150px');
   await tags.locator(':scope > .sia-select__tag--rest').waitFor();
   await page.locator('#auto-select').evaluate(node=>node.style.width='600px');
   await tags.locator(':scope > .sia-select__tag--rest').waitFor({state:'detached'});
   assert.equal(await tags.locator(':scope > .sia-select__tag').count(),3);
   assert.equal(await page.locator('#limited-select .sia-select__tags > .sia-select__tag--rest').textContent(),'+1','显式数量上限仍生效');
   await page.keyboard.press('Escape');await page.locator('.sia-select__dropdown').waitFor({state:'detached'});
   await trigger.focus();await page.keyboard.press('ArrowDown');await page.waitForTimeout(80);
   await page.keyboard.type('Vue');await page.keyboard.press('Enter');
   assert.equal(await page.locator('#value').textContent(),'["Angular","Solid","React","Vue"]');
   await page.locator('#outside').click();await page.waitForTimeout(300);
   assert.equal(await page.locator('#outside').evaluate(node=>node===document.activeElement),true,'关闭后不能抢回焦点');
   const single=page.getByRole('combobox',{name:'单选自定义'});
   await single.click();await page.waitForTimeout(80);
   assert.equal(await page.locator('.sia-select__search input').getAttribute('placeholder'),'输入技术名称','显式提示优先');
   await page.keyboard.type('Angular');await page.keyboard.press('Enter');
   await page.locator('.sia-select__dropdown').waitFor({state:'detached'});
   assert.ok((await single.textContent()).includes('Angular'),'单选直接输入后提交并回填');
  }
  console.log('PASS Select 鼠标/键盘展开后直接输入、自定义提交、已有选项、多选回填和减少动态效果。');
 }finally{await browser.close();await new Promise(resolve=>server.close(resolve));fs.rmSync(dir,{recursive:true,force:true});}
})().catch(e=>{console.error(e);process.exitCode=1});
