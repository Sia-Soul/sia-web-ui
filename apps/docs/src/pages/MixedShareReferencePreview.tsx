import {useRef,useState} from 'react';
import {LineShareChart,serializeChartStack,saveCompositeImage} from '@sia.soul/sia-react-ui';
import snapshot from './chartMixedShareSource.json';
const source=snapshot[0]!;
const data=source.bindings.data.map((value,index)=>({name:source.option.xAxis[0]!.data[index+1]!,value}));
export function MixedShareReferencePreview(){
 const host=useRef<HTMLDivElement>(null),[error,setError]=useState('');
 return <><div ref={host} className="chart-parity__viewport chart-mixed-share"><LineShareChart data={data} title={source.option.title.text} description={source.option.title.subtext} titleAlign="center" width={900} height={450} viewBoxSize={[900,450]} toolbox={{features:['saveAsImage'],onSaveAsImage:()=>{if(host.current)saveCompositeImage(serializeChartStack(host.current),'mix12').catch(reason=>setError(String(reason)));}}}/></div>{error&&<p role="alert">{error}</p>}<p className="chart-parity__status">开发中：原始7日销量、偏移面积线、环形遮罩、悬停占比联动与更新过渡。已验证数据、鼠标/键盘联动、遮罩及导出。差异：动态命中尚未与原站逐项实测；固定画布、纵轴留白、标签位置、线点/标签切换和500ms线性过渡未通过原站完整视觉与动画一致性验收。</p></>;
}
