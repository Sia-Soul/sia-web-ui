export interface ChordMatrixSegment {index:number;target:number;start:number;end:number;value:number;}
/** Legacy non-ribbon chord nodes use incident weight to scale symbol radius,
 * then allocate angular space by that radius (not by the original weight).
 * Coordinates use SVG radians, with increasing angles clockwise.
 */
export function chordNodeLayout(nodes:readonly {id:string;value?:number}[],links:readonly {source:string;target:string;value:number}[],options:{minRadius?:number;maxRadius?:number;orbitRadius?:number;startAngle?:number;padAngle?:number;clockwise?:boolean;sort?:'none'|'ascending'|'descending'}={}){
 const ids=new Set(nodes.map(n=>n.id));
 const validLinks=links.filter(l=>ids.has(l.source)&&ids.has(l.target)&&Number.isFinite(l.value)&&l.value>=0);
 const weighted=nodes.map((node,index)=>({id:node.id,index,value:node.value??validLinks.reduce((sum,l)=>sum+(l.source===node.id||l.target===node.id?l.value:0),0)})).filter(n=>Number.isFinite(n.value)&&n.value>0);
 const weights=weighted.map(n=>n.value),low=Math.min(...weights),high=Math.max(...weights);
 const minRadius=Math.max(0,options.minRadius??10),maxRadius=Math.max(minRadius,options.maxRadius??20);
 const sized=weighted.map(node=>({...node,radius:high===low?node.value:minRadius+(node.value-low)/(high-low)*(maxRadius-minRadius)}));
 if(options.sort&&options.sort!=='none')sized.sort((a,b)=>(a.radius-b.radius)*(options.sort==='ascending'?1:-1)||a.index-b.index);
 const total=sized.reduce((sum,n)=>sum+n.radius,0),pad=Math.max(0,Math.min(options.padAngle??Math.PI/90,sized.length?Math.PI*2/sized.length:0)),direction=options.clockwise===false?-1:1,orbit=options.orbitRadius??128;
 let angle=options.startAngle??Math.PI/2;
 return sized.map(node=>{const start=angle,end=start+direction*(Math.PI*2-pad*sized.length)*node.radius/(total||1),middle=(start+end)/2;angle=end+direction*pad;return {...node,start,end,middle,x:Math.cos(middle)*orbit,y:Math.sin(middle)*orbit};});
}
/** Multiple relation series share node arcs, but retain separate ribbon endpoints.
 * The first visible series supplies the nodes, matching legacy insertToSerie.
 * Values without a reciprocal relation contribute to node size but not ribbons.
 * Angles are radians in SVG coordinates; clockwise means increasing angles.
 */
export function chordMultiMatrixLayout(matrices:readonly (readonly (readonly number[])[])[],options:{startAngle?:number;padAngle?:number;clockwise?:boolean}={}){
 const n=matrices[0]?.length??0,direction=options.clockwise===false?-1:1;
 const values=matrices.map(matrix=>Array.from({length:n},(_,i)=>Array.from({length:n},(_,j)=>Number.isFinite(matrix[i]?.[j])?Math.max(0,matrix[i]![j]!):0)));
 const sums=values.map(matrix=>matrix.map(row=>row.reduce((sum,v)=>sum+v,0)));
 const indices=Array.from({length:n},(_,i)=>i).filter(i=>(sums[0]?.[i]??0)>0);
 const totals=indices.map(i=>sums.reduce((sum,row)=>sum+row[i]!,0)),total=totals.reduce((sum,v)=>sum+v,0);
 const pad=Math.max(0,Math.min(options.padAngle??Math.PI/90,indices.length?Math.PI*2/indices.length:0));
 const factor=total?(Math.PI*2-pad*indices.length)/total:0;
 const segments=new Map<string,ChordMatrixSegment>();
 let angle=options.startAngle??Math.PI/2;
 const groups=indices.map((index,k)=>{
  const start=angle,value=totals[k]!;
  const outgoing=values.flatMap((matrix,seriesIndex)=>indices.filter(target=>matrix[index]![target]!>0&&matrix[target]![index]!>0).map(target=>({seriesIndex,target,value:matrix[index]![target]!})));
  const outgoingTotal=outgoing.reduce((sum,edge)=>sum+edge.value,0);
  const edgeFactor=outgoingTotal?factor*value/outgoingTotal:0;
  for(const edge of outgoing){const end=angle+direction*edge.value*edgeFactor;segments.set(`${edge.seriesIndex}:${index}:${edge.target}`,{index,target:edge.target,start:angle,end,value:edge.value});angle=end;}
  const end=start+direction*value*factor;angle=end+direction*pad;
  return {index,start,end,value};
 });
 const ribbons:{seriesIndex:number;source:ChordMatrixSegment;target:ChordMatrixSegment}[]=[];
 for(let seriesIndex=0;seriesIndex<values.length;seriesIndex++)for(const i of indices)for(const j of indices){
  if(j<i)continue;
  const a=segments.get(`${seriesIndex}:${i}:${j}`),b=segments.get(`${seriesIndex}:${j}:${i}`);
  if(a&&b)ribbons.push({seriesIndex,source:a.value>=b.value?a:b,target:a.value>=b.value?b:a});
 }
 return {groups,ribbons,total};
}
/** Legacy scale labels use incident (incoming + outgoing) totals, at 4-degree ticks. */
export function chordScaleTicks(start:number,end:number,total:number,padAngle:number){
 const span=Math.abs(end-start),sign=end>=start?1:-1,step=Math.PI/45;
 const unitsPerDegree=total*2/(360-padAngle*180/Math.PI);
 return Array.from({length:Math.min(1000,Math.floor(span/step)+1)},(_,i)=>({angle:start+sign*i*step,value:i*4*unitsPerDegree,label:i%5===0}));
}
export function chordMatrixLayout(matrix:readonly (readonly number[])[],options:{startAngle?:number;legacySubSort?:boolean;padAngle?:number;clockwise?:boolean;sort?:'none'|'ascending'|'descending';sortSub?:'none'|'ascending'|'descending'}={}){
 const n=matrix.length,direction=options.clockwise===false?-1:1;
 const values=matrix.map(row=>Array.from({length:n},(_,j)=>Number.isFinite(row[j])?Math.max(0,row[j]!):0));
 const sums=values.map(row=>row.reduce((sum,v)=>sum+v,0)),total=sums.reduce((sum,v)=>sum+v,0);
 const pad=Math.max(0,Math.min(options.padAngle??.035,n?Math.PI*2/n:0));
 const factor=total?(Math.PI*2-pad*n)/total:0;
 const order=Array.from({length:n},(_,i)=>i);
 if(options.sort&&options.sort!=='none')order.sort((a,b)=>(sums[a]!-sums[b]!)*(options.sort==='ascending'?1:-1)||a-b);
 const segments:ChordMatrixSegment[][]=Array.from({length:n},()=>[]);
 let angle=options.startAngle??-Math.PI/2;
 const subSort=options.legacySubSort?(options.sortSub==='ascending'?'ascending':options.sort==='descending'?'descending':'none'):options.sortSub;
 const groups=order.map(index=>{
  const start=angle,targets=Array.from({length:n},(_,i)=>i);
  if(subSort&&subSort!=='none')targets.sort((a,b)=>(values[index]![a]!-values[index]![b]!)*(subSort==='ascending'?1:-1)||a-b);
  for(const target of targets){const value=values[index]![target]!,end=angle+direction*value*factor;segments[index]![target]={index,target,start:angle,end,value};angle=end;}
  const group={index,start,end:angle,value:sums[index]!};angle+=direction*pad;return group;
 });
 const ribbons:{source:ChordMatrixSegment;target:ChordMatrixSegment}[]=[];
 for(let i=0;i<n;i++)for(let j=i;j<n;j++)if(values[i]![j]||values[j]![i]){
  const a=segments[i]![j]!,b=segments[j]![i]!;
  ribbons.push(a.value>=b.value?{source:a,target:b}:{source:b,target:a});
 }
 return {groups,ribbons,total};
}
