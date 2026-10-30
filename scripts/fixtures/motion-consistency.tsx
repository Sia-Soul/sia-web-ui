import { useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';
import { useOverlayMotion } from '../../packages/react/src/components/overlayMotion';
import { FloatButton } from '../../packages/react/src/components/FloatButton';
import { ImagePreview } from '../../packages/react/src/components/DataDisplay';
import { Spin, Tour } from '../../packages/react/src/components/Feedback';
import { Alert } from '../../packages/react/src/components/Alert';
import { FloatingPanel } from '../../packages/react/src/components/UtilityLayout';
import { Button } from '../../packages/react/src/components/Button';
import { Menu } from '../../packages/react/src/components/Navigation';
import '../../packages/react/src/styles.css';
import '../../packages/react/src/components-extra.css';

// 测试面板无回弹退场、普通提示逐帧对称性，并覆盖真实组件入口。
function Fixture() {
 const [open,setOpen]=useState(false);
 const [kind,setKind]=useState<Parameters<typeof useOverlayMotion>[2]>('popup');
 const [placement,setPlacement]=useState('bottom');
 const [real,setReal]=useState('');
 const ref=useRef<HTMLDivElement>(null);
 const motion=useOverlayMotion(open,ref,kind,placement);
 Object.assign(window,{
  configure:(nextKind:typeof kind,nextPlacement:string)=>flushSync(()=>{setKind(nextKind);setPlacement(nextPlacement)}),
  toggle:(value:boolean)=>flushSync(()=>setOpen(value)),
  real:(value:string)=>flushSync(()=>setReal(value)),
 });
 return <>
  {/* 非 StrictMode 验证首次挂载即可定位选中背景，首次切换有滑动。 */}
  <div id="initial-menu"><Menu defaultSelectedKeys={['a']} items={[{key:'a',label:'首项'},{key:'b',label:'次项'}]} /></div>
  {motion.present && <div ref={ref} id="surface" style={{width:200,height:100,background:'#1677ff'}}>动画表面</div>}
  {real==='float' && <FloatButton.Group open={open} trigger="click"><FloatButton description="操作" /></FloatButton.Group>}
  {real==='image' && <ImagePreview open={open} onOpenChange={setOpen} src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='80' height='80'%3E%3Crect width='80' height='80' fill='blue'/%3E%3C/svg%3E" />}
  {real==='spin' && <Spin spinning={open}>正文</Spin>}
  {real==='tour' && <Tour open={open} steps={[{title:'引导',description:'说明'}]} />}
  {real==='panel' && <FloatingPanel open={open} title="任务">任务进度</FloatingPanel>}
  {real==='alert' && <Alert closable message="提示" afterClose={()=>{(window as any).alertClosed=true}} />}
  {real==='title' && <Button title="自动提示内容">提示目标</Button>}
 </>;
}
createRoot(document.getElementById('root')!).render(<Fixture />);
