export interface CloudWord {name:string;value:number;fontSize?:number;rotation?:number}
export interface CloudBounds {x:number;y:number;width:number;height:number}
export function rotatedWordBounds(width:number,height:number,degrees:number){
 const angle=degrees*Math.PI/180,c=Math.abs(Math.cos(angle)),s=Math.abs(Math.sin(angle));
 return {width:width*c+height*s,height:width*s+height*c};
}
export function layoutCloudWords<T extends CloudWord>(data:readonly T[],options:{minFontSize:number;maxFontSize:number;rotations:readonly number[];padding:number;bounds:CloudBounds;spiralStep:number;shape:'ellipse'|'circle'|'square'|'diamond';autoFit?:boolean;areaSizing?:boolean;fontScale?:number;measure?:(word:T,size:number)=>number}):{item:T;index:number;x:number;y:number;width:number;height:number;fontSize:number;rotation:number;rawWidth:number;rawHeight:number}[]{
 const {bounds,minFontSize,maxFontSize,rotations,padding,spiralStep,shape,autoFit=false}=options;
 const placements:{item:T;index:number;x:number;y:number;width:number;height:number;fontSize:number;rotation:number;rawWidth:number;rawHeight:number}[]=[];
 const values=data.map(d=>d.value),minimum=Math.min(...values),maximum=Math.max(...values);
 for(const {item,index} of data.map((item,index)=>({item,index})).sort((a,b)=>b.item.value-a.item.value)){
  const area=bounds.width*bounds.height*Math.min(.25,Math.max(0,item.value)/Math.max(1,values.reduce((a,b)=>a+Math.max(0,b),0)));
  const unitWidth=options.measure?.({...item,name:item.name+'m'},1)??(item.name.length+1)*.58;
  const target=item.fontSize??(options.areaSizing?Math.max(minFontSize,Math.floor(Math.sqrt(area/(unitWidth*2)))):minFontSize+Math.sqrt(Math.max(0,(item.value-minimum)/Math.max(1,maximum-minimum)))*(maxFontSize-minFontSize));
  const rotation=item.rotation??rotations[index%Math.max(1,rotations.length)]??0;
  let found=false;
  for(let size=Math.max(minFontSize,target*(options.fontScale??1));size>=minFontSize&&!found;size=autoFit&&size>minFontSize?Math.max(minFontSize,size-2):-1){
   const rawWidth=options.measure?.(item,size)??[...item.name].reduce((sum,c)=>sum+(c.charCodeAt(0)<256?.58:1)*size,0);
   const box=rotatedWordBounds(rawWidth+padding*2,size*1.22+padding*2,rotation);
   for(let step=0;step<3500;step++){
    const theta=step*.33,r=spiralStep*Math.sqrt(step),x=bounds.x+bounds.width/2+Math.cos(theta)*r,y=bounds.y+bounds.height/2+Math.sin(theta)*r*bounds.height/bounds.width;
    const nx=Math.abs(x-bounds.x-bounds.width/2)/Math.max(1,(bounds.width-box.width)/2),ny=Math.abs(y-bounds.y-bounds.height/2)/Math.max(1,(bounds.height-box.height)/2);
    if(x-box.width/2<bounds.x||x+box.width/2>bounds.x+bounds.width||y-box.height/2<bounds.y||y+box.height/2>bounds.y+bounds.height)continue;
    if(shape==='diamond'?nx+ny>1:shape!=='square'&&nx*nx+ny*ny>1)continue;
    if(placements.some(p=>cloudWordsOverlap({x,y,width:rawWidth+padding*2,height:size*1.22+padding*2,rotation},{x:p.x,y:p.y,width:p.rawWidth,height:p.rawHeight,rotation:p.rotation})))continue;
    placements.push({item,index,x,y,...box,fontSize:size,rotation,rawWidth:rawWidth+padding*2,rawHeight:size*1.22+padding*2});found=true;break;
   }
  }
 }
 if(autoFit&&placements.length<data.length&&(options.fontScale??1)>.2)return layoutCloudWords(data,{...options,fontScale:(options.fontScale??1)*.85});
 return placements;
}
interface OrientedWord {x:number;y:number;width:number;height:number;rotation:number}
export function cloudWordsOverlap(a:OrientedWord,b:OrientedWord):boolean{
 const basis=(angle:number)=>{const r=angle*Math.PI/180;return [[Math.cos(r),Math.sin(r)],[-Math.sin(r),Math.cos(r)]] as const;};
 const aa=basis(a.rotation),bb=basis(b.rotation),dot=(u:readonly number[],v:readonly number[])=>u[0]!*v[0]!+u[1]!*v[1]!;
 for(const axis of [...aa,...bb]){
  const distance=Math.abs((a.x-b.x)*axis[0]+(a.y-b.y)*axis[1]);
  const extent=a.width/2*Math.abs(dot(aa[0],axis))+a.height/2*Math.abs(dot(aa[1],axis))+b.width/2*Math.abs(dot(bb[0],axis))+b.height/2*Math.abs(dot(bb[1],axis));
  if(distance>=extent+1)return false;
 }
 return true;
}
