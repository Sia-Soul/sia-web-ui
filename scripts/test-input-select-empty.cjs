// 验证空值不会产生自定义选项，同时保留 0、非空自定义值及显式空值选项。
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),http=require('node:http');
const {createRequire}=require('node:module');
const ui=createRequire(path.resolve('packages/react/package.json'));
const {buildSync}=createRequire(ui.resolve('tsup'))('esbuild');
const {chromium}=require(path.join(process.env.USERPROFILE,'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));
(async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'sia-input-select-empty-'));
 buildSync({entryPoints:['scripts/fixtures/input-select-empty.tsx'],bundle:true,nodePaths:[path.resolve('packages/react/node_modules')],format:'iife',platform:'browser',jsx:'automatic',outfile:path.join(dir,'fixture.js'),define:{'process.env.NODE_ENV':'"production"'}});
 const server=http.createServer((req,res)=>{
  if(['/fixture.js','/fixture.css'].includes(req.url)){res.setHeader('Content-Type',req.url.endsWith('.css')?'text/css':'application/javascript');res.end(fs.readFileSync(path.join(dir,req.url.slice(1))));}
  else{res.setHeader('Content-Type','text/html; charset=utf-8');res.end('<meta charset="utf-8"><link rel="stylesheet" href="/fixture.css"><div id="root"></div><script src="/fixture.js"></script>');}
 });await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const browser=await chromium.launch({channel:'msedge',headless:true});
 try{
  const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(`http://127.0.0.1:${server.address().port}`);
  await page.emulateMedia({reducedMotion:'reduce'});
  const input=page.getByRole('combobox',{name:'待测输入选择'}),popup=page.locator('.sia-input-select__popup');
  await input.click();await popup.waitFor({state:'visible'});
  assert.equal(await popup.getByText('自定义值',{exact:true}).count(),0,'空字符串不能显示自定义值分组');
  const checkEmpty=async value=>{
    await page.evaluate(value=>window.configure({value}),value);
    assert.equal(await popup.getByRole('option').count(),2);
    assert.equal(await popup.getByText('自定义值',{exact:true}).count(),0);
  };
  for(const value of [null,'','   ',[],['','  ']])await checkEmpty(value);
  await page.evaluate(()=>window.configure({value:0}));
  assert.equal(await popup.getByRole('option',{name:'0',exact:true}).getAttribute('aria-selected'),'true');
  await page.evaluate(()=>window.configure({value:'自定义名称'}));
  assert.equal(await popup.getByRole('option',{name:'自定义名称',exact:true}).getAttribute('aria-selected'),'true');
  await page.evaluate(()=>window.configure({value:'',options:[{value:'',label:'全部'},{value:'order',label:'订单'}]}));
  assert.equal(await input.inputValue(),'全部');
  assert.equal(await popup.getByRole('option',{name:'全部',exact:true}).getAttribute('aria-selected'),'true');
  assert.equal(await popup.getByText('自定义值',{exact:true}).count(),0);
  await page.evaluate(()=>window.configure({value:'old',displayField:'value'}));
  await input.fill('');
  assert.equal(await popup.getByText('自定义值',{exact:true}).count(),0,'删除输入不能留下空选项');
  await page.evaluate(()=>window.configure({value:['',0,'  ','自定义名称'],multiple:true}));
  assert.equal(await popup.getByText('已选 2 项',{exact:true}).count(),1);
  await page.getByRole('button',{name:'打开选择弹窗',exact:true}).click();
  assert.equal(await page.getByRole('tab',{name:'已选项(2)',exact:true}).count(),1);
  const modal=page.locator('.sia-modal');
  assert.equal(await modal.getByRole('option').count(),4);
  await page.getByRole('button',{name:'取消',exact:true}).click();
  await page.getByRole('combobox',{name:'表单空值'}).click();
  assert.equal(await popup.getByText('自定义值',{exact:true}).count(),0);
  assert.equal(await popup.getByRole('option').count(),2);
  assert.deepEqual(errors,[]);console.log('PASS InputSelect 空值、空白、多选、输入删除、Form 绑定、弹窗、0 和显式空值选项。');
 }finally{await browser.close();await new Promise(resolve=>server.close(resolve));fs.rmSync(dir,{recursive:true,force:true});}
})().catch(e=>{console.error(e);process.exitCode=1});
