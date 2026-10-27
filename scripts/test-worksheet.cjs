// 框架工作表验收：纯数据边界和实际鼠标键盘交互，全部为本地草稿，无网络业务写入。
const assert = require("node:assert/strict"),
  fs = require("node:fs"),
  path = require("node:path"),
  http = require("node:http");
const root = path.resolve(__dirname, "..");
const { build } = require(require.resolve("esbuild", {
  paths: [
    path.dirname(
      require.resolve("vite", { paths: [path.join(root, "apps/docs")] })
    ),
  ],
}));
const { chromium } = require(path.join(
  process.env.USERPROFILE,
  ".cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright"
));
const out = path.join(root, "logs/worksheet");
fs.mkdirSync(out, { recursive: true });
(async () => {
  const modelBuild = await build({
    entryPoints: [
      path.join(root, "packages/react/src/components/Table/worksheetModel.ts"),
    ],
    bundle: true,
    platform: "node",
    format: "cjs",
    write: false,
  });
  const mod = { exports: {} };
  new Function("module", "exports", modelBuild.outputFiles[0].text)(
    mod,
    mod.exports
  );
  const m = mod.exports;
  assert.deepEqual(
    m.parseWorksheetText('001\t"多\n行"\r\n002\t"a\t""b"""\r\n'),
    [
      ["001", "多\n行"],
      ["002", 'a\t"b"'],
    ]
  );
  assert.equal(m.worksheetText([["a\tb", 'c"d']]), '"a\tb"\t"c""d"');
  assert.equal(m.incrementWorksheetValue("SKU009件", 2), "SKU011件");
  assert.equal(m.incrementWorksheetValue("A01.50kg", -2), "A-00.50kg");
  const original = { fields: { name: "原值" }, other: 1 };
  const changed = m.setWorksheetValue(
    original,
    { key: "name", dataIndex: ["fields", "name"] },
    "新值"
  );
  assert.equal(original.fields.name, "原值");
  assert.equal(changed.fields.name, "新值");
  assert.equal(
    m.setWorksheetValue(original, { key: "__proto__.polluted" }, true),
    original
  );
  assert.ok(
    Array.isArray(
      m.setWorksheetValue(
        { items: [{ name: "A" }] },
        { key: "name", dataIndex: ["items", "0", "name"] },
        "B"
      ).items
    )
  );
  console.log("PASS TSV、引号、多行、前导零、递增与不可变路径");
  const bundled = await build({
    stdin: {
      resolveDir: path.join(root, "apps/docs"),
      loader: "tsx",
      contents: `
 import React,{useMemo,useRef,useState} from 'react';import {createRoot} from 'react-dom/client';
 import {Table} from '../../packages/react/src/components/Table/Table';import {createWorksheetPlugin} from '../../packages/react/src/components/Table/worksheet';import {Icon} from '../../packages/react/src/components/Icon';import {createEditablePlugin,createSortPlugin} from '../../packages/react/src/components/Table/plugins';
 import '../../packages/react/src/styles.css';import '../../packages/react/src/components-extra.css';
 const initial=()=>[{id:1,style:'款式一',code:'SKU001',name:'商品一',size:'M',price:10,ok:true},{id:2,style:'款式一',code:'',name:'',size:'',price:null,ok:true},{id:3,style:'款式二',code:'',name:'',size:'',price:null,ok:false},{id:4,style:'款式二',code:'终点',name:'保留',size:'L',price:40,ok:true}];
 const columns=[{key:'style',title:'款式',dataIndex:'style',width:140,fixed:'left',invalid:r=>r.id===4},{key:'code',title:'编号',dataIndex:'code',width:150,editable:true,sortable:true,required:true,invalid:r=>!r.code.trim()},{key:'name',title:'名称',dataIndex:'name',width:160,editable:true,render:v=><span><span data-testid="cell-error" style={{color:'var(--sia-color-error)'}}><Icon name="circle-close" variant="filled"/></span>{v}</span>},{key:'size',title:'尺码',dataIndex:'size',width:120,required:true,invalid:r=>r.ok&&!r.size,editable:{type:'select',options:[{value:'M',label:'M'},{value:'L',label:'L'}],canEdit:r=>r.ok}},{key:'price',title:'价格',dataIndex:'price',width:120,required:true,invalid:r=>r.price==null,editable:{type:'inputNumber'}}];
 // 嵌套表格按各自根节点隔离剪贴板和快捷键，外层已有选区也不能抢走内层操作。
 function NestedCase(){const [rows,setRows]=useState([{id:1,code:'外层'}]),[inner,setInner]=useState([{id:1,code:'内层'}]),outerRef=useRef(null),innerRef=useRef(null);const outer=useMemo(()=>createWorksheetPlugin({onChange:setRows}),[]),inside=useMemo(()=>createWorksheetPlugin({onChange:setInner}),[]);window.nestedRows=rows;window.innerRows=inner;window.prepareNested=()=>{outerRef.current.getPluginApi('cellSelection').setRange({anchor:{rowKey:1,columnKey:'code'},focus:{rowKey:1,columnKey:'code'}});innerRef.current.getPluginApi('cellSelection').setRange({anchor:{rowKey:1,columnKey:'code'},focus:{rowKey:1,columnKey:'code'}});};const innerColumns=[{key:'code',title:'编号',dataIndex:'code',editable:true}];return <Table ref={outerRef} rowKey="id" dataSource={rows} plugins={[outer]} columns={[...innerColumns,{key:'nested',title:'内层',render:()=> <><div id="nested-plain"><Table columns={innerColumns} rowKey="id" dataSource={inner}/></div><div id="nested-sheet"><Table ref={innerRef} columns={innerColumns} rowKey="id" dataSource={inner} plugins={[inside]}/></div></>}]} />;}
 function App(){const [rows,setRows]=useState(initial),[nested,setNested]=useState(false),[locked,setLocked]=useState(false),ref=useRef(null);window.setReadonly=setLocked;const plugin=useMemo(()=>createWorksheetPlugin({historyLimit:4,onChange:(next,operation)=>{if(window.reject)return false;if(window.fail)throw Error('reject');setRows(next);window.operations.push(operation);},onError:e=>window.handledError=e.message}),[]);
 window.operations=window.operations||[];window.rows=rows;window.sheet=()=>ref.current.getPluginApi('worksheet');window.select=(a,b=a)=>ref.current.getPluginApi('cellSelection').setRange({anchor:a,focus:b});
 window.resetData=()=>setRows(initial());
 return <main><button onClick={()=>setRows(initial())}>重置</button><button onClick={()=>setRows(Array.from({length:500},(_,i)=>({...initial()[0],id:i+1,code:i===0?'R001':'',name:''})))}>500行</button><button onClick={()=>window.sheet().replaceData([...rows,{...rows[0],id:99,code:''}])}>复制行</button><button onClick={()=>setNested(true)}>嵌套示例</button><input aria-label="表格外输入" defaultValue="外部"/><div id="sheet"><Table ref={ref} columns={locked?columns.map(c=>({...c,editable:false})):columns} dataSource={rows} rowKey="id" plugins={[plugin,createSortPlugin()]} height={350} size="small" striped={false}/></div><div id="plain"><Table columns={columns} dataSource={initial()} rowKey="id" height={180} plugins={[createEditablePlugin()]}/></div>{nested&&<NestedCase/>}</main>}
 createRoot(document.getElementById('root')).render(<App/>);`,
    },
    bundle: true,
    write: false,
    outdir: "out",
    format: "iife",
    jsx: "automatic",
  });
  const js = bundled.outputFiles.find((f) => f.path.endsWith(".js")).text,
    css = bundled.outputFiles.find((f) => f.path.endsWith(".css")).text;
  const server = http.createServer((req, res) => {
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.end(
      `<!doctype html><meta charset="utf-8"><style>${css}</style><div id="root"></div><script>${js}</script>`
    );
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const browser = await chromium.launch({ channel: "msedge", headless: true });
  const checks = [],
    errors = [];
  let page;
  try {
    page = await browser.newPage({ viewport: { width: 1100, height: 850 } });
    page.on("pageerror", (e) => errors.push(e.message));
    page.setDefaultTimeout(6000);
    await page.goto("http://127.0.0.1:" + server.address().port);
    await page.locator("#sheet td").first().waitFor();
    const check = (name, pass) => {
      assert.ok(pass, name);
      checks.push(name);
      console.log("PASS " + name);
    };
    const cell = (id, key) =>
      page.locator(
        '#sheet tr[data-row-key="' + id + '"] td[data-column-key="' + key + '"]'
      );
    const data = () => page.evaluate(() => window.rows);
    const api = async (name, ...args) => {
      const value = await page.evaluate(
        ({ name, args }) => window.sheet()[name](...args),
        { name, args }
      );
      await page.waitForTimeout(35);
      return value;
    };
    const select = async (id, key, endId = id, endKey = key) => {
      await page.evaluate(
        ({ id, key, endId, endKey }) =>
          window.select(
            { rowKey: id, columnKey: key },
            { rowKey: endId, columnKey: endKey }
          ),
        { id, key, endId, endKey }
      );
      await page.waitForTimeout(35);
    };
    const reset = async () => {
      await page.getByRole("button", { name: "重置", exact: true }).click();
      await page.waitForTimeout(35);
    };
    const clip = async (type, text = "") =>
      page.locator("#sheet .sia-table").evaluate(
        (el, { type, text }) => {
          const d = new DataTransfer();
          if (type === "paste") d.setData("text/plain", text);
          el.dispatchEvent(
            new ClipboardEvent(type, {
              bubbles: true,
              cancelable: true,
              clipboardData: d,
            })
          );
          return d.getData("text/plain");
        },
        { type, text }
      );
    // 验证实际单元格几何边界、只读语义和普通编辑器隔离，避免只检查 CSS 文本。
    // 校验使用真实背景和无障碍属性，空值、条件不适用与修正历史分别覆盖。
    const header = page.locator('#sheet th[data-column-key="code"]');
    check('必填表头红色列名与前置星号', await header.locator('.sia-table__required-mark').innerText() === '*' && await header.locator('.sia-table__header-label-content').evaluate(el=>getComputedStyle(el).color) === 'rgb(255, 77, 79)');
    check('普通表头无星号', await page.locator('#sheet th[data-column-key="name"] .sia-table__required-mark').count() === 0);
    const invalidVisual = await cell(2, 'code').evaluate(el=>({image:getComputedStyle(el).backgroundImage,line:getComputedStyle(el,'::before').height,left:getComputedStyle(el,'::before').left,right:getComputedStyle(el,'::before').right,height:el.getBoundingClientRect().height}));
    check('空必填格无叉号且显示淡红斜纹与3像素底线', await cell(2,'code').getAttribute('aria-invalid') === 'true' && await cell(2,'code').locator('svg').count() === 0 && invalidVisual.image.includes('repeating-linear-gradient') && invalidVisual.line === '3px' && invalidVisual.left === '0px' && invalidVisual.right === '0px');
    check('不适用只读属性不标错', await cell(3,'size').getAttribute('aria-invalid') === null && await cell(3,'size').evaluate(el=>getComputedStyle(el).backgroundImage) === 'none');
    await cell(2,'code').hover(); await cell(2,'code').click();
    check('选中悬停仍保留斜纹且不增加行高', await cell(2,'code').evaluate(el=>getComputedStyle(el).backgroundImage) === invalidVisual.image && (await cell(2,'code').boundingBox()).height === invalidVisual.height);
    check('固定只读列错误保留定位及斜纹', await cell(4,'style').evaluate(el=>getComputedStyle(el).position) === 'sticky' && await cell(4,'style').getAttribute('aria-invalid') === 'true' && (await cell(4,'style').evaluate(el=>getComputedStyle(el).backgroundImage)).includes('repeating-linear-gradient'));
    await page.screenshot({path:path.join(out,'worksheet-validation.png')});
    const headerBox = await header.boundingBox(), finalRowBox = await cell(4,'code').boundingBox();
    await page.screenshot({path:path.join(out,'worksheet-validation-detail.png'),clip:{x:headerBox.x,y:headerBox.y,width:headerBox.width,height:finalRowBox.y+finalRowBox.height-headerBox.y}});
    await cell(2,'code').dblclick(); check('错误格编辑不撑高且保留全格定位', (await cell(2,'code').boundingBox()).height === invalidVisual.height && await cell(2,'code').locator('.sia-table__cell-content').evaluate(el=>getComputedStyle(el).position) === 'absolute'); check('红底线在编辑器上方且不截获点击', await cell(2,'code').evaluate(el=>getComputedStyle(el,'::before').pointerEvents === 'none' && Number(getComputedStyle(el,'::before').zIndex) > Number(getComputedStyle(el.querySelector('.sia-table__cell-content')).zIndex)));
    await page.screenshot({path:path.join(out,'worksheet-validation-edit.png'),clip:{x:headerBox.x,y:headerBox.y,width:headerBox.width,height:finalRowBox.y+finalRowBox.height-headerBox.y}});
    await cell(2,'code').getByRole('textbox').fill('FIXED'); await cell(2,'code').getByRole('textbox').press('Enter');
    check('填写后校验标记立即消失', await cell(2,'code').getAttribute('aria-invalid') === null);
    await api('undo'); check('撤销恢复空值错误', await cell(2,'code').getAttribute('aria-invalid') === 'true');
    await api('redo'); check('恢复填写后移除错误', await cell(2,'code').getAttribute('aria-invalid') === null);
    await api('editCell',{rowKey:2,columnKey:'price'},0);
    check('金额0不被当成缺失', await cell(2,'price').getAttribute('aria-invalid') === null);
    await reset();
    await cell(1, "code").click();
    const cornerHandle = page.locator('#sheet .sia-table__worksheet-handle');
    const hb = await cornerHandle.boundingBox(), cb = await cell(1, 'code').boundingBox();
    check('填充柄放大至12像素并贴右下角', hb.width === 12 && hb.height === 12 && Math.abs(hb.x + hb.width - cb.x - cb.width) <= 1.5 && Math.abs(hb.y + hb.height - cb.y - cb.height) <= 1.5);
    check('工作表无铅笔且普通编辑器保留', await page.locator('#sheet .sia-table__editable-display > .sia-icon').count() === 0 && await page.locator('#plain .sia-table__editable-display > .sia-icon').count() > 0);
    const bg = el => getComputedStyle(el).backgroundColor;
    const readonlyBg = await cell(1, 'style').evaluate(bg);
    check('只读列和条件只读格显示相同灰底', readonlyBg === await cell(3, 'size').evaluate(bg) && readonlyBg !== await cell(2, 'code').evaluate(bg));
    await cell(1, 'style').hover();
    await cell(1, 'style').click();
    check('悬停选择不覆盖只读灰底', readonlyBg === await cell(1, 'style').evaluate(bg));
    const errorStyle = await page.locator('#sheet [data-testid="cell-error"] .sia-icon').first().evaluate(el => ({color:getComputedStyle(el).color,opacity:getComputedStyle(el).opacity,parent:getComputedStyle(el.parentElement).color}));
    check('业务错误图标保留颜色且常驻可见', errorStyle.color === errorStyle.parent && errorStyle.opacity === '1');
    check('普通表格不受只读灰底影响', await page.locator('#plain .sia-table__worksheet-cell--readonly').count() === 0);
    // 填充柄只表达可编辑能力；只读格仍能选中、复制和接收错误定位。
    await cell(1, 'style').click();
    check('只读单元格选中不显示填充柄且仍可复制', await cornerHandle.count() === 0 && await clip('copy') === '款式一');
    await cell(3, 'size').click();
    check('条件不可编辑单元格不显示填充柄', await cornerHandle.count() === 0);
    await select(1, 'code', 3, 'size');
    check('混合选区右下角只读时不显示填充柄', await cornerHandle.count() === 0);
    await cell(1, 'code').click();
    check('切回可编辑单元格恢复填充柄', await cornerHandle.count() === 1);
    await page.evaluate(() => window.setReadonly(true));
    await page.waitForFunction(() => !document.querySelector('#sheet .sia-table__worksheet-handle'));
    check('已有选区动态锁定后填充柄消失', await cornerHandle.count() === 0);
    await page.screenshot({path:path.join(out,'worksheet-readonly-no-handle.png')});
    await page.evaluate(() => window.setReadonly(false));
    await cornerHandle.waitFor();
    check('解除锁定恢复可编辑选区填充柄', await cornerHandle.count() === 1);
    await cell(1, 'code').click();
    await page.screenshot({path:path.join(out,'worksheet-appearance.png')});
    await page
      .getByRole("button", { name: "拖拽填充；双击自动填充下方连续空单元格" })
      .dblclick();
    check(
      "双击填充连续空格并保留终点",
      (await data())[2].code === "SKU001" && (await data())[3].code === "终点"
    );
    await page.getByRole("button", { name: "撤销", exact: true }).click();
    check("一次撤销整个填充", (await data())[1].code === "");
    await page.getByRole("button", { name: "恢复", exact: true }).click();
    check("一次恢复整个填充", (await data())[2].code === "SKU001");
    await reset();
    await select(1, "code", 1, "name");
    const copied = await clip("copy");
    check("矩形选区复制TSV", copied === "SKU001\t商品一");
    await select(2, "code");
    await clip("paste", copied);
    await page.waitForTimeout(50);
    check("内部矩阵粘贴", (await data())[1].name === "商品一");
    await select(2, "style", 3, "name");
    await clip("paste", "X");
    await page.waitForTimeout(50);
    check(
      "单值铺满选区且跳过只读列",
      (await data())[2].code === "X" && (await data())[1].style === "款式一"
    );
    await reset();
    await select(2, "code");
    await clip(
      "paste",
      '0002\t"多\n行"\t非法尺码\t25\n0003\t名称3\tM\t非法数字\n'
    );
    await page.waitForTimeout(50);
    let rows = await data();
    check(
      "外部TSV保留编号和单元格换行",
      rows[1].code === "0002" && rows[1].name === "多\n行"
    );
    check(
      "不兼容列不压缩位置且非法数字跳过",
      rows[1].price === 25 && rows[1].size === "" && rows[2].price === null
    );
    await api("undo");
    check("整块粘贴一次撤销", (await data())[1].code === "");
    await reset();
    await select(1, "size");
    const size = await clip("copy");
    await select(2, "size", 3, "size");
    await clip("paste", size);
    await page.waitForTimeout(50);
    check(
      "下拉复制保留枚举且禁用行跳过",
      (await data())[1].size === "M" && (await data())[2].size === ""
    );
    await select(2, "price");
    await clip("paste", size);
    await page.waitForTimeout(50);
    check("不同控件类型禁止内部粘贴", (await data())[1].price === null);
    await reset();
    const beforeEditBox = await cell(1, "code").boundingBox();
    await cell(1, "code").dblclick();
    const editorContent = cell(1, "code").locator('.sia-table__cell-content');
    const afterEditBox = await cell(1, "code").boundingBox();
    check('编辑态保留全格定位且不撑高行', await editorContent.evaluate(el=>getComputedStyle(el).position) === 'absolute' && beforeEditBox.height === afterEditBox.height);
    await cell(1, "code").getByRole("textbox").fill("EDIT001");
    await cell(1, "code").getByRole("textbox").press("Enter");
    await page.waitForTimeout(50);
    check("普通编辑进入统一历史", (await data())[0].code === "EDIT001");
    await cell(1, "code").click();
    await page.keyboard.press("Control+z");
    await page.waitForTimeout(50);
    check("快捷键撤销普通编辑", (await data())[0].code === "SKU001");
    await page.keyboard.press("Control+Shift+z");
    await page.waitForTimeout(50);
    check("快捷键恢复普通编辑", (await data())[0].code === "EDIT001");
    await api("undo");
    await api("editCell", { rowKey: 2, columnKey: "code" }, "NEW");
    check("新编辑清空恢复栈", !(await api("getHistory")).canRedo);
    check(
      "API禁止写只读列",
      !(await api("editCell", { rowKey: 1, columnKey: "style" }, "坏值"))
    );
    await reset();
    await cell(1, "code").click();
    let handle = await page
        .getByRole("button", { name: "拖拽填充；双击自动填充下方连续空单元格" })
        .boundingBox(),
      target = await cell(3, "code").boundingBox();
    await page.keyboard.down("Control");
    await page.mouse.move(
      handle.x + handle.width / 2,
      handle.y + handle.height / 2
    );
    await page.mouse.down();
    await page.mouse.move(target.x + 50, target.y + 10, { steps: 8 });
    await page.mouse.up();
    await page.keyboard.up("Control");
    await page.waitForTimeout(70);
    rows = await data();
    check(
      "Ctrl拖拽递增保留前导零",
      rows[1].code === "SKU002" && rows[2].code === "SKU003"
    );
    await select(3, "code");
    await api("fillTo", 1, true);
    check("向上递增填充使用负行距", (await data())[0].code === "SKU001");
    await reset();
    await cell(1, "code").click();
    handle = await page
      .getByRole("button", { name: "拖拽填充；双击自动填充下方连续空单元格" })
      .boundingBox();
    target = await cell(3, "code").boundingBox();
    await page.mouse.move(handle.x + 4, handle.y + 4);
    await page.mouse.down();
    await page.mouse.move(target.x + 50, target.y + 10, { steps: 5 });
    await page.keyboard.press("Escape");
    await page.mouse.up();
    check("Escape取消填充不改数据", (await data())[1].code === "");
    await page.getByRole("button", { name: "复制行", exact: true }).click();
    check("行操作进入历史", (await data()).length === 5);
    await api("undo");
    check("撤销行复制", (await data()).length === 4);
    await api("redo");
    check("恢复行复制", (await data()).length === 5);
    await reset();
    check(
      "重新导入清空旧历史",
      !(await api("getHistory")).canUndo && !(await api("getHistory")).canRedo
    );
    await page.evaluate(() => (window.reject = true));
    check(
      "业务拒绝不产生变更",
      !(await api("editCell", { rowKey: 1, columnKey: "code" }, "拒绝"))
    );
    await page.evaluate(() => (window.reject = false));
    check("业务拒绝不进入历史", !(await api("getHistory")).canUndo);
    await page.evaluate(() => (window.fail = true));
    await api("editCell", { rowKey: 1, columnKey: "code" }, "异常");
    await page.evaluate(() => (window.fail = false));
    check(
      "业务抛错保持数据并回调",
      (await data())[0].code === "SKU001" &&
        (await page.evaluate(() => window.handledError === "reject"))
    );
    check(
      "普通表格无工作表工具栏及填充柄",
      (await page.locator("#plain .sia-table__worksheet-handle").count()) ===
        0 &&
        (await page
          .locator("#plain")
          .getByRole("button", { name: "撤销", exact: true })
          .count()) === 0
    );
    await api("editCell", { rowKey: 1, columnKey: "code" }, "未撤销");
    await page.getByRole("textbox", { name: "表格外输入" }).focus();
    await page.keyboard.press("Control+z");
    check("表格外快捷键不改变工作表", (await data())[0].code === "未撤销");
    await page.screenshot({ path: path.join(out, "worksheet.png") });
    await page.getByRole("button", { name: "500行", exact: true }).click();
    // 缩窄并滚动实际表格，校验层必须被限制在单元格内，不能穿过固定列与吸顶表头。
    await page.setViewportSize({width:600,height:850});
    await page.locator('#sheet .sia-table__viewport').evaluate(el=>{el.scrollLeft=100;el.scrollTop=200;});
    await page.waitForTimeout(120);
    check('滚动错误格建立局部层叠上下文', await page.locator('#sheet td[aria-invalid="true"]').first().evaluate(el=>getComputedStyle(el).isolation) === 'isolate');
    await page.screenshot({path:path.join(out,'worksheet-validation-scroll.png')});
    await page.locator('#sheet .sia-table__viewport').evaluate(el=>{el.scrollLeft=0;el.scrollTop=0;});
    await page.setViewportSize({width:1100,height:850});
    await page.waitForTimeout(80);

    await page.waitForTimeout(150);
    await select(1, "code");
    await api("fillTo", 500, true);
    rows = await data();
    check("500行虚拟表格完整填充", rows[499].code === "R500");
    await api("undo");
    check("500行填充一次撤销", (await data())[499].code === "");
    // 真实拖动进入滚动边缘，验证虚拟行出现后仍能定位填充终点。
    await cell(1, "code").click();
    handle = await page
      .getByRole("button", { name: "拖拽填充；双击自动填充下方连续空单元格" })
      .boundingBox();
    const viewport = await page
      .locator("#sheet .sia-table__viewport")
      .boundingBox();
    await page.mouse.move(handle.x + 4, handle.y + 4);
    await page.mouse.down();
    await page.mouse.move(handle.x - 30, viewport.y + viewport.height - 15, {
      steps: 8,
    });
    await page.waitForTimeout(700);
    await page.mouse.up();
    await page.waitForTimeout(80);
    check(
      "填充柄边缘滚动跨越虚拟行",
      (await data()).filter((row) => row.code === "R001").length > 12
    );

    await reset();
    await select(1, "code");
    await api("editCell", { rowKey: 2, columnKey: "code" }, "B");
    await select(1, "code", 2, "code");
    await api("fillTo", 4);
    rows = await data();
    check("多行源循环填充", rows[2].code === "SKU001" && rows[3].code === "B");
    await reset();
    await select(4, "code", 4, "price");
    await clip("paste", "尾行\t名称\t忽略\t50\n不新增\t不新增");
    await page.waitForTimeout(50);
    check(
      "粘贴越界截断不增加行",
      (await data()).length === 4 && (await data())[3].price === 50
    );
    await reset();
    for (let i = 0; i < 6; i++)
      await api("editCell", { rowKey: 1, columnKey: "code" }, "H" + i);
    for (let i = 0; i < 4; i++) await api("undo");
    check(
      "历史上限按整次操作计数",
      (await data())[0].code === "H1" && !(await api("getHistory")).canUndo
    );
    await reset();
    await api("editCell", { rowKey: 1, columnKey: "code" }, "Y");
    await cell(1, "code").click();
    await page.keyboard.press("Control+z");
    await page.keyboard.press("Control+y");
    await page.waitForTimeout(50);
    check("CtrlY恢复快捷键", (await data())[0].code === "Y");
    await cell(1, "code").dblclick();
    await cell(1, "code").getByRole("textbox").fill("编辑草稿");
    await cell(1, "code").getByRole("textbox").press("Escape");
    check("Esc取消单格编辑不进历史", (await data())[0].code === "Y");
    await select(2, "code");
    await page.locator("#sheet .sia-table").evaluate((el) =>
      el.dispatchEvent(
        new ClipboardEvent("paste", {
          bubbles: true,
          cancelable: true,
          clipboardData: new DataTransfer(),
        })
      )
    );
    check("无文本剪贴板不清空选区数据", (await data())[1].code === "");
    await reset();
    await cell(1, "code").click();
    handle = await page
      .getByRole("button", { name: "拖拽填充；双击自动填充下方连续空单元格" })
      .boundingBox();
    target = await cell(3, "code").boundingBox();
    await page.mouse.move(handle.x + 4, handle.y + 4);
    await page.mouse.down();
    await page.mouse.move(target.x + 20, target.y + 10, { steps: 5 });
    await page.evaluate(() =>
      window.dispatchEvent(new PointerEvent("pointercancel"))
    );
    await page.mouse.up();
    check("指针取消不提交填充", (await data())[1].code === "");
    // 直接替换数据模拟文件重新导入，不能依靠点击按钮触发 blur 提前提交旧草稿。
    await cell(1, "code").dblclick();
    await cell(1, "code").getByRole("textbox").fill("旧文件草稿");
    await page.evaluate(() => window.resetData());
    await page.waitForTimeout(60);
    check(
      "换入同行键同值的新文件立即取消旧编辑",
      (await cell(1, "code").getByRole("textbox").count()) === 0
    );
    await page.keyboard.press("Enter");
    check(
      "旧草稿不能串写新文件",
      (await data())[0].code === "SKU001" && !(await api("getHistory")).canUndo
    );
    await cell(1, "code").dblclick();
    await cell(1, "code").getByRole("textbox").fill("新文件编辑");
    await cell(1, "code").getByRole("textbox").press("Enter");
    await page.waitForTimeout(50);
    check(
      "换文件后可重新编辑并撤销",
      (await data())[0].code === "新文件编辑" &&
        (await api("undo")) &&
        (await data())[0].code === "SKU001"
    );
    // 用系统剪贴板和真实快捷键补充 ClipboardEvent 矩阵注入的覆盖范围。
    await page
      .context()
      .grantPermissions(["clipboard-read", "clipboard-write"], {
        origin: new URL(page.url()).origin,
      });
    await cell(1, "code").click();
    await page.keyboard.press("Control+c");
    check(
      "系统剪贴板收到真实复制快捷键内容",
      (await page.evaluate(() => navigator.clipboard.readText())) === "SKU001"
    );
    await cell(2, "code").click();
    await page.keyboard.press("Control+v");
    await page.waitForTimeout(80);
    check("真实粘贴快捷键写入目标单元格", (await data())[1].code === "SKU001");
    await page.getByRole("button", { name: "嵌套示例", exact: true }).click();
    await page.locator("#nested-sheet td").first().waitFor();
    await page.evaluate(() => window.prepareNested());
    await page.waitForTimeout(40);
    const nestedPaste = async (selector) => {
      await page.locator(selector + " .sia-table").evaluate((el) => {
        const d = new DataTransfer();
        d.setData("text/plain", "嵌套粘贴");
        el.dispatchEvent(
          new ClipboardEvent("paste", {
            bubbles: true,
            cancelable: true,
            clipboardData: d,
          })
        );
      });
      await page.waitForTimeout(50);
    };
    await nestedPaste("#nested-plain");
    check(
      "内嵌普通表格粘贴不污染外层工作表",
      await page.evaluate(
        () =>
          window.nestedRows[0].code === "外层" &&
          window.innerRows[0].code === "内层"
      )
    );
    await nestedPaste("#nested-sheet");
    check(
      "内嵌工作表独立接收粘贴",
      await page.evaluate(
        () =>
          window.nestedRows[0].code === "外层" &&
          window.innerRows[0].code === "嵌套粘贴"
      )
    );
    await page.locator("#nested-sheet .sia-table").evaluate((el) =>
      el.dispatchEvent(
        new KeyboardEvent("keydown", {
          bubbles: true,
          cancelable: true,
          key: "z",
          ctrlKey: true,
        })
      )
    );
    await page.waitForTimeout(50);
    check(
      "内嵌工作表撤销仅作用于自身",
      await page.evaluate(
        () =>
          window.nestedRows[0].code === "外层" &&
          window.innerRows[0].code === "内层"
      )
    );
    check("无页面运行时异常", errors.length === 0);
    fs.writeFileSync(
      path.join(out, "report.json"),
      JSON.stringify({ checks, errors }, null, 2)
    );
  } catch (error) {
    if (page) await page.screenshot({ path: path.join(out, "failure.png") });
    throw error;
  } finally {
    await browser.close();
    await new Promise((resolve) => server.close(resolve));
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
