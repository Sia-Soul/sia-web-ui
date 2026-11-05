import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { ChooseBox } from '../../packages/react/src/components/ChooseBox';
import { createBrowserChooseBoxSource } from '../../packages/react/src/components/chooseBoxSource';
import type { ChooseBoxEntry, ChooseBoxSource } from '../../packages/react/src/components/chooseBoxSource';
import '../../packages/react/src/styles.css';
import '../../packages/react/src/components-extra.css';

// 可控异步目录用于覆盖权限失败、空文件夹和关闭后返回的请求。
const dir = (id: string): ChooseBoxEntry => ({id,name:id,path:`/${id}`,kind:'directory'});
const file = (id: string): ChooseBoxEntry => ({id,name:id,path:`/${id}`,kind:'file'});
const source: ChooseBoxSource = {
  getRoots: async () => [dir('资料'),dir('空目录'),dir('失败目录'),dir('慢目录')],
  readDirectory: async directory => {
    if(directory.id==='失败目录') throw Error('无权访问目录');
    if(directory.id==='慢目录') await new Promise(resolve=>setTimeout(resolve,400));
    return directory.id==='资料' ? [dir('子目录'),file('说明.txt'),file('图片.png')] : directory.id==='子目录' ? [file('子文件.txt')] : [];
  },
};
const browserSource = createBrowserChooseBoxSource();
function Fixture(){
  const [values,setValues]=useState<Record<string,readonly ChooseBoxEntry[]>>({});
  return <div style={{padding:24,display:'grid',gap:12}}>
    {(['file','directory'] as const).flatMap(kind=>[false,true].map(multiple=>{
      const key=`${kind}-${multiple}`;
      return <div key={key} id={key}><ChooseBox source={source} kind={kind} multiple={multiple} title={key} placeholder={key}
        value={values[key]??[]} onChange={entries=>setValues(previous=>({...previous,[key]:entries}))} />
        <output>{JSON.stringify((values[key]??[]).map(entry=>entry.id))}</output></div>;
    }))}
    <ChooseBox source={browserSource} kind="directory" multiple placeholder="浏览器授权" />
    <ChooseBox source={source} accept=".txt" placeholder="过滤文件" />
    <ChooseBox source={source} disabled placeholder="禁用选择" />
    {/* 长路径与全部尺寸用于检查省略、尾部图标及清空按钮的几何布局。 */}
    {(['small','medium','large'] as const).map(size=><div key={size} id={`long-${size}`}><ChooseBox source={source} size={size} multiple
      defaultValue={[file('很长的目录路径/'.repeat(16)+'说明.txt'),file('另一个目录/图片.png')]} /></div>)}
  </div>;
}
createRoot(document.getElementById('root')!).render(<Fixture/>);
