import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Radio } from '../../packages/react/src/components/Radio';
import '../../packages/react/src/styles.css';
import '../../packages/react/src/components-extra.css';

// 普通与实心单选共享受控值，验证外部更新、键盘导航和不同宽度下背景的位置。
function Fixture() {
  const [value,setValue]=useState('每月');
  return <div style={{padding:60}}>
    <Radio.Group value={value} onChange={v=>setValue(String(v))} options={['每天','每周较长选项','每月']} />
    <div style={{height:30}} />
    <Radio.Group className="solid" value={value} onChange={v=>setValue(String(v))} optionType="button" buttonStyle="solid" options={['每天','每周较长选项','每月',{value:'disabled',label:'禁用',disabled:true}]} />
    <output>{value}</output>
    <Radio.Group className="children" buttonStyle="solid" defaultValue="a"><Radio.Button value="a">选项 A</Radio.Button><Radio.Button value="b">选项 B</Radio.Button></Radio.Group>
    <Radio.Group className="outline" optionType="button" options={['描边 A','描边 B']} />
  </div>;
}
createRoot(document.getElementById('root')!).render(<Fixture />);
