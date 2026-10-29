// 真实浏览器验证圆形外观、原生复选语义，以及分组继承和显式覆盖。
const assert = require('node:assert/strict');
const path = require('node:path');
const http = require('node:http');
const root = path.resolve(__dirname, '..');
const { build } = require(require.resolve('esbuild', { paths: [path.dirname(require.resolve('vite', { paths: [path.join(root, 'apps/docs')] }))] }));
const { chromium } = require(path.join(process.env.USERPROFILE, '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));

(async () => {
  const bundle = await build({ stdin: { resolveDir: path.join(root, 'apps/docs'), loader: 'tsx', contents: `
    import React from 'react'; import {createRoot} from 'react-dom/client';
    import {Checkbox} from '../../packages/react/src/components/Checkbox';
    import '../../packages/react/src/styles.css'; import '../../packages/react/src/components-extra.css';
    function App(){const [checked,setChecked]=React.useState(false);const [shape,setShape]=React.useState('circle');window.setShape=setShape;
      return <main style={{display:'grid',gap:20,padding:30}}>
        <Checkbox>默认方框</Checkbox><Checkbox shape="circle" checked={checked} onChange={setChecked}>受控圆形</Checkbox>
        <Checkbox shape="circle" defaultChecked>默认选中</Checkbox><Checkbox shape="circle" indeterminate>半选</Checkbox>
        <Checkbox shape="circle" disabled defaultChecked>禁用已选</Checkbox><Checkbox shape="circle" disabled>禁用未选</Checkbox>
        {['small','medium','large'].map(size=><Checkbox key={size} shape="circle" size={size} defaultChecked>{size}</Checkbox>)}
        <Checkbox.Group shape={shape} name="roles" defaultValue={['a']} options={[{label:'查看',value:'a'},{label:'编辑',value:'b'}]} onChange={values=>window.values=values}/>
        <Checkbox.Group shape={shape} defaultValue={['c','d']}><Checkbox value="c">继承</Checkbox><Checkbox value="d" shape="square">覆盖</Checkbox></Checkbox.Group>
        <Checkbox.Group shape="circle" disabled options={['分组禁用']}/>
      </main>;
    }createRoot(document.getElementById('root')).render(<App/>);
  ` }, bundle: true, write: false, outdir: 'out', format: 'iife', jsx: 'automatic' });
  const js = bundle.outputFiles.find(file=>file.path.endsWith('.js')).text;
  const css = bundle.outputFiles.find(file=>file.path.endsWith('.css')).text;
  const server = http.createServer((req,res)=>{res.setHeader('Content-Type','text/html; charset=utf-8');res.end(`<!doctype html><meta charset="utf-8"><style>${css}</style><div id="root"></div><script>${js}</script>`);});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const browser = await chromium.launch({channel:'msedge',headless:true});
  try {
    const page = await browser.newPage();
    const errors=[];page.on('pageerror',error=>errors.push(error.message));
    await page.goto(`http://127.0.0.1:${server.address().port}`);
    const checkbox = name=>page.getByRole('checkbox',{name,exact:true});
    const radius = name=>checkbox(name).evaluate(node=>getComputedStyle(node.nextElementSibling).borderRadius);
    await checkbox('受控圆形').waitFor({state:'attached'});
    assert.notEqual(await radius('默认方框'),'50%');
    for(const size of ['small','medium','large']) {
      assert.equal(await radius(size),'50%');
      const dimensions=await checkbox(size).evaluate(node=>{const box=node.nextElementSibling.getBoundingClientRect();return [box.width,box.height];});
      assert.equal(dimensions[0],dimensions[1],'各尺寸必须保持正圆');
    }
    await page.getByText('受控圆形',{exact:true}).click();assert.equal(await checkbox('受控圆形').isChecked(),true);
    await checkbox('受控圆形').focus();await page.keyboard.press('Space');assert.equal(await checkbox('受控圆形').isChecked(),false);
    assert.equal(await checkbox('默认选中').isChecked(),true);
    assert.equal(await checkbox('半选').getAttribute('aria-checked'),'mixed');
    assert.equal(await checkbox('半选').evaluate(node=>node.indeterminate),true);
    // 绕过测试工具的禁用等待，让真实鼠标事件到达标签，验证原生 disabled 仍阻止切换。
    await page.getByText('禁用已选',{exact:true}).click({force:true});assert.equal(await checkbox('禁用已选').isChecked(),true);
    await page.getByText('禁用未选',{exact:true}).click({force:true});assert.equal(await checkbox('禁用未选').isChecked(),false);
    assert.equal(await checkbox('分组禁用').isDisabled(),true);
    for(const name of ['查看','编辑','继承'])assert.equal(await radius(name),'50%');
    assert.notEqual(await radius('覆盖'),'50%');
    await page.getByText('编辑',{exact:true}).click();
    assert.deepEqual(await page.evaluate(()=>window.values),['a','b'],'圆形分组仍能同时选中多项');
    await page.evaluate(()=>window.setShape('square'));
    await page.waitForFunction(()=>document.querySelectorAll('.sia-checkbox-group .sia-checkbox--circle').length===1);
    assert.notEqual(await radius('继承'),'50%');assert.equal(await checkbox('编辑').isChecked(),true);
    assert.equal(await checkbox('查看').getAttribute('name'),'roles');
    assert.equal(await checkbox('受控圆形').getAttribute('shape'),null,'自有属性不能泄漏到 input');
    // 亮暗主题均显示主题色圆底和白色勾选；半选横线保持可见。
    for(const theme of ['light','dark']) {
      await page.evaluate(theme=>document.documentElement.dataset.siaTheme=theme,theme);await page.waitForTimeout(180);
      const visual=await checkbox('默认选中').evaluate(node=>{
        const box=node.nextElementSibling;const mark=box.firstElementChild;
        return {background:getComputedStyle(box).backgroundColor,mark:getComputedStyle(mark).borderBottomColor,opacity:getComputedStyle(mark).opacity};
      });
      assert.equal(visual.background,theme==='light'?'rgb(22, 119, 255)':'rgb(22, 104, 220)');
      assert.equal(visual.mark,'rgb(255, 255, 255)');assert.equal(visual.opacity,'1');
    }
    assert.deepEqual(errors,[]);
    console.log('PASS 圆形尺寸、受控点击与空格、默认选中、半选、禁用、分组多选与形状继承覆盖、动态变更、亮暗主题。');
  } finally { await browser.close(); server.close(); }
})().catch(error=>{console.error(error);process.exitCode=1;});
