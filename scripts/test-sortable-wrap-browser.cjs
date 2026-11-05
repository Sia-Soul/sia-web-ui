// 原生编辑控件与换行排序联合回归：只操作隔离的内存草稿，不接入业务接口。
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const { chromium } = require(path.join(process.argv[2], 'playwright'));
const out = path.resolve('logs/sortable-wrap');
fs.mkdirSync(out, { recursive: true });
const checks = [];
const check = (name, passed) => { checks.push({name, passed:!!passed}); assert.ok(passed, name); };
(async () => {
  const browser = await chromium.launch({channel:'msedge', headless:true});
  try {
    const page = await browser.newPage({viewport:{width:1440,height:1000}});
    const errors = []; page.on('pageerror', e => errors.push(e.message));
    await page.goto('http://127.0.0.1:4173/');
    await page.evaluate(async source => {
      const {default:React} = await import('/node_modules/.vite/deps/react.js');
      const {default:{createRoot}} = await import('/node_modules/.vite/deps/react-dom_client.js');
      const {SortableList} = await import(source+'/UtilityLayout.tsx');
      const {Input} = await import(source+'/Input.tsx');
      const {Button} = await import(source+'/Button.tsx');
      const {Icon} = await import(source+'/Icon.tsx');
      const {Modal} = await import(source+'/Modal.tsx');
      const {Space} = await import(source+'/Layout.tsx');
      document.body.innerHTML='<div id="fixture"></div>';
      window.orders=[];
      function Demo() {
        const [items,setItems]=React.useState(['甲','乙','丙','丁','戊','己','庚']);
        const [disabled,setDisabled]=React.useState(false);
        const [mixed,setMixed]=React.useState(false);
        window.reset=(keys=['甲','乙','丙','丁','戊','己','庚'],off=false,variable=false)=>{setItems(keys);setDisabled(off);setMixed(variable);window.orders=[];};
        return React.createElement(Modal,{open:true,title:'维护自定义标签',width:960,height:'auto'},
          React.createElement(Space,{direction:'vertical',size:6},
            React.createElement(Space,null,React.createElement(Input,{placeholder:'请输入自定义标签',showCount:true,maxLength:20}),React.createElement(Button,{variant:'link'},'添加')),
            React.createElement(SortableList,{items,wrap:true,disabled,handlePlacement:'custom',onOrderChange:next=>{window.orders.push(next);setItems(next);},
              renderItem:(key,index,handle)=>React.createElement('div',{'data-key':key,style:mixed?{width:['乙','丁','己'].includes(key)?250:180}:undefined},React.createElement(Input,{
                'aria-label':'标签'+key,defaultValue:'受控标签'+key,allowClear:false,prefix:handle,
                suffix:React.createElement(Button,{variant:'text',size:'small',danger:true,'aria-label':'删除'+key,icon:React.createElement(Icon,{name:'trash'}),onClick:()=>setItems(items.filter(x=>x!==key))})}))})));
      }
      createRoot(document.getElementById('fixture')).render(React.createElement(Demo));
    }, '/@fs/'+path.resolve('packages/react/src/components').replace(/\\/g,'/'));
    const item=k=>page.locator(`[data-key="${k}"]`),handle=k=>item(k).getByRole('button',{name:/调整第/});
    const reset=async (...args)=>{await page.evaluate(args=>window.reset(...args),args);await page.waitForTimeout(250);};
    const drag=async (from,to,release=true)=>{
      const a=await handle(from).boundingBox(),b=await handle(to).boundingBox();
      await page.mouse.move(a.x+a.width/2,a.y+a.height/2);await page.mouse.down();
      await page.mouse.move(b.x+b.width/2,b.y+b.height/2,{steps:18});await page.waitForTimeout(250);
      if(release){await page.mouse.up();await page.waitForTimeout(250);}
    };
    await item('庚').waitFor(); await page.waitForTimeout(300);
    const a=await item('甲').boundingBox(),b=await item('乙').boundingBox(),last=await item('庚').boundingBox();
    check('宽屏标签同行排列且自动换行',Math.abs(a.y-b.y)<1&&last.y>a.y);
    await page.screenshot({path:path.join(out,'wide.png')});
    await page.getByRole('textbox',{name:'标签甲',exact:true}).fill('未失焦输入草稿');
    await drag('甲','戊',false);
    check('跨行拖动时不提前提交',await page.evaluate(()=>window.orders.length===0));
    check('跨行预览槽显示',await page.locator('.sia-sortable-list__placeholder').isVisible());
    await page.screenshot({path:path.join(out,'dragging.png')});
    const slot=await page.locator('.sia-sortable-list__placeholder').boundingBox();
    await page.mouse.up();await page.waitForTimeout(250);
    check('跨行落下只提交一次',await page.evaluate(()=>window.orders.length===1&&window.orders[0].join()==='乙,丙,丁,戊,甲,己,庚'));
    const dropped=await item('甲').boundingBox();
    check('预览槽和最终位置一致',Math.abs(dropped.x-slot.x)<1&&Math.abs(dropped.y-slot.y)<1);
    check('编辑草稿随稳定条目保留',await page.getByRole('textbox',{name:'标签甲',exact:true}).inputValue()==='未失焦输入草稿');
    await drag('甲','乙');
    check('反向跨行顺序正确',await page.evaluate(()=>window.orders.at(-1).join()==='甲,乙,丙,丁,戊,己,庚'));
    await reset();await drag('甲','戊',false);await page.keyboard.press('Escape');await page.mouse.up();
    check('Esc取消跨行预览不提交',await page.evaluate(()=>window.orders.length===0));
    await reset();await drag('甲','戊',false);await page.mouse.move(1,1);await page.mouse.up();await page.waitForTimeout(200);
    check('外部松手不提交',await page.evaluate(()=>window.orders.length===0));
    await reset();await handle('丁').press('ArrowRight');
    check('左右键跨行排序',await page.evaluate(()=>window.orders.at(-1).join()==='甲,乙,丙,戊,丁,己,庚'));
    await reset(undefined,true);check('禁用手柄不可拖动',await handle('甲').isDisabled());
    await reset();await page.getByRole('button',{name:'删除丙',exact:true}).click();
    check('删除按钮仅移除目标不触发排序',await item('丙').count()===0&&await page.evaluate(()=>window.orders.length===0));
    await reset();await page.setViewportSize({width:620,height:800});await page.waitForTimeout(250);
    check('窄屏自动换行无页面横向溢出',await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
    const na=await item('甲').boundingBox(),nc=await item('丙').boundingBox();
    check('窄屏每行容纳多个标签',nc.y>na.y&&(await item('乙').boundingBox()).y===na.y);
    await page.screenshot({path:path.join(out,'narrow.png')});
    await drag('甲','庚');check('窄屏跨多行排序',await page.evaluate(()=>window.orders.at(-1).at(-1)==='甲'));
    await reset(undefined,false,true);await drag('甲','戊',false);
    const variableSlot=await page.locator('.sia-sortable-list__placeholder').boundingBox();await page.mouse.up();await page.waitForTimeout(250);
    const variableDrop=await item('甲').boundingBox();
    check('不同宽度条目预览与最终位置一致',Math.abs(variableDrop.x-variableSlot.x)<1&&Math.abs(variableDrop.y-variableSlot.y)<1&&await page.evaluate(()=>window.orders.length===1));
    await reset();await drag('甲','丙',false);await page.setViewportSize({width:650,height:800});await page.mouse.up();
    check('视口变化取消跨行拖动',await page.evaluate(()=>window.orders.length===0));
    await reset();await page.emulateMedia({reducedMotion:'reduce'});await drag('甲','戊');
    check('减少动态效果仍正常排序',await page.evaluate(()=>window.orders.length===1));
    check('无浏览器运行错误',errors.length===0);
    fs.writeFileSync(path.join(out,'index.html'),`<!doctype html><meta charset="utf-8"><title>标签换行排序验证</title><style>body{font:16px system-ui;margin:24px}img{max-width:100%;border:1px solid #ddd}section{margin:24px 0}</style><h1>标签换行排序验证</h1><p>${checks.length} 项检查通过。框架隔离预览，正式业务接入需发布后复测。</p>`+['wide','dragging','narrow'].map(x=>`<section><h2>${x}</h2><img src="${x}.png"></section>`).join(''));
  } finally {fs.writeFileSync(path.join(out,'results.json'),JSON.stringify(checks,null,2));await browser.close();}
  console.log(JSON.stringify(checks));
})().catch(e=>{console.error(e);process.exitCode=1;});
