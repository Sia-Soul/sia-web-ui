/** 小面积液体背景的几何定义；所有坐标均为分组内的 CSS 像素。 */
export type FluidBox = { x: number; y: number; width: number; height: number; radii: number[] };
/** 轮廓控制点，依次为分组本地坐标中的横向与纵向 CSS 像素。 */
export type FluidPoint = [number, number];

/** 生成同拓扑的贝塞尔轮廓：两端保留液体体积，中间形成横向沙漏细颈。 */
export function radioFluidShape(from: FluidBox, to: FluidBox, progress: number): FluidPoint[] {
  const mix = (a: number, b: number) => a+(b-a)*progress;
  const flow = Math.sin(Math.PI*progress);
  const stretch = flow*Math.min(Math.abs(to.x-from.x)*.35, Math.min(from.width,to.width)*.4);
  const left = Math.max(Math.min(from.x,to.x),mix(from.x,to.x)-stretch);
  const right = Math.min(Math.max(from.x+from.width,to.x+to.width),mix(from.x+from.width,to.x+to.width)+stretch);
  const centerY = mix(from.y+from.height/2,to.y+to.height/2);
  const height = mix(from.height,to.height)*(1-.18*flow);
  const top=centerY-height/2,bottom=centerY+height/2,width=right-left;
  // 细颈保持在两个选项之间，两侧体积此消彼长，表现液体转移而非整块沙漏平移。
  const junction=(from.x+from.width/2+to.x+to.width/2)/2;
  const neckX=Math.max(left+width*.24,Math.min(right-width*.24,junction)),neckHeight=height*(1-.86*flow*flow);
  const nt=centerY-neckHeight/2,nb=centerY+neckHeight/2;
  const shoulderL=left+(neckX-left)*.28,shoulderR=right-(right-neckX)*.28;
  const curveL=(neckX-shoulderL)*.48,curveR=(shoulderR-neckX)*.48;
  const [tl,tr,br,bl]=from.radii.map((r,i)=>Math.min(height/2,width*.15,mix(r,to.radii[i])+flow*5));
  return [[left+tl,top],[shoulderL,top],
    [neckX-curveL,top],[neckX-curveL,nt],[neckX,nt],
    [neckX+curveR,nt],[neckX+curveR,top],[shoulderR,top],
    [right-tr,top],[right,top],[right,top+tr],
    [right,bottom-br],[right,bottom],[right-br,bottom],[shoulderR,bottom],
    [neckX+curveR,bottom],[neckX+curveR,nb],[neckX,nb],
    [neckX-curveL,nb],[neckX-curveL,bottom],[shoulderL,bottom],
    [left+bl,bottom],[left,bottom],[left,bottom-bl],
    [left,top+tl],[left,top]];
}

/** 固定命令和点数，使浏览器直接插值轮廓；只在切换时预计算，播放期间不运行逐帧 JS。 */
export function radioFluidPath(points: FluidPoint[], origin: { x: number; y: number }) {
  const p=points.map(([x,y])=>`${(x-origin.x).toFixed(3)} ${(y-origin.y).toFixed(3)}`);
  return `path("M ${p[0]} L ${p[1]} C ${p[2]} ${p[3]} ${p[4]} C ${p[5]} ${p[6]} ${p[7]} L ${p[8]} Q ${p[9]} ${p[10]} L ${p[11]} Q ${p[12]} ${p[13]} L ${p[14]} C ${p[15]} ${p[16]} ${p[17]} C ${p[18]} ${p[19]} ${p[20]} L ${p[21]} Q ${p[22]} ${p[23]} L ${p[24]} Q ${p[25]} ${p[0]} Z")`;
}
