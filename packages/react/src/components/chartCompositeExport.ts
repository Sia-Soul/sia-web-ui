import {appendChartExportHeadings} from './chartExportHeadings';
/** Snapshot the actual SVG layers, preserving rendered styles and their placement. */
export function serializeChartComposite(host:HTMLElement):string|null{
 return serializeChartLayout(host,false);
}

/** Stacked chart panels retain their actual document positions and inter-panel gaps. */
export function serializeChartStack(host:HTMLElement):string|null{
 return serializeChartLayout(host,true);
}

function serializeChartLayout(host:HTMLElement,stack:boolean):string|null{
 const bounds=host.getBoundingClientRect();
 if(bounds.width<=0||bounds.height<=0)return null;
 const ns='http://www.w3.org/2000/svg';
 const root=document.createElementNS(ns,'svg');
 root.setAttribute('xmlns',ns);root.setAttribute('width',String(bounds.width));root.setAttribute('height',String(bounds.height));
 root.setAttribute('viewBox',`0 0 ${bounds.width} ${bounds.height}`);
 const background=document.createElementNS(ns,'rect');
 const hostBackground=getComputedStyle(host).backgroundColor;
 background.setAttribute('width','100%');background.setAttribute('height','100%');background.setAttribute('fill',hostBackground&&hostBackground!=='transparent'&&hostBackground!=='rgba(0, 0, 0, 0)'?hostBackground:'#fff');root.appendChild(background);
 const properties=['fill','fill-opacity','stroke','stroke-width','stroke-opacity','stroke-dasharray','stroke-linecap','stroke-linejoin','opacity','font-family','font-size','font-weight','text-anchor','paint-order','overflow'];
 const layers=stack?[host]:[...host.children].filter(child=>child.classList.contains('sia-chart-composite__layer')).sort((a,b)=>(Number(getComputedStyle(a).zIndex)||0)-(Number(getComputedStyle(b).zIndex)||0));
 for(const layer of layers){
  for(const svg of layer.querySelectorAll<SVGSVGElement>('svg.sia-chart__svg')){
   const rect=svg.getBoundingClientRect();if(!rect.width||!rect.height)continue;
   const clone=svg.cloneNode(true) as SVGSVGElement;
   const originals=[svg,...svg.querySelectorAll('*')],copies=[clone,...clone.querySelectorAll('*')];
   originals.forEach((element,index)=>{
    const computed=getComputedStyle(element),copy=copies[index] as SVGElement;
    for(const property of properties)copy.style.setProperty(property,computed.getPropertyValue(property));
    // SVG SMIL restarts when serialized into a new image. Freeze live circle geometry
    // before dropping the animation nodes so the PNG contains the current effect frame.
    if(element instanceof SVGCircleElement&&element.querySelector('animate')){
     for(const attribute of ['cx','cy','r'] as const){
      copy.setAttribute(attribute,String(element[attribute].animVal.value));
     }
     copy.querySelectorAll('animate').forEach(animation=>animation.remove());
    }
    copy.style.animation='none';copy.style.transition='none';
   });
   clone.style.width='';clone.style.height='';clone.style.position='';
   const effectSurfaces=svg.querySelectorAll<SVGForeignObjectElement>('foreignObject[data-chart-effect-canvas]');
   const clonedSurfaces=clone.querySelectorAll<SVGForeignObjectElement>('foreignObject[data-chart-effect-canvas]');
   effectSurfaces.forEach((surface,index)=>{
    const canvas=surface.querySelector('canvas'),target=clonedSurfaces[index];if(!canvas||!target)return;
    const image=document.createElementNS(ns,'image');
    for(const attr of ['x','y','width','height'])image.setAttribute(attr,surface.getAttribute(attr)??'0');
    image.setAttribute('href',canvas.toDataURL('image/png'));image.setAttribute('data-chart-effect-snapshot','');
    target.replaceWith(image);
   });
   clone.setAttribute('x',String(rect.left-bounds.left));clone.setAttribute('y',String(rect.top-bounds.top));
   clone.setAttribute('width',String(rect.width));clone.setAttribute('height',String(rect.height));
   // SiaChart headings are HTML overlays; convert only this chart's headings into SVG text.
   const chart=svg.closest('.sia-chart');
   if(chart)appendChartExportHeadings(svg,clone,chart);
   root.appendChild(clone);
  }
 }
 return new XMLSerializer().serializeToString(root);
}

/** 将组合图表的 SVG 内容转换并下载为图片。 */
export async function saveCompositeImage(source:string|null,filename='sia-composite'){
 if(!source)return;
 const image=new Image();image.src=`data:image/svg+xml;charset=utf-8,${encodeURIComponent(source)}`;
 await image.decode();
 const canvas=document.createElement('canvas');canvas.width=Math.ceil(image.naturalWidth*2);canvas.height=Math.ceil(image.naturalHeight*2);
 const context=canvas.getContext('2d');if(!context)throw new Error('无法创建图表导出画布');
 context.drawImage(image,0,0,canvas.width,canvas.height);
 const anchor=document.createElement('a');anchor.download=`${filename}.png`;anchor.href=canvas.toDataURL('image/png');anchor.click();
}
