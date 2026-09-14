import {useState} from 'react';
import {Button,VennChart} from '@sia.soul/sia-react-ui';
import type {VennChartProps} from '@sia.soul/sia-react-ui';
export const vennReferenceFixture:VennChartProps={title:'访问 vs 咨询',description:'各个数据的集合',sets:[{name:'访问',value:100},{name:'咨询',value:50}],intersection:{name:'公共',value:20},appearance:'macarons',emphasisColor:'#cc99cc',emphasisBorderColor:'#996699',emphasisBorderWidth:3};
export function VennReferencePreview(){
 const [replay,setReplay]=useState(0);
 return <><div className="chart-parity__controls"><Button onClick={()=>setReplay(n=>n+1)}>重播入场动画</Button><span>两个集合与公共交集可分别悬停；数据视图支持修改数值。</span></div>
 <div className="chart-parity__viewport"><VennChart key={replay} {...vennReferenceFixture} palette={['#2ec7c9','#b6a2de','#5ab1ef']} width={663} height={379} viewBoxSize={[663,379]} toolbox={{features:['mark','dataView','restore','saveAsImage']}}/></div>
 <p className="chart-parity__status">待验收与差异：原站求交集距离的误差容限、边框和提示布局、入场及更新动画尚未完成一致性验收。</p></>;
}
