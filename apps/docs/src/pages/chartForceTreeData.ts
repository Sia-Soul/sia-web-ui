/** Preserve the source's depth-0 children and depth-first random draw order. */
export function createForceTreeData(seed=53){
 let state=seed>>>0;
 const random=()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return state/4294967296;};
 const nodes:{id:number;name:string;value:number;depth:number;category:number}[]=[{id:0,name:'ROOT',value:random()*8+2,depth:0,category:2}];
 const links:{source:number;target:number;weight:number}[]=[];
 const mock=(parent:number,depth:number)=>{
  const children=Math.round(random()*3+4);
  for(let i=0;i<children;i++){
   const id=nodes.length;
   nodes.push({id,name:`NODE_${id}`,value:random()*8+2,depth,category:depth===2?0:1});
   links.push({source:parent,target:id,weight:1});
   if(depth<2)mock(id,depth+1);
  }
 };
 mock(0,0);
 return {nodes,links};
}
