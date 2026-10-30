import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Select, type SelectChangeValue } from '../../packages/react/src/components/Select';
import '../../packages/react/src/styles.css';
import '../../packages/react/src/components-extra.css';

// 使用真实受控选择器验证打开后的直接输入及回填，不主动替组件聚焦搜索框。
function Fixture() {
  const [value, setValue] = useState<SelectChangeValue>([]);
  return <div style={{padding:40}}>
    <div id="auto-select" style={{width:600}}><Select style={{width:'100%'}} aria-label="自定义技术栈" mode="multiple" allowInput showSearch={false}
      options={[{label:'React',value:'React'},{label:'Vue',value:'Vue'}]}
      value={value} onChange={setValue} placeholder="选择或输入" /></div>
    <output id="value">{JSON.stringify(value)}</output>
    <Select aria-label="单选自定义" allowInput options={[{label:'React',value:'React'}]}
      searchPlaceholder="输入技术名称" />
    <div id="limited-select" style={{width:600}}><Select style={{width:'100%'}} mode="multiple" maxTagCount={1}
      options={[{label:'React',value:'React'},{label:'Vue',value:'Vue'}]} defaultValue={['React','Vue']} /></div>
    {/* 长标签应利用剩余空间，普通短标签保持内容宽度。 */}
    <div id="long-select" style={{width:600}}><Select style={{width:'100%'}} mode="multiple"
      options={['短标签','Svelte','Vue','阿萨德发生的发生的发生的发生的发生的发生的发生的发生'].map(value=>({value,label:value}))}
      defaultValue={['短标签','Svelte','Vue','阿萨德发生的发生的发生的发生的发生的发生的发生的发生']} /></div>
    {/* 外部操作放在浮层覆盖范围之外，模拟真实的点击离开。 */}
    <button id="outside" style={{position:'fixed',right:20,top:20}}>其他操作</button>
  </div>;
}
createRoot(document.getElementById('root')!).render(<Fixture />);
