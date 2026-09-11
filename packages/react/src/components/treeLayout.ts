export interface TreeLayoutInput {children?:readonly TreeLayoutInput[];symbolSize?:number|readonly [number,number]}
export interface TreePosition {x:number;y:number;depth:number;parent?:number;width:number;height:number}

/** Pixel-spaced ordered tree. Center parents over their first/last child and shift whole subtrees to prevent layer collisions. */
export function layoutTreeNodes(root:TreeLayoutInput,options:{nodeSize?:number;nodePadding?:number;layerPadding?:number;rootPosition?:readonly [number,number];orientation?:'horizontal'|'vertical'}={}):TreePosition[]{
 const {nodeSize=20,nodePadding=30,layerPadding=100,rootPosition=[0,0],orientation='vertical'}=options;
 const positions:TreePosition[]=[],children:number[][]=[],nextAtDepth:number[]=[];
 function visit(node:TreeLayoutInput,depth:number,parent?:number):number {
  const index=positions.length,size=node.symbolSize??nodeSize;
  const [width,height]=typeof size==='number'?[size,size]:size;
  positions.push({x:0,y:0,depth,parent,width,height});children.push([]);
  const ids=(node.children??[]).map(child=>visit(child,depth+1,index));children[index]=ids;
  const midpoint=ids.length?(positions[ids[0]!]!.x+positions[ids.at(-1)!]!.x)/2:0;
  positions[index]!.x=midpoint;
  const shift=Math.max(0,(nextAtDepth[depth]??0)-midpoint);
  const move=(id:number)=>{positions[id]!.x+=shift;children[id]!.forEach(move);};
  if(shift){move(index);for(const p of positions.slice(index+1))nextAtDepth[p.depth]=Math.max(nextAtDepth[p.depth]??0,p.x+p.width+nodePadding);}
  nextAtDepth[depth]=positions[index]!.x+width+nodePadding;
  return index;
 }
 visit(root,0);
 function placeDepth(index:number,main:number,previousHeight:number){
  positions[index]!.y=main;
  const ids=children[index]!,height=Math.max(0,...ids.map(id=>positions[id]!.height));
  ids.forEach(id=>placeDepth(id,main+layerPadding+previousHeight,height));
 }
 placeDepth(0,0,positions[0]!.height);
 const rootCross=positions[0]!.x;
 return positions.map(p=>({...p,x:orientation==='vertical'?p.x-rootCross+rootPosition[0]:p.y+rootPosition[0],y:orientation==='vertical'?p.y+rootPosition[1]:p.x-rootCross+rootPosition[1]}));
}
