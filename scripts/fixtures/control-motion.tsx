import { Profiler, useState, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';
import { Checkbox } from '../../packages/react/src/components/Checkbox';
import { Radio } from '../../packages/react/src/components/Radio';
import { Segmented } from '../../packages/react/src/components/Navigation';
import { QueryForm } from '../../packages/react/src/components/QueryForm';
import { Input } from '../../packages/react/src/components/Input';
import '../../packages/react/src/styles.css';
import '../../packages/react/src/components-extra.css';

// 查询区域下放置大量普通行，检查布局过渡下的实际帧间隔与组件重渲染次数。
let renders=0;
const rows=Array.from({length:1200},(_,i)=><div key={i} style={{height:22,borderBottom:'1px solid #eee'}}>数据行 {i+1}</div>);
function Fixture(){
 renders++;(window as any).queryRenders=renders;
 const [collapsed,setCollapsed]=useState(false);
 const [checked,setChecked]=useState(false);
 const [value,setValue]=useState('a');
 const target=useRef<HTMLDivElement>(null);
 Object.assign(window,{toggleQuery:(v:boolean)=>flushSync(()=>setCollapsed(v))});
 return <div style={{width:960,padding:20}}>
  <Checkbox checked={checked} onChange={setChecked}>复选反馈</Checkbox>
  <Checkbox shape="circle" indeterminate>半选反馈</Checkbox>
  <Checkbox disabled>禁用复选</Checkbox>
  <Radio.Group value={value} onChange={v=>setValue(String(v))} options={[{value:'a',label:'单选 A'},{value:'b',label:'单选 B'}]} />
  <Radio.Group optionType="button" options={['按钮 A','按钮 B']} />
  <Segmented className="horizontal-test" options={['短','较长的选项名称','末项']} />
  <Segmented className="vertical-test" vertical options={['第一项','第二项','第三项']} />
  <Segmented className="zigzag-test" variant="zigzag" options={['左侧','右侧']} />
  <Segmented className="disabled-test" disabled options={['禁用 A','禁用 B']} />
  <div ref={target} className="query-test"><Profiler id="query" onRender={()=>{(window as any).queryCommits=((window as any).queryCommits??0)+1}}><QueryForm collapsed={collapsed} onCollapsedChange={setCollapsed} fieldWidth={190} fields={Array.from({length:12},(_,index)=>({key:String(index),name:String(index),children:<Input aria-label={`条件 ${index}`} />}))} onSearch={()=>{}} /></Profiler></div>
  <div className="heavy-list">{rows}</div>
 </div>;
}
createRoot(document.getElementById('root')!).render(<Fixture />);
