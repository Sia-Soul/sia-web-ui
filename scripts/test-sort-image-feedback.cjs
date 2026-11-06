// 使用真实 Edge 验证常显排序、原图加载与滚轮缩放，不连接业务接口。
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require(path.join(process.argv[2], 'playwright'));
(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: false });
  const results = [];
  const check = async (name, action) => { try { await action(); results.push({ name, passed: true }); } catch (error) { results.push({ name, passed: false, error: error.message }); } };
  const dir = 'logs/sort-image-feedback'; fs.mkdirSync(dir, { recursive: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    await page.goto('http://127.0.0.1:4173/components/table');
    await page.evaluate(async () => {
      const { default: R } = await import('/node_modules/.vite/deps/react.js');
      const dom = await import('/node_modules/.vite/deps/react-dom_client.js');
      const { Table, createSortPlugin } = await import('/@fs/C:/Users/12235/Documents/SiaWebUI/packages/react/src/components/Table/index.ts');
      const { Image, ImagePreviewGroup } = await import('/@fs/C:/Users/12235/Documents/SiaWebUI/packages/react/src/components/DataDisplay.tsx');
      document.body.innerHTML = ''; const host = document.createElement('div'); document.body.append(host);
      const svg = (width, height) => 'data:image/svg+xml,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><rect width="100%" height="100%" fill="#1890ff"/><text x="30" y="80" fill="white" font-size="40">${width} × ${height}</text></svg>`);
      const root = (dom.default ?? dom).createRoot(host);
      window.renderDemo = (originalSrc = svg(3000,2000), grouped = false) => root.render(R.createElement(R.Fragment, null,
        R.createElement(Table, { rowKey: 'id', height: 220, columns: [{key:'name',dataIndex:'name', title:'品牌方名称',sortable:true,width:180},{key:'status',dataIndex:'status',title:'状态',width:180}], dataSource:[{id:1,name:'品牌乙',status:'合作中'},{id:2,name:'品牌甲',status:'合作中'}], plugins:[createSortPlugin()]}),
        R.createElement(grouped ? ImagePreviewGroup : R.Fragment, {key:String(grouped)+originalSrc},
          R.createElement(Image, {src:svg(120,120),width:120,height:120,preview:{src:svg(800,600),originalSrc}}),
          grouped ? R.createElement(Image,{src:svg(100,100),width:100,height:100,preview:{src:svg(600,400)}}) : null)));
      window.renderDemo();
    });
    const sort = page.locator('.sia-table__sort-button').first(); await sort.waitFor();
    await page.mouse.move(1300, 800);
    await check('排序按钮未悬停时常显且参与布局', async () => { const style = await sort.evaluate(el => ({position:getComputedStyle(el).position,opacity:getComputedStyle(el).opacity})); assert.notEqual(style.position,'absolute'); assert.equal(style.opacity,'1'); });
    await check('不可排序列无入口，排序三态保持',async()=>{assert.equal(await page.locator('.sia-table__sort-button').count(),1);for(const state of ['ascend','descend','none']) {await sort.click();assert.equal(await sort.getAttribute('data-sort-order'),state);}});
    await page.mouse.move(1300,800); await page.waitForTimeout(250); await page.screenshot({path:path.join(dir,'sort.png')});
    await page.getByRole('button',{name:'预览图片',exact:true}).click();
    const dialog=page.getByRole('dialog',{name:'图片预览'}), img=dialog.locator('img');
    await img.waitFor(); await page.waitForTimeout(300);
    const box=await img.boundingBox(); await page.mouse.move(box.x+box.width/2,box.y+box.height/2);
    await check('滚轮向上放大',async()=>{ const width=(await img.boundingBox()).width; await page.mouse.wheel(0,-160); await page.waitForTimeout(150); assert.ok((await img.boundingBox()).width>width); });
    await check('滚轮向下缩小',async()=>{ const width=(await img.boundingBox()).width; await page.mouse.wheel(0,160); await page.waitForTimeout(150); assert.ok((await img.boundingBox()).width<width); });
    await page.mouse.move(20,20); await page.waitForTimeout(250); await page.screenshot({path:path.join(dir,'preview.png')});
    await check('预览保留查看原图入口并加载原始尺寸',async()=>{ const button=dialog.getByRole('button',{name:'查看原图',exact:true}); await button.click({timeout:1500}); await page.waitForFunction(()=>document.querySelector('.sia-image-preview__stage img')?.naturalWidth===3000); });
    await page.waitForTimeout(250); await page.screenshot({path:path.join(dir,'original.png')});
    await check('原图加载成功后隐藏入口',async()=>assert.equal(await dialog.getByRole('button',{name:'查看原图',exact:true}).count(),0));
    await dialog.getByRole('button',{name:'关闭预览',exact:true}).click(); await dialog.waitFor({state:'hidden'});
    await page.getByRole('button',{name:'预览图片',exact:true}).click();
    await check('重开恢复预览尺寸和原图入口',async()=>{await page.waitForFunction(()=>document.querySelector('.sia-image-preview__stage img')?.naturalWidth===800);assert.equal(await dialog.getByRole('button',{name:'查看原图',exact:true}).count(),1);});
    await page.setViewportSize({width:390,height:700});
    await check('窄屏工具条及原图文案完整显示',async()=>{const toolbar=await dialog.getByRole('toolbar').boundingBox();assert.ok(toolbar.x>=0 && toolbar.x+toolbar.width<=390);const button=dialog.getByRole('button',{name:'查看原图',exact:true});assert.ok((await button.boundingBox()).width>60);});
    await page.waitForTimeout(250); await page.screenshot({path:path.join(dir,'narrow.png')});
    await page.keyboard.press('Escape');await dialog.waitFor({state:'hidden'});await page.setViewportSize({width:1440,height:900});
    let requests=0;
    await page.route('**/controlled-original.svg',async route=>{requests++;await new Promise(resolve=>setTimeout(resolve,300)); if(requests===1) await route.abort();else await route.fulfill({contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" width="3200" height="2400"><rect width="3200" height="2400" fill="#17a673"/></svg>'});});
    await page.evaluate(()=>window.renderDemo('/controlled-original.svg'));
    await page.getByRole('button',{name:'预览图片',exact:true}).click();await page.waitForTimeout(200);
    await check('未点击时不请求原图',async()=>assert.equal(requests,0));
    const originalButton=dialog.getByRole('button',{name:'查看原图',exact:true});await originalButton.click();
    await check('加载时按钮禁用并保留预览',async()=>{assert.ok(await originalButton.isDisabled());assert.equal(await img.evaluate(el=>el.naturalWidth),800);});
    await page.waitForTimeout(450);
    await check('失败保留预览并允许重试',async()=>{assert.ok(await originalButton.isEnabled());assert.equal(await img.evaluate(el=>el.naturalWidth),800);await originalButton.click();await page.waitForFunction(()=>document.querySelector('.sia-image-preview__stage img')?.naturalWidth===3200);assert.equal(requests,2);});
    await page.keyboard.press('Escape');await dialog.waitFor({state:'hidden'});
    await page.evaluate(()=>window.renderDemo(undefined,true));await page.getByRole('button',{name:'预览图片',exact:true}).first().click();
    await check('分组使用预览地址而非缩略图',async()=>{await page.waitForFunction(()=>document.querySelector('.sia-image-preview__stage img')?.naturalWidth===800);assert.equal(await originalButton.count(),1);});
    await originalButton.click();await page.waitForFunction(()=>document.querySelector('.sia-image-preview__stage img')?.naturalWidth===3000);
    await dialog.getByRole('button',{name:'下一张',exact:true}).click();
    await check('切换到无原图配置的图片不串图',async()=>{await page.waitForFunction(()=>document.querySelector('.sia-image-preview__stage img')?.naturalWidth===600);assert.equal(await originalButton.count(),0);});
    await dialog.getByRole('button',{name:'上一张',exact:true}).click();
    await check('返回上一张重置为预览图',async()=>{await page.waitForFunction(()=>document.querySelector('.sia-image-preview__stage img')?.naturalWidth===800);assert.equal(await originalButton.count(),1);});
    fs.writeFileSync(path.join(dir,'result.json'),JSON.stringify(results,null,2));
    console.log(JSON.stringify(results,null,2)); if(results.some(result=>!result.passed)) process.exitCode=1;
  } finally { await browser.close(); }
})().catch(error=>{console.error(error);process.exitCode=1;});
