import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';
import { InputSelect } from '../../packages/react/src/components/InputSelect';
import type { InputSelectProps } from '../../packages/react/src/components/InputSelect';
import { Form } from '../../packages/react/src/components/Form';
import '../../packages/react/src/styles.css';
import '../../packages/react/src/components-extra.css';

const options=[{value:'order',label:'订单'},{value:'return',label:'采购退货'}];
// 通过公开属性和 Form 绑定覆盖空值、零值、自定义内容与显式空值选项。
function Fixture(){
 const [config,setConfig]=useState<Partial<InputSelectProps>>({value:''});
 Object.assign(window,{configure:(next:Partial<InputSelectProps>)=>flushSync(()=>setConfig(next))});
 return <div style={{padding:40}}>
  <InputSelect options={options} enableModal aria-label="待测输入选择" {...config} onChange={value=>setConfig(current=>({...current,value:value??null}))}/>
  <Form><Form.Item name="empty"><InputSelect options={options} aria-label="表单空值"/></Form.Item></Form>
 </div>;
}
createRoot(document.getElementById('root')!).render(<Fixture/>);
