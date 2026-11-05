// 从真实选择框验证四种模式、取消草稿、跨目录选择、异步失败及浏览器授权。
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),http=require('node:http');
const {createRequire}=require('node:module');
const ui=createRequire(path.resolve('packages/react/package.json'));
const {buildSync}=createRequire(ui.resolve('tsup'))('esbuild');
const {chromium}=require(path.join(process.env.USERPROFILE,'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));
(async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'sia-choose-box-'));
 buildSync({entryPoints:['scripts/fixtures/choose-box.tsx'],bundle:true,nodePaths:[path.resolve('packages/react/node_modules')],format:'iife',platform:'browser',jsx:'automatic',outfile:path.join(dir,'fixture.js'),define:{'process.env.NODE_ENV':'"production"'}});
 const server=http.createServer((req,res)=>{
  if(['/fixture.js','/fixture.css'].includes(req.url)){res.setHeader('Content-Type',req.url.endsWith('.css')?'text/css':'application/javascript');res.end(fs.readFileSync(path.join(dir,req.url.slice(1))));}
  else{res.setHeader('Content-Type','text/html; charset=utf-8');res.end('<meta charset="utf-8"><link rel="stylesheet" href="/fixture.css"><div id="root"></div><script src="/fixture.js"></script>');}
 });await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const browser=await chromium.launch({channel:'msedge',headless:true});
 try{
  const page=await browser.newPage();
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.goto(`http://127.0.0.1:${server.address().port}`);
  const dialog=page.getByRole('dialog');
  const open=async name=>{await page.getByRole('button',{name,exact:true}).click();await dialog.getByRole('button',{name:'说明.txt',exact:true}).waitFor();};
  const confirm=async()=>{await dialog.getByRole('button',{name:'确定',exact:true}).click();await dialog.waitFor({state:'hidden'});};
  const cancel=async()=>{await dialog.getByRole('button',{name:'取消',exact:true}).click();await dialog.waitFor({state:'hidden'});};
  // 选择入口在宽窄容器中均保持尾部图标贴右，长路径不得挤压图标或覆盖清空操作。
  const checkTriggerLayout=async(selector='#file-false')=>{
    for(const width of [320,960]){
      const field=page.locator(selector);
      await field.evaluate((element,width)=>{element.style.width=`${width}px`;},width);
      const box=await field.locator('.sia-choose-box__trigger').boundingBox();
      const icon=await field.locator('.sia-choose-box__trigger .sia-icon').boundingBox();
      assert.ok(icon.width<=20,`尾部图标不能被拉伸：当前宽 ${icon.width}px`);
      const inset=box.x+box.width-icon.x-icon.width;
      assert.ok(inset>=7&&inset<=20,`尾部图标应靠右对齐：当前右侧留白 ${inset}px`);
      const clear=field.getByRole('button',{name:'清空选择'});
      if(await clear.count()){
        const clearBox=await clear.boundingBox();
        assert.ok(clearBox.x+clearBox.width<=icon.x,'清空按钮应位于文件图标左侧且不重叠');
        const text=await field.locator('.sia-choose-box__value').boundingBox();
        assert.ok(text.x+text.width<=clearBox.x,'路径文字区域不能覆盖清空按钮');
      }
    }
    await page.locator(selector).evaluate(element=>element.style.removeProperty('width'));
  };
  await checkTriggerLayout();
  for(const size of ['small','medium','large']) await checkTriggerLayout(`#long-${size}`);
  await open('file-false');await dialog.getByRole('button',{name:'说明.txt',exact:true}).click();await confirm();
  await checkTriggerLayout();
  assert.equal(await page.locator('#file-false output').textContent(),'["说明.txt"]');
  await open('/说明.txt');await dialog.getByRole('button',{name:'图片.png',exact:true}).click();await cancel();
  assert.equal(await page.locator('#file-false output').textContent(),'["说明.txt"]','取消不提交草稿');
  await open('directory-false');await dialog.locator('.sia-tree').getByText('空目录',{exact:true}).click();
  await dialog.getByText('此文件夹为空',{exact:true}).waitFor();await dialog.getByRole('button',{name:'选择当前文件夹'}).click();await confirm();
  assert.equal(await page.locator('#directory-false output').textContent(),'["空目录"]');
  await open('file-true');await dialog.getByRole('checkbox',{name:'选择 说明.txt',exact:true}).locator('..').click();
  await dialog.getByRole('button',{name:'子目录',exact:true}).click();await dialog.getByRole('checkbox',{name:'选择 子文件.txt',exact:true}).locator('..').click();await confirm();
  assert.equal(await page.locator('#file-true output').textContent(),'["说明.txt","子文件.txt"]');
  await open('directory-true');await dialog.getByRole('checkbox',{name:'选择 子目录',exact:true}).locator('..').click();
  await dialog.locator('.sia-tree').getByText('空目录',{exact:true}).click();await dialog.getByText('此文件夹为空',{exact:true}).waitFor();
  await dialog.getByRole('button',{name:'选择当前文件夹'}).click();await confirm();
  assert.equal(await page.locator('#directory-true output').textContent(),'["子目录","空目录"]');
  await open('过滤文件');assert.equal(await dialog.getByRole('button',{name:'图片.png',exact:true}).count(),0);
  await dialog.locator('.sia-tree').getByText('失败目录',{exact:true}).click();await dialog.getByRole('alert').getByText('无权访问目录').waitFor();
  await dialog.locator('.sia-tree').getByText('慢目录',{exact:true}).click();await cancel();await page.waitForTimeout(450);assert.equal(await dialog.count(),0);
  await page.getByRole('button',{name:'浏览器授权',exact:true}).click();
  await dialog.getByText('请添加授权目录后开始选择').waitFor();
  // 受控浏览器 API 替身验证授权时机、取消及保留空目录；不冒充真实系统授权测试。
  await page.evaluate(()=>{window.showDirectoryPicker=async()=>{throw new DOMException('取消','AbortError')}});
  await dialog.getByRole('button',{name:'添加授权目录'}).click();await page.waitForTimeout(30);assert.equal(await dialog.getByRole('alert').count(),0);
  await page.evaluate(()=>{const handle={name:'已授权',kind:'directory',isSameEntry:async other=>other===handle,async *values(){}};window.showDirectoryPicker=async()=>handle;});
  await dialog.getByRole('button',{name:'添加授权目录'}).click();await dialog.getByText('此文件夹为空',{exact:true}).waitFor();
  await dialog.getByRole('button',{name:'添加授权目录'}).click();await page.waitForTimeout(30);
  assert.equal(await dialog.locator('.sia-tree').getByText('已授权',{exact:true}).count(),1,'重复授权不重复添加根目录');
  await dialog.getByRole('button',{name:'选择当前文件夹'}).click();await confirm();
  assert.ok(await page.getByRole('button',{name:'已授权',exact:true}).isVisible());
  await page.locator('#file-false').getByRole('button',{name:'清空选择'}).click();assert.equal(await page.locator('#file-false output').textContent(),'[]');
  assert.equal(await page.getByRole('button',{name:'禁用选择'}).isDisabled(),true);
  console.log('PASS ChooseBox 四种选择模式、跨目录多选、空文件夹、取消/清空、过滤、异步关闭、错误提示及授权取消/去重。');
 }finally{await browser.close();await new Promise(resolve=>server.close(resolve));fs.rmSync(dir,{recursive:true,force:true});}
})().catch(e=>{console.error(e);process.exitCode=1});
