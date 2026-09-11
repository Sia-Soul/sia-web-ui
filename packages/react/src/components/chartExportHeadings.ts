/** HTML headings may sit in SVG letterboxing; keep their glyphs inside the export. */
export function appendChartExportHeadings(original:SVGSVGElement,clone:SVGSVGElement,host:Element){
 const matrix=original.getScreenCTM();if(!matrix)return;
 const inverse=matrix.inverse(),view=original.viewBox.baseVal;
 const scale=Math.hypot(inverse.a,inverse.b);
 for(const element of host.querySelectorAll('.sia-chart__heading strong, .sia-chart__heading span')){
  if(element.closest('.sia-chart')!==host)continue;
  const computed=getComputedStyle(element);if(computed.display==='none')continue;
  const range=document.createRange();range.selectNodeContents(element);
  const bounds=range.getBoundingClientRect();if(!bounds.width||!bounds.height)continue;
  const position=new DOMPoint(bounds.left,bounds.top+bounds.height*.8).matrixTransform(inverse);
  const width=bounds.width*scale,height=bounds.height*scale;
  const text=document.createElementNS('http://www.w3.org/2000/svg','text');
  text.textContent=element.textContent;text.setAttribute('data-chart-export-heading','');
  text.setAttribute('x',String(Math.max(view.x+5,Math.min(position.x,view.x+view.width-width-5))));
  text.setAttribute('y',String(Math.max(view.y+height*.8,Math.min(position.y,view.y+view.height-height*.2))));
  text.setAttribute('fill',computed.color);
  text.style.fontFamily=computed.fontFamily;text.style.fontWeight=computed.fontWeight;
  text.style.fontSize=`${parseFloat(computed.fontSize)*scale}px`;
  text.style.textAnchor='start';
  clone.appendChild(text);
 }
}
