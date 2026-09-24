// 故意在每次渲染重建插件，验证跨页缓存跟随表格而不是插件闭包。
const assert = require('node:assert/strict');
const { chromium } = require(require('node:path').join(process.argv[2], 'playwright'));
(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  try {
    const page = await browser.newPage();
    await page.goto(process.argv[3] || 'http://127.0.0.1:4174/components/table', { waitUntil: 'domcontentloaded' });
    await page.evaluate(async () => {
      const { default: R } = await import('/node_modules/.vite/deps/react.js');
      const { default: { createRoot } } = await import('/node_modules/.vite/deps/react-dom_client.js');
      const { Table } = await import('/@fs/C:/Users/12235/Documents/SiaWebUI/packages/react/src/components/Table/Table.tsx');
      const { createSelectionPlugin } = await import('/@fs/C:/Users/12235/Documents/SiaWebUI/packages/react/src/components/Table/plugins.tsx');
      const h = R.createElement;
      function Demo() {
        const [keys, setKeys] = R.useState([]);
        const [second, setSecond] = R.useState(false);
        const ref = R.useRef(null);
        window.selection = () => ref.current.getPluginApi('selection');
        return h('div', null,
          h('button', { onClick: () => setSecond(v => !v) }, '翻页'),
          h(Table, { ref, rowKey: 'id', columns: [{key:'name',dataIndex:'name',name:'店铺'}],
            dataSource: Array.from({length:second?3:4},(_,i)=>({id:i+(second?5:1),name:`店铺${i+(second?5:1)}`})),
            plugins:[createSelectionPlugin({selectedKeys:keys,onChange:(next,rows)=>{setKeys(next);window.changedRows=rows;},preserveSelectedRowKeys:true,showSelectedCount:true})]
          }));
      }
      const root=document.createElement('div');document.body.replaceChildren(root);createRoot(root).render(h(Demo));
    });
    await page.getByRole('checkbox',{name:'选择当前页全部行'}).press('Space');
    await page.getByRole('button',{name:'已选 4 条',exact:true}).waitFor();
    await page.getByRole('button',{name:'翻页'}).click();
    await page.getByRole('button',{name:'已选 4 条',exact:true}).waitFor();
    await page.getByRole('checkbox',{name:'选择当前页全部行'}).press('Space');
    await page.getByRole('button',{name:'已选 7 条',exact:true}).waitFor();
    assert.equal(await page.evaluate(()=>window.changedRows.length),7);
    await page.getByRole('button',{name:'翻页'}).click();
    await page.getByRole('button',{name:'已选 7 条',exact:true}).waitFor();
    await page.getByRole('checkbox',{name:'跨页保留勾选'}).press('Space');
    await page.getByRole('button',{name:'已选 4 条',exact:true}).waitFor();
    await page.getByRole('checkbox',{name:'选择当前页全部行'}).press('Space');
    await page.getByRole('button',{name:'已选 0 条',exact:true}).waitFor();
    console.log('PASS: 重建插件后跨页4+3=7，回调完整返回7条；关闭跨页保留及清空正确。');
  } finally { await browser.close(); }
})().catch(error=>{console.error(error);process.exitCode=1;});
