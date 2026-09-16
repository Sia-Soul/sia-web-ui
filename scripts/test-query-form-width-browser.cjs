const assert = require('node:assert/strict');
const { chromium } = require(require('node:path').join(process.argv[2], 'playwright'));
(async () => {
  const browser = await chromium.launch({ headless: true, channel: 'msedge' });
  try {
    const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
    await page.goto('http://127.0.0.1:4173/components/query-form');
    await page.evaluate(async () => {
      const { default: R } = await import('/node_modules/.vite/deps/react.js');
      const { default: { createRoot } } = await import('/node_modules/.vite/deps/react-dom_client.js');
      const { QueryForm, Form, Input, Select, DatePicker, TimePicker, Space } = await import('/@fs/C:/Users/12235/Documents/SiaWebUI/packages/react/src/index.ts');
      const host = document.createElement('div'); host.id = 'width-fixture'; host.style = 'position:absolute;top:0;left:0;width:1000px;background:white;z-index:9999'; document.body.append(host);
      const root = createRoot(host), h = R.createElement;
      window.renderWidths = (fieldWidth = 200, gap = 12, childrenMode = false) => {
        const controls = [h(Input), h(DatePicker.RangePicker), h(TimePicker.RangePicker), h(Space.Compact, { block: true }, h(Select, { options: [] }), h(Input)), h(DatePicker.RangePicker)];
        root.render(h(QueryForm, { fieldWidth, style: { '--sia-query-field-gap': gap + 'px' }, onSearch() {}, ...(childrenMode ? { children: controls.slice(0,4).map((c,i)=>h(Form.Item,{key:i,name:'f'+i},c)) } : { fields: controls.map((children,i)=>({key:String(i),children,...(i===4?{width:330}:{})})) }) }));
      };
      window.renderWidths();
    });
    const fields = page.locator('#width-fixture .sia-query-form__field');
    async function widths(expected) {
      await page.waitForFunction(e => {
        const nodes = [...document.querySelectorAll('#width-fixture .sia-query-form__field')];
        return nodes.length === e.length && nodes.every((n,i)=>Math.abs(n.getBoundingClientRect().width-e[i])<1);
      }, expected);
    }
    await widths([200,412,412,412,330]);
    await page.evaluate(()=>window.renderWidths(240,16)); await widths([240,496,496,496,330]);
    await page.evaluate(()=>window.renderWidths(200,12,true)); await widths([200,412,412,412]);
    await page.locator('#width-fixture').getByRole('button',{name:/收起/}).click();
    const rects = await fields.evaluateAll(nodes=>nodes.filter(n=>!n.hidden).map(n=>n.getBoundingClientRect().top));
    assert(rects.every(top=>Math.abs(top-rects[0])<1));
    await page.locator('#width-fixture').getByRole('button',{name:/展开/}).click();
    await page.setViewportSize({width:500,height:1000});
    await page.locator('#width-fixture').evaluate(n=>n.style.width='460px');
    await widths([460,460,460,460]);
    console.log('PASS single/double widths, custom width and gap, Form.Item children, collapse single row, mobile layout');
  } finally { await browser.close(); }
})().catch(e=>{console.error(e);process.exitCode=1;});
