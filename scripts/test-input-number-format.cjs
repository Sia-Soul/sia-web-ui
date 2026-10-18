// 执行数字输入真实事件，覆盖格式化、解析、边界、精度、步进与空值。
const fs = require('node:fs'), vm = require('node:vm'), ts = require('typescript'), assert = require('node:assert/strict');
function setup(props) {
 const slots=[], effects=[]; let cursor=0; const changes=[];
 const state=v=>{const i=cursor++; if(!(i in slots))slots[i]=typeof v==='function'?v():v; return[slots[i],n=>slots[i]=typeof n==='function'?n(slots[i]):n];};
 const jsx=(type,props)=>({type,props});
 const exports={};
 vm.runInNewContext(ts.transpileModule(fs.readFileSync('packages/react/src/components/InputNumber.tsx','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2020}}).outputText,{exports,require(name){
  if(name==='react/jsx-runtime')return{jsx,jsxs:jsx};
  if(name==='react')return{forwardRef:f=>f,useState:state,useRef:v=>{const i=cursor++; return slots[i]??={current:v};},useId:()=> 'number',useEffect:f=>{cursor++;}};
  if(name==='./shared')return{useControlSize:()=> 'medium',usePlaceholderMode:()=> 'default',useControllableState:({value,defaultValue,onChange})=>{const[v,set]=state(value??defaultValue);return[v,n=>{set(n);onChange?.(n);}];}};
  if(name==='./titleTooltip')return{withTitleTooltip:v=>v};return{};
 }});
 const render=()=>{cursor=0;return exports.InputNumber({...props,onChange:v=>changes.push(v)},null);};
 const find=(tree,type)=>{if(!tree)return; if(Array.isArray(tree)){for(const n of tree){const r=find(n,type);if(r)return r;}} else if(typeof tree==='object'){if(tree.type===type)return tree;return find(tree.props.children,type);}};
 return{changes,input:()=>find(render(),'input'),enter(text){this.input().props.onChange({target:{value:text}});this.input().props.onKeyDown({key:'Enter'});},step(key='ArrowUp'){this.input().props.onKeyDown({key,preventDefault(){}});}};
}
const h=setup({defaultValue:1234.5,precision:2,formatter:v=>v.replace(/\B(?=(\d{3})+(?!\d))/g,','),parser:s=>s.replace(/,/g,'')});
assert.equal(h.input().props.value,'1,234.50'); h.enter('2,345.67');assert.equal(h.changes.at(-1),2345.67);assert.equal(h.input().props.value,'2,345.67');h.step();assert.equal(h.changes.at(-1),2346.67);
h.enter('');assert.equal(h.changes.at(-1),null);assert.equal(h.input().props.value,'');h.enter('0');assert.equal(h.changes.at(-1),0);
h.enter('oops');assert.equal(h.input().props.value,'0.00');assert.equal(h.changes.at(-1),0);
const p=setup({defaultValue:3,parser:s=>Number(s)/100,formatter:v=>`${Number(v)*100}%`});p.step();assert.equal(p.changes.at(-1),4,'步进不再次解析单位');p.enter('500');assert.equal(p.changes.at(-1),5);
const r=setup({defaultValue:2,min:0,max:10,precision:1,parser:s=>{if(s==='bad')throw Error();return s;}});r.enter('12.34');assert.equal(r.changes.at(-1),10);r.enter('-2');assert.equal(r.changes.at(-1),0);r.enter('bad');assert.equal(r.input().props.value,'0.0');
const d=setup({defaultValue:2,disabled:true});d.step();assert.equal(d.changes.length,0);
console.log('PASS InputNumber 格式化、解析、空值、零值、异常回退、精度、边界与步进');
