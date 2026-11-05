// 历史附件经过 JSON 往返后不再是 File；长中文标签不应挤压两列业务表单。
const assert = require('node:assert/strict');
const { chromium } = require(require('node:path').join(process.argv[2], 'playwright'));
(async () => {
  const browser = await chromium.launch({channel:'msedge',headless:true});
  try {
    const page = await browser.newPage({viewport:{width:1440,height:900}});
    const errors=[];
    page.on('pageerror', e=>errors.push(e.message));
    await page.goto('http://127.0.0.1:4173/components/form');
    await page.evaluate(async () => {
      const {default:React}=await import('/node_modules/.vite/deps/react.js');
      const {default:{createRoot}}=await import('/node_modules/.vite/deps/react-dom_client.js');
      const {Form}=await import('/@fs/C:/Users/12235/Documents/SiaWebUI/packages/react/src/components/Form.tsx');
      const {Input}=await import('/@fs/C:/Users/12235/Documents/SiaWebUI/packages/react/src/components/Input.tsx');
      const {Upload}=await import('/@fs/C:/Users/12235/Documents/SiaWebUI/packages/react/src/components/Upload.tsx');
      const host=document.createElement('div'); host.style.padding='32px'; document.body.replaceChildren(host);
      const root=createRoot(host);
      window.mountProbe=(upload=false)=>root.render(upload ? React.createElement(Upload,{listType:'picture-card',fileList:[{uid:'history',name:'历史图片.png',status:'done',originFileObj:{},url:'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a9ioAAAAASUVORK5CYII='}]}) : React.createElement(Form,null,
        React.createElement('div',{style:{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}},
          ...['款式名称','非常长的属性名称'.repeat(16)].map(label=>React.createElement(Form.Item,{key:label,label,required:true},React.createElement(Input))))));
    });
    await page.evaluate(()=>window.mountProbe(true));
    await page.waitForTimeout(500);
    assert.deepEqual(errors,[], '历史附件不能使表单崩溃');
    await page.evaluate(()=>window.mountProbe());
    for(const width of [1440,1024]) {
      await page.setViewportSize({width,height:900}); await page.waitForTimeout(500);
      const bounds=await page.locator('.sia-form-item').evaluateAll(items=>items.map(item=>({
        label:item.querySelector('.sia-form-item__label').getBoundingClientRect().width,
        control:item.querySelector('input').getBoundingClientRect().width,
        height:item.querySelector('.sia-form-item__label-content').getBoundingClientRect().height,
        line:parseFloat(getComputedStyle(item.querySelector('.sia-form-item__label-content')).lineHeight),
        // 两行标签以整块文字的中心对齐控件，不能只让第一行居中。
        centerDelta:(()=>{const a=item.querySelector('.sia-form-item__label-content').getBoundingClientRect(),b=item.querySelector('input').getBoundingClientRect();return Math.abs(a.top+a.height/2-b.top-b.height/2);})(),
        // 必填星号与整个文案块居中，而不是贴在多行文案的第一行。
        requiredDelta:(()=>{const a=item.querySelector('.sia-form-item__required-mark').getBoundingClientRect(),b=(item.querySelector('.sia-form-item__label-text')||item.querySelector('.sia-form-item__label-content')).getBoundingClientRect();return Math.abs(a.top+a.height/2-b.top-b.height/2);})(),
      })));
      assert(bounds.every(x=>x.control>150 && x.label<=200),JSON.stringify(bounds));
      assert(bounds[1].height<=bounds[1].line*2+1);
      assert(bounds[1].centerDelta<1,JSON.stringify(bounds));
      assert(bounds.every(x=>x.requiredDelta<1),JSON.stringify(bounds));
      // 每次生成独立截图，避免同路径图片缓存掩盖最终修复效果；近景保留上下留白供人工核对。
      await page.screenshot({path:`logs/form-required-centered-${width}.png`,clip:{x:0,y:0,width,height:150}});
      console.log(JSON.stringify({width,bounds}));
      await page.locator('.sia-form-item__label-content').last().hover();
      await page.getByRole('tooltip').filter({hasText:'非常长的属性名称'}).waitFor();
      await page.screenshot({path:`logs/form-history-${width}.png`});
      await page.mouse.move(0,0);
    }
    console.log('PASS: 历史附件、长标签两行截断、悬停全文、1440/1024 两列控件宽度');
  } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
