export type BundlePoint=readonly [number,number];
export interface BundleEdge {source:BundlePoint;target:BundlePoint}
export interface BundledEdge {index:number;points:BundlePoint[]}
interface Segment {start:BundlePoint;end:BundlePoint;index?:number;child?:Group}
interface Group {start:BundlePoint;end:BundlePoint;members:Segment[];ink:number}
const distance=(a:BundlePoint,b:BundlePoint)=>Math.hypot(a[0]-b[0],a[1]-b[1]);
const mean=(points:readonly BundlePoint[]):BundlePoint=>[points.reduce((sum,p)=>sum+p[0],0)/points.length,points.reduce((sum,p)=>sum+p[1],0)/points.length];
/** Move the shared junction along the mean-to-mean axis to bound each branch turn. */
function limitJunction(points:readonly BundlePoint[],center:BundlePoint,opposite:BundlePoint,angle:number):BundlePoint {
 const length=distance(center,opposite);if(length<1e-12)return center;
 const ux=(center[0]-opposite[0])/length,uy=(center[1]-opposite[1])/length;
 let result=center,farthest=0;
 for(const point of points){
  const dx=point[0]-center[0],dy=point[1]-center[1],radius=Math.hypot(dx,dy);if(radius<1e-12)continue;
  const parallel=dx*ux+dy*uy;
  if(parallel/radius>=Math.cos(angle))continue;
  const perpendicular=Math.hypot(dx-parallel*ux,dy-parallel*uy),shift=parallel-perpendicular/Math.tan(angle);
  if(shift*shift>farthest){farthest=shift*shift;result=[center[0]+shift*ux,center[1]+shift*uy];}
 }
 return result;
}
/** Shared trunk plus individual entry/exit spokes, measured in projected screen units. */
export function bundleMeetPoints(edges:readonly BundleEdge[],angle=Math.PI/4){
 if(!edges.length)throw new RangeError('捆绑组不能为空');
 if(!Number.isFinite(angle)||angle<=0||angle>=Math.PI/2)throw new RangeError('转角必须在 0 和 π/2 之间');
 const starts=edges.map(e=>e.source),ends=edges.map(e=>e.target),a=mean(starts),b=mean(ends);
 const start=limitJunction(starts,a,b,angle),end=limitJunction(ends,b,a,angle);
 return {start,end,ink:distance(start,end)+edges.reduce((sum,e)=>sum+distance(e.source,start)+distance(end,e.target),0)};
}
function cluster(segments:Segment[],nearest:number,angle:number){
 const groups:Group[]=[],owners=new Map<Segment,Group>();let saved=0;
 for(const segment of segments){
  if(owners.has(segment))continue;
  const neighbors:{segment:Segment;distance:number;index:number}[]=[];
  // Bounded neighbor selection avoids sorting all edges and has deterministic tie handling.
  for(let index=0;index<segments.length;index++){
   const other=segments[index]!;if(other===segment)continue;
   const score=(other.start[0]-segment.start[0])**2+(other.start[1]-segment.start[1])**2+(other.end[0]-segment.end[0])**2+(other.end[1]-segment.end[1])**2;
   let at=0;while(at<neighbors.length&&neighbors[at]!.distance<=score)at++;
   if(at<nearest){neighbors.splice(at,0,{segment:other,distance:score,index});if(neighbors.length>nearest)neighbors.pop();}
  }
  let best:{group:Group;start:BundlePoint;end:BundlePoint;ink:number;saving:number}|undefined;
  const checked=new Set<Group>();
  for(const neighbor of neighbors){
   const group=owners.get(neighbor.segment)??{start:neighbor.segment.start,end:neighbor.segment.end,members:[neighbor.segment],ink:distance(neighbor.segment.start,neighbor.segment.end)};
   if(checked.has(group))continue;checked.add(group);
   const meeting=bundleMeetPoints([...group.members,segment].map(s=>({source:s.start,target:s.end})),angle);
   const saving=group.ink+distance(segment.start,segment.end)-meeting.ink;
   if(saving>0&&(!best||saving>best.saving))best={group,...meeting,saving};
  }
  if(best){if(!groups.includes(best.group))groups.push(best.group);best.group.members.push(segment);best.group.start=best.start;best.group.end=best.end;best.group.ink=best.ink;for(const member of best.group.members)owners.set(member,best.group);saved+=best.saving;}
  else {const group={start:segment.start,end:segment.end,members:[segment],ink:distance(segment.start,segment.end)};groups.push(group);owners.set(segment,group);}
 }
 return {groups,saved};
}
/** Hierarchical ink-saving edge bundles. Input directions and exact endpoints survive grouping. */
export function bundleEdges(edges:readonly BundleEdge[],options:{nearest?:number;maxIterations?:number;maxTurningAngle?:number}={}):BundledEdge[]{
 const nearest=options.nearest??6,iterations=options.maxIterations??20,angle=options.maxTurningAngle??Math.PI/4;
 if(!Number.isInteger(nearest)||nearest<1||!Number.isInteger(iterations)||iterations<0)throw new RangeError('无效捆绑迭代参数');
 if(!Number.isFinite(angle)||angle<=0||angle>=Math.PI/2)throw new RangeError('无效转角');
 const segments=edges.map((edge,index)=>{if(edge.source.length!==2||edge.target.length!==2||![...edge.source,...edge.target].every(Number.isFinite))throw new RangeError('线路坐标必须有限');return edge.source[1]<edge.target[1]?{start:edge.source,end:edge.target,index}:{start:edge.target,end:edge.source,index};});
 let result=cluster(segments,nearest,angle);
 for(let iteration=0;iteration<iterations;iteration++){
  const next=cluster(result.groups.map(group=>({start:group.start,end:group.end,child:group})),nearest,angle);
  if(next.saved<=0)break;result=next;
 }
 const output:BundledEdge[]=[];
 const visit=(group:Group,middle:BundlePoint[])=>{
  const trunk=[group.start,...middle,group.end];
  for(const member of group.members){
   if(member.child){visit(member.child,trunk);continue;}
   const points=[member.start,...trunk,member.end].filter((p,i,array)=>i===0||distance(p,array[i-1]!)>=1e-5).map(p=>[p[0],p[1]] as BundlePoint);
   const index=member.index!;if(distance(points[0]!,edges[index]!.source)>=1e-5)points.reverse();
   // Junction deduplication must not replace exact geographic endpoints with averaged values.
   const original=edges[index]!;points[0]=[original.source[0],original.source[1]];
   if(points.length===1&&distance(original.source,original.target)>0)points.push([original.target[0],original.target[1]]);
   else points[points.length-1]=[original.target[0],original.target[1]];
   output.push({index,points});
  }
 };
 for(const group of result.groups)visit(group,[]);
 return output;
}
