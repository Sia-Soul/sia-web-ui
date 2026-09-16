export interface ForceNode {id:string;x?:number;y?:number;fixed?:boolean;fixX?:boolean;fixY?:boolean;value?:number;radius?:number}
export interface ForceLink {source:string;target:string;value?:number}
/** Parameters of the native solver, not a promise of ECharts physics equivalence. */
export interface ForceLayoutOptions {
  /** 每帧执行的布局迭代次数。 */
  stepsPerFrame?:number;
  /** 布局模型或数据模型。 */
  model?:'native'|'legacy';
  /** 宽度；数值按像素处理，字符串可使用 CSS 尺寸。 */
  width?:number;
  /** 高度；数值按像素处理，字符串可使用 CSS 尺寸。 */
  height?:number;
  /** 力导向布局的冷却系数。 */
  coolDown?:number;
  /** 允许的最小半径。 */
  minRadius?:number;
  /** 允许的最大半径。 */
  maxRadius?:number;
  /** 随机布局的种子，用于复现相同布局。 */
  seed?:number;
  /** 中心位置。 */
  center?:{
  /** 横向位置或 X 轴数据值。 */
  x:number;
  /** 纵向位置或 Y 轴数据值。 */
  y:number};
  /** 布局引力强度。 */
  gravity?:number;
  /** 布局缩放系数。 */
  scaling?:number;
  /** 布局中的目标连线距离。 */
  linkDistance?:number;
  /** 布局迭代次数。 */
  iterations?:number;
  /** 是否根据连线权重调整布局。 */
  weightedLinks?:boolean;
  /** 参与布局或渲染的最大节点数。 */
  maxNodes?:number}
export interface ForcePoint { x: number; y: number; vx: number; vy: number; iteration?:number; temperature?:number }

/** Reheat in place conceptually, while preserving immutable frame snapshots and velocities. */
export function reheatGraphLayout(points:readonly ForcePoint[],temperature=.8):ForcePoint[]{
 if(!Number.isFinite(temperature)||temperature<0||temperature>1)throw new RangeError('Force temperature must be within [0, 1]');
 return points.map(point=>({...point,temperature}));
}

export function graphLayout(nodes: readonly ForceNode[], links: readonly ForceLink[], force: boolean, options:ForceLayoutOptions={}):ForcePoint[] {
  const center = options.center??{ x: 360, y: 184 };
  const radius = Math.min(125, 42 + nodes.length * 11);
  let seed=(options.seed??53)>>>0;
  const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  const points = nodes.map((node, index) => {
    const angle = -Math.PI / 2 + index / Math.max(1, nodes.length) * Math.PI * 2;
    if(options.model==='legacy'){const span=.8*Math.min(options.width??720,options.height??360);return {x:node.x??center.x+(random()-.5)*span,y:node.y??center.y+(random()-.5)*span,vx:0,vy:0};}
    return { x: node.x ?? center.x + Math.cos(angle) * radius, y: node.y ?? center.y + Math.sin(angle) * radius, vx: 0, vy: 0 };
  });
  return force?advanceGraphLayout(nodes,links,points,options):points;
}

/** Advance an existing state without reinitializing positions or discarding velocity. */
export function advanceGraphLayout(nodes:readonly ForceNode[],links:readonly ForceLink[],previous:readonly ForcePoint[],options:ForceLayoutOptions={}) {
  if(previous.length!==nodes.length)throw new RangeError('Force state must match node count');
  if(options.model==='legacy')return advanceLegacyForceLayout(nodes,links,previous,options);
  const points=previous.map(point=>({...point}));
  if(nodes.length>(options.maxNodes??80))return points;
  const center=options.center??{x:360,y:184},gravity=options.gravity??1,scaling=options.scaling??1;
  const weights=links.map(link=>Math.max(0,Number.isFinite(link.value)?link.value!:1)),maxWeight=Math.max(1,...weights);
  const indexById = new Map(nodes.map((node, index) => [node.id, index]));
  for (let iteration = 0; iteration < (options.iterations??140); iteration += 1) {
    for (let left = 0; left < points.length; left += 1) {
      for (let right = left + 1; right < points.length; right += 1) {
        const a = points[left]!;
        const b = points[right]!;
        const dx = a.x - b.x || 0.01;
        const dy = a.y - b.y || 0.01;
        const distanceSquared = dx * dx + dy * dy;
        const forceValue = Math.min(1.6, 1350 * scaling / distanceSquared);
        const distance = Math.sqrt(distanceSquared);
        a.vx += dx / distance * forceValue;
        a.vy += dy / distance * forceValue;
        b.vx -= dx / distance * forceValue;
        b.vy -= dy / distance * forceValue;
      }
    }
    links.forEach((link,linkIndex) => {
      const sourceIndex = indexById.get(link.source);
      const targetIndex = indexById.get(link.target);
      if (sourceIndex == null || targetIndex == null) return;
      const source = points[sourceIndex]!;
      const target = points[targetIndex]!;
      const dx = target.x - source.x;
      const dy = target.y - source.y;
      const distance = Math.sqrt(dx * dx + dy * dy) || 1;
      const weight=options.weightedLinks?weights[linkIndex]!/maxWeight:1;
      const pull = (distance - (options.linkDistance??105)) * 0.012 * weight;
      source.vx += dx / distance * pull;
      source.vy += dy / distance * pull;
      target.vx -= dx / distance * pull;
      target.vy -= dy / distance * pull;
    });
    points.forEach((point, index) => {
      if (nodes[index]?.fixed) {point.vx=0;point.vy=0;return;}
      point.vx += (center.x - point.x) * 0.0018 * gravity;
      point.vy += (center.y - point.y) * 0.0018 * gravity;
      point.vx *= 0.82;
      point.vy *= 0.82;
      if(!nodes[index]?.fixX)point.x = Math.max(52, Math.min(668, point.x + point.vx));
      if(!nodes[index]?.fixY)point.y = Math.max(44, Math.min(318, point.y + point.vy));
    });
  }
  return points;
}

/** Direct pairwise implementation of the documented legacy force equations.
 * Uses JS numbers, not the original Float32 storage; no third-party runtime.
 */
export function advanceLegacyForceLayout(nodes:readonly ForceNode[],links:readonly ForceLink[],previous:readonly ForcePoint[],options:ForceLayoutOptions={}){
 if(nodes.length!==previous.length)throw new RangeError('Force state must match node count');
 const points=previous.map(p=>({...p}));
 if(!nodes.length||nodes.length>(options.maxNodes??80))return points;
 const size=Math.min(options.width??720,options.height??360),k=.4*(options.scaling??1)*size/Math.sqrt(nodes.length);
 const center=options.center??{x:360,y:184},gravity=options.gravity??1,cooling=options.coolDown??.99;
 const values=nodes.map(n=>n.value??links.reduce((sum,l)=>sum+(l.source===n.id||l.target===n.id?l.value??1:0),0));
 const min=Math.min(...values),max=Math.max(...values),minRadius=options.minRadius??10,maxRadius=options.maxRadius??20;
 const masses=nodes.map((n,i)=>n.radius!==undefined?n.radius/maxRadius:max>min?(minRadius+(values[i]!-min)/(max-min)*(maxRadius-minRadius))/maxRadius:.5);
 const indices=new Map(nodes.map((n,i)=>[n.id,i]));
 const maximumWeight=Math.max(1,...links.map(l=>l.value??1));
 for(let step=0;step<(options.iterations??140);step++){
  const iteration=points[0]!.iteration??0,temperature=points[0]!.temperature??Math.pow(cooling,iteration);
  const forces=points.map(()=>({x:0,y:0}));
  for(let i=0;i<points.length;i++)for(let j=i+1;j<points.length;j++){
   const dx=points[i]!.x-points[j]!.x,dy=points[i]!.y-points[j]!.y,d2=dx*dx+dy*dy;if(!d2)continue;
   const factor=2*k*k*(masses[i]!+masses[j]!)/d2;
   forces[i]!.x+=dx*factor;forces[i]!.y+=dy*factor;forces[j]!.x-=dx*factor;forces[j]!.y-=dy*factor;
  }
  points.forEach((p,i)=>{const dx=center.x-p.x,dy=center.y-p.y,factor=Math.hypot(dx,dy)/100*gravity*masses[i]!;forces[i]!.x+=dx*factor;forces[i]!.y+=dy*factor;});
  for(const link of links){const i=indices.get(link.source),j=indices.get(link.target);if(i===undefined||j===undefined)continue;const dx=points[i]!.x-points[j]!.x,dy=points[i]!.y-points[j]!.y,factor=Math.max(0,link.value??1)/maximumWeight*Math.hypot(dx,dy)/(k||1);forces[i]!.x-=dx*factor;forces[i]!.y-=dy*factor;forces[j]!.x+=dx*factor;forces[j]!.y+=dy*factor;}
  points.forEach((p,i)=>{
   p.iteration=iteration+1;p.temperature=temperature*cooling;if(nodes[i]!.fixed){p.vx=0;p.vy=0;return;}
   let fx=forces[i]!.x/30,fy=forces[i]!.y/30;const forceLength=Math.hypot(fx,fy)+.1,forceScale=Math.min(forceLength,500)/forceLength;fx*=forceScale;fy*=forceScale;
   let vx=(p.vx+fx)*temperature,vy=(p.vy+fy)*temperature;
   const dx=vx-p.vx,dy=vy-p.vy,change=Math.hypot(dx,dy),oldSpeed=Math.hypot(p.vx,p.vy);
   if(change>0&&oldSpeed>0){const limited=Math.min(change/oldSpeed,1)*oldSpeed;vx=p.vx+dx/change*limited;vy=p.vy+dy/change*limited;}
   const speed=Math.hypot(vx,vy),speedScale=Math.min(speed,100)/(speed+.1);p.vx=vx*speedScale;p.vy=vy*speedScale;
   // Match the source's post-step position synchronization: axis locks keep velocity.
   if(!nodes[i]!.fixX)p.x+=p.vx;
   if(!nodes[i]!.fixY)p.y+=p.vy;
  });
 }
 return points;
}
