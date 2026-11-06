// 年份面板使用真实 Edge 验证公开属性，不涉及业务数据。
const fs=require('fs'),assert=require('assert/strict');
const {chromium}=require(process.env.USERPROFILE+'/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
(async()=>{const b=await chromium.launch({channel:'msedge',headless:false});const p=await b.newPage({viewport:{width:1100,height:800}});const checks=[];
const check=(name,ok)=>{assert(ok,name);checks.push(name)};
try{await p.goto('http://127.0.0.1:4173/components/date-picker');
await p.evaluate(async()=>{const {default:R}=await import('/node_modules/.vite/deps/react.js');const {default:{createRoot}}=await import('/node_modules/.vite/deps/react-dom_client.js');const {DatePicker}=await import('/@fs/C:/Users/12235/Documents/SiaWebUI/packages/react/src/components/DatePicker.tsx');document.body.innerHTML='<div id="test" style="padding:32px"></div>';window.changes=[];createRoot(document.getElementById('test')).render(R.createElement('div',null,...[
{placeholder:'年份',picker:'year',defaultValue:'2026'},
{placeholder:'限制年份',picker:'year',defaultValue:'2026',minDate:'2025-06-01',maxDate:'2027-04-01'},
{placeholder:'多选年份',picker:'year',multiple:true,needConfirm:true},
{placeholder:'普通日期',defaultValue:'2026-11-06'}
].map(props=>R.createElement(DatePicker,{...props,onChange:v=>window.changes.push([props.placeholder,v])}))));});
await p.getByRole('button',{name:'年份',exact:true}).click();
check('年份面板显示十个年份',await p.locator('.sia-date-panel__years button').count()===10);
check('不显示日期网格',await p.locator('.sia-date-panel__days').count()===0);
check('当前年份选中',await p.getByRole('button',{name:'2026年',exact:true}).getAttribute('aria-pressed')==='true');
await p.screenshot({path:'logs/year-picker-wide.png'});
await p.getByRole('button',{name:'下十年'}).click();check('向后翻十年',await p.getByRole('button',{name:'2036年',exact:true}).isVisible());
await p.getByRole('button',{name:'上十年'}).click();await p.getByRole('button',{name:'2025年',exact:true}).click();
check('选择回传四位年份',await p.evaluate(()=>changes.at(-1)[1])==='2025');
await p.getByRole('button',{name:'年份',exact:true}).hover();await p.getByRole('button',{name:'清除日期'}).first().click();check('清空回传空串',await p.evaluate(()=>changes.at(-1)[1])==='');
await p.getByRole('button',{name:'限制年份',exact:true}).click();check('边界年可选',await p.getByRole('button',{name:'2025年',exact:true}).isEnabled()&&await p.getByRole('button',{name:'2027年',exact:true}).isEnabled());check('范围外年份禁用',await p.getByRole('button',{name:'2024年',exact:true}).isDisabled()&&await p.getByRole('button',{name:'2028年',exact:true}).isDisabled());
await p.keyboard.press('Escape');await p.getByRole('button',{name:'多选年份',exact:true}).click();await p.getByRole('button',{name:'2025年',exact:true}).click();await p.getByRole('button',{name:'2026年',exact:true}).click();check('多选确认前不提交',await p.evaluate(()=>!changes.some(x=>x[0]==='多选年份')));await p.getByRole('button',{name:'确定',exact:true}).click();check('确认提交年份数组',await p.evaluate(()=>JSON.stringify(changes.at(-1)[1]))==='["2025","2026"]');
await p.getByRole('button',{name:'普通日期',exact:true}).click();check('普通日期保留日历',await p.locator('.sia-date-panel__days button').count()===42);await p.keyboard.press('Escape');
await p.setViewportSize({width:700,height:600});await p.getByRole('button',{name:'年份',exact:true}).click();await p.screenshot({path:'logs/year-picker-narrow.png'});check('窄屏面板完整',await p.locator('.sia-date-panel').evaluate(e=>e.getBoundingClientRect().right<=innerWidth));
console.log(JSON.stringify(checks));fs.writeFileSync('logs/year-picker-checks.json',JSON.stringify(checks,null,2));
}finally{await b.close()}})().catch(e=>{console.error(e);process.exitCode=1});