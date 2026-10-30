import {createRoot} from 'react-dom/client';
import {InputSelect} from '../../packages/react/src/components/InputSelect';
import {Select} from '../../packages/react/src/components/Select';
import {SelectionPanel} from '../../packages/react/src/components/SelectionPanel';
import '../../packages/react/src/styles.css';
import '../../packages/react/src/components-extra.css';
// 从公开选择组件验证深浅主题的选中与悬停，而不是直接拼装内部样式类。
document.body.style.color='var(--sia-color-text)';document.body.style.background='var(--sia-color-background)';
const options=[{value:'a',label:'已选项目'},{value:'b',label:'普通项目'},{value:'c',label:'禁用项目',disabled:true}];
createRoot(document.getElementById('root')!).render(<div style={{padding:40}}><Select options={options} defaultValue="a"/><div id="input-select-theme" style={{marginTop:16,width:260}}><InputSelect options={options} defaultValue="a" /></div><div style={{marginTop:360,width:260}}><SelectionPanel options={options} value={['a']} onChange={()=>{}} /></div></div>);