/** force4: consume x, value, then child-count random draws in original DFS order. */
export function createForceLayeredData(seed=53,width=720,height=379){
 let state=seed>>>0;
 const random=()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return state/4294967296;};
 const nodes:{id:number;name:string;value:number;depth:number;category:number;x:number;y:number;fixY:true}[]=[];
 const links:{source:number;target:number;weight:number}[]=[];
 const create=(depth:number)=>{
  const x=width/2+(.5-random())*200,y=(height-20)*depth/5+20,id=nodes.length;
  nodes.push({id,name:id===0?'ROOT':`NODE_${id}`,value:random()*8+2,depth,category:id===0?2:depth===4?0:1,x,y,fixY:true});
  return id;
 };
 const mock=(parent:number,depth:number)=>{
  const count=Math.round(random()+2);
  for(let i=0;i<count;i++){
   const child=create(depth);links.push({source:parent,target:child,weight:1});
   if(depth<4)mock(child,depth+1);
  }
 };
 mock(create(0),1);
 return {nodes,links};
}
