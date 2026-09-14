import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Button, Card } from "@sia.soul/sia-react-ui";
import { ChartReferencePreview, implementedChartReferenceIds } from "./ChartParityPanel";
import { chartReferenceExamples } from "./chartReferenceExamples";
import { chartCategories, chartCategoryForUrl } from "./chartCategories";

const exampleId = (url: string) => url.split("/").at(-1)!.replace(".html", "");
const implemented = new Set(implementedChartReferenceIds);
const entries = chartReferenceExamples.filter(entry=>implemented.has(exampleId(entry.url)));

function ExampleCard({entry}:{entry:typeof chartReferenceExamples[number]}) {
  const ref = useRef<HTMLElement>(null);
  const [visible,setVisible] = useState(false);
  const id = exampleId(entry.url);
  useEffect(()=>{
    const element=ref.current;
    if(!element)return;
    if(!("IntersectionObserver" in window)){setVisible(true);return;}
    const observer=new IntersectionObserver(records=>{
      if(records.some(record=>record.isIntersecting)){setVisible(true);observer.disconnect();}
    },{rootMargin:"200px"});
    observer.observe(element);
    return ()=>observer.disconnect();
  },[]);
  return <article ref={ref} id={`chart-example-${id}`} className="chart-reference-card" aria-label={`${id} 对应示例`}>
    <Card title={`${id} · ${entry.title}`} description={entry.description}>
      <div className="chart-reference-card__links"><span>开发中 · 未通过完整一致性验收</span><Link to={`/components/chart?reference=${encodeURIComponent(entry.url)}`} onClick={()=>window.scrollTo({top:0,behavior:"smooth"})}>单独查看</Link><a href={entry.url} target="_blank" rel="noreferrer">原站对照 ↗</a></div>
      {visible ? <ChartReferencePreview id={id} /> : <div className="chart-reference-card__placeholder"><Button onClick={()=>setVisible(true)}>加载 {id} 交互示例</Button></div>}
    </Card>
  </article>;
}

/** Every implemented reference has its own live card; the pending index is not a preview. */
export function ChartReferenceGallery({category}:{category?:string}) {
  const visibleEntries=entries.filter(entry=>!category||chartCategoryForUrl(entry.url)===category);
  const pending=chartReferenceExamples.filter(entry=>(!category||chartCategoryForUrl(entry.url)===category)&&!implemented.has(exampleId(entry.url)));
  return <section aria-label="原站对应示例列表" className="chart-reference-gallery">
    <div className="chart-catalog-heading"><div><h2>基础图形演示 · 原站对应示例</h2><p>{visibleEntries.length} 个对应示例逐项展示，均为自研实现、开发中；卡片滚动到附近时加载交互和动画，不再只放在下拉框里。</p></div></div>
    {!visibleEntries.length?<p>该分类的原站对应示例尚在接入，待实现清单见下方；不会用通用演示冒充对应实现。</p>:null}
    <nav className="chart-reference-index" aria-label="已接入示例快速定位">{visibleEntries.map(entry=><a key={entry.url} href={`#chart-example-${exampleId(entry.url)}`}>{exampleId(entry.url)} · {entry.title}</a>)}</nav>
    {chartCategories.filter(group=>(!category||group.id===category)&&visibleEntries.some(entry=>chartCategoryForUrl(entry.url)===group.id)).map(group=><section key={group.id} aria-label={group.title}>
      <h3>{group.title}</h3>
      <div className="chart-gallery chart-reference-gallery__cards">{visibleEntries.filter(entry=>chartCategoryForUrl(entry.url)===group.id).sort((a,b)=>exampleId(a.url).localeCompare(exampleId(b.url),undefined,{numeric:true})).map(entry=><ExampleCard key={entry.url} entry={entry} />)}</div>
    </section>)}
    <details className="chart-reference-pending"><summary>待实现入口 {pending.length} 个（目录记录，不计入已实现示例）</summary><ul>{pending.map(entry=><li key={entry.url}><Link to={`/components/chart?reference=${encodeURIComponent(entry.url)}`} onClick={()=>window.scrollTo({top:0,behavior:"smooth"})}>{entry.url.split("/").slice(-2).join("/")} · {entry.title}</Link><span>待实现</span></li>)}</ul></details>
  </section>;
}
