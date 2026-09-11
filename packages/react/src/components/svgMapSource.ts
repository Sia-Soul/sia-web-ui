export interface SvgMapPath {name:string;d:string;fill?:string;stroke?:string;strokeWidth?:number;opacity?:number}
export interface SvgMapSource {x:number;y:number;width:number;height:number;paths:SvgMapPath[]}
/** Read SVG geometry as data. Direct transforms and group styles are ignored like the reference projection. */
export function parseSvgMapPaths(source:string):SvgMapSource{
 const document=new DOMParser().parseFromString(source,'image/svg+xml');
 const svg=document.documentElement;
 if(document.querySelector('parsererror')||svg.localName!=='svg')throw new Error('无效的 SVG 地图');
 const number=(element:Element,name:string,fallback:number)=>{const raw=element.getAttribute(name);if(raw===null)return fallback;const value=parseFloat(raw);if(!Number.isFinite(value))throw new Error(`SVG 地图 ${name} 不是有效数值`);return value;};
 const width=number(svg,'width',0),height=number(svg,'height',0);
 if(width<=0||height<=0)throw new Error('SVG 地图需要正数宽高');
 const paths=[...svg.querySelectorAll('path,rect,circle,ellipse,line,polygon,polyline')].map(element=>{
  let d=element.getAttribute('d')??'';
  if(element.localName==='rect'){
   const x=number(element,'x',0),y=number(element,'y',0),w=number(element,'width',0),h=number(element,'height',0);
   if(w<0||h<0)throw new Error('SVG 地图矩形尺寸无效');
   d=`M${x} ${y} h${w} v${h} h${-w} Z`;
  }else if(element.localName==='circle'||element.localName==='ellipse'){
   const x=number(element,'cx',0),y=number(element,'cy',0),r=number(element,element.localName==='circle'?'r':'rx',0),ry=element.localName==='circle'?r:number(element,'ry',0);
   if(r<0||ry<0)throw new Error('SVG 地图圆半径无效');
   // Quarter arcs avoid near-diameter floating-point radius correction in browsers.
   d=`M${x-r} ${y} a${r} ${ry} 0 0 0 ${r} ${ry} a${r} ${ry} 0 0 0 ${r} ${-ry} a${r} ${ry} 0 0 0 ${-r} ${-ry} a${r} ${ry} 0 0 0 ${-r} ${ry} Z`;
  }else if(element.localName==='line'){
   d=`M${number(element,'x1',0)} ${number(element,'y1',0)} L${number(element,'x2',0)} ${number(element,'y2',0)}`;
  }else if(element.localName==='polygon'||element.localName==='polyline'){
   const values=(element.getAttribute('points')??'').trim().split(/[\s,]+/).map(Number);
   if(values.length<4||values.length%2||values.some(value=>!Number.isFinite(value)))throw new Error('SVG 地图多边形坐标无效');
   d=`M${values[0]} ${values[1]}`;
   for(let i=2;i<values.length;i+=2)d+=` L${values[i]} ${values[i+1]}`;
   // The reference projection renders polyline using its polygon implementation too.
   d+=' Z';
  }
  if(!d.trim())throw new Error('SVG 地图路径为空');
  const path:SvgMapPath={name:element.getAttribute('name')??'',d};
  // Match the reference SVG projection: direct attributes only, not group/CSS inheritance.
  const fill=element.getAttribute('fill'),stroke=element.getAttribute('stroke');
  if(fill&&fill!=='none')path.fill=fill;
  if(stroke&&stroke!=='none')path.stroke=stroke;
  if((!fill||fill==='none')&&stroke&&stroke!=='none')path.fill='none';
  if(element.hasAttribute('stroke-width'))path.strokeWidth=number(element,'stroke-width',1);
  if(element.hasAttribute('opacity'))path.opacity=number(element,'opacity',1);
  return path;
 });
 if(!paths.length)throw new Error('SVG 地图没有路径');
 return {x:number(svg,'x',0),y:number(svg,'y',0),width,height,paths};
}
