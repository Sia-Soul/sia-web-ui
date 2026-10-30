import { useLayoutEffect, useRef } from "react";
import type { RefObject } from "react";
import { radioFluidPath, radioFluidShape } from "./radioFluidMotion";
import type { FluidBox, FluidPoint } from "./radioFluidMotion";

type SelectionBox = FluidBox & { target: HTMLElement };

/** 实心单选共用一个液体背景；两端通过沙漏细颈连续流动，文字和原生输入保持稳定。 */
export function RadioSelectionMotion({ rootRef }: { rootRef: RefObject<HTMLDivElement> }) {
  const indicatorRef = useRef<HTMLSpanElement>(null);
  const previous = useRef<SelectionBox>();
  const animation = useRef<Animation>();
  const flowing = useRef<{ animation: Animation; shapes: FluidPoint[][] }>();
  useLayoutEffect(() => {
    const indicator = indicatorRef.current;
    // 子组件的布局副作用可能先于父节点 ref 赋值，首次挂载直接使用已连接的父元素。
    const root = rootRef.current ?? indicator?.parentElement;
    if (!root || !indicator) return;
    let frame = 0;
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => {
      const labels = [...root.querySelectorAll<HTMLElement>(":scope > .sia-radio--button.sia-radio--solid")];
      const target = labels.find(label => label.querySelector<HTMLInputElement>("input")?.checked && label.getClientRects().length);
      if (!target || !root.offsetWidth) {
        animation.current?.cancel(); previous.current = undefined;
        indicator.style.display = "none";
        delete root.dataset.siaRadioMotion; delete root.dataset.siaRadioMoving;
        return;
      }
      const bounds = root.getBoundingClientRect();
      const scaleX = bounds.width / root.offsetWidth || 1, scaleY = bounds.height / root.offsetHeight || 1;
      // 使用本地坐标，保证放在缩放中的弹框或滚动容器内也能准确铺满目标项。
      const box = (node: HTMLElement) => {
        const rect = node.getBoundingClientRect();
        return { x: (rect.left - bounds.left) / scaleX + root.scrollLeft - root.clientLeft, y: (rect.top - bounds.top) / scaleY + root.scrollTop - root.clientTop, width: rect.width / scaleX, height: rect.height / scaleY };
      };
      const targetStyle = getComputedStyle(target);
      const next = { ...box(target), target, radii: [targetStyle.borderTopLeftRadius,targetStyle.borderTopRightRadius,targetStyle.borderBottomRightRadius,targetStyle.borderBottomLeftRadius].map(value=>parseFloat(value)||0) };
      root.dataset.siaRadioMotion = "";
      indicator.style.opacity = target.querySelector<HTMLInputElement>("input")?.disabled ? ".58" : "1";
      const last = previous.current;
      if (last?.target === target && Math.abs(last.x-next.x)<.5 && Math.abs(last.y-next.y)<.5 && Math.abs(last.width-next.width)<.5 && Math.abs(last.height-next.height)<.5) return;
      let initialShape: FluidPoint[] | undefined;
      const current = flowing.current;
      if (current && ["running","paused"].includes(current.animation.playState)) {
        // 从当前轮廓接续，连续点击时不恢复成矩形或跳到上一选项的终点。
        const position=Number(current.animation.effect?.getComputedTiming().progress ?? 0)*(current.shapes.length-1);
        const index=Math.min(current.shapes.length-2,Math.floor(position)),fraction=position-index;
        initialShape=current.shapes[index].map(([x,y],i)=>[x+(current.shapes[index+1][i][0]-x)*fraction,y+(current.shapes[index+1][i][1]-y)*fraction]);
      }
      const xs=initialShape?.map(p=>p[0]),ys=initialShape?.map(p=>p[1]);
      const from = initialShape && xs && ys ? { x:Math.min(...xs),y:Math.min(...ys),width:Math.max(...xs)-Math.min(...xs),height:Math.max(...ys)-Math.min(...ys),radii:next.radii } : last;
      animation.current?.cancel(); delete root.dataset.siaRadioMoving;
      flowing.current=undefined;
      indicator.style.display = "block";
      indicator.style.width = `${next.width}px`; indicator.style.height = `${next.height}px`;
      indicator.style.borderRadius = getComputedStyle(target).borderRadius;
      indicator.style.clipPath = "none";
      const transform = (rect: { x: number; y: number; width: number; height: number }) => `translate(${rect.x}px,${rect.y}px) scale(${rect.width/next.width},${rect.height/next.height})`;
      indicator.style.transform = transform(next);
      previous.current = next;
      if (!from || last?.target === target || media.matches || !indicator.animate || target.querySelector<HTMLInputElement>("input")?.disabled) return;
      // 有限的小面积裁剪轮廓由浏览器插值，避免模糊滤镜和逐帧布局测量。
      const shapes=Array.from({length:33},(_,index)=>{
        const p=index/32,progress=p*p*(3-2*p),shape=radioFluidShape(from,next,progress);
        const blend=Math.min(1,p/.25);
        return initialShape ? shape.map(([x,y],i)=>[initialShape![i][0]+(x-initialShape![i][0])*blend,initialShape![i][1]+(y-initialShape![i][1])*blend] as FluidPoint) : shape;
      });
      const points=shapes.flat(),origin={x:Math.min(...points.map(p=>p[0])),y:Math.min(...points.map(p=>p[1]))};
      indicator.style.width=`${Math.max(...points.map(p=>p[0]))-origin.x}px`;
      indicator.style.height=`${Math.max(...points.map(p=>p[1]))-origin.y}px`;
      indicator.style.transform=`translate(${origin.x}px,${origin.y}px)`;
      indicator.style.borderRadius="0";
      root.dataset.siaRadioMoving = "";
      // 两个方向共用 280ms 时间轴，保持轮廓和各阶段比例一致。
      const running = indicator.animate(shapes.map((shape,index)=>({clipPath:radioFluidPath(shape,origin),offset:index/32})), { duration: 280, easing: "linear", fill: "both" });
      animation.current = running;
      flowing.current={animation:running,shapes};
      running.finished.then(() => {
        if (animation.current !== running) return;
        indicator.style.width=`${next.width}px`;indicator.style.height=`${next.height}px`;
        indicator.style.transform=transform(next);indicator.style.borderRadius=getComputedStyle(target).borderRadius;
        running.cancel(); animation.current = undefined; flowing.current=undefined; delete root.dataset.siaRadioMoving;
      }, () => {});
    };
    const schedule = () => { if (!frame) frame = requestAnimationFrame(() => { frame = 0; update(); }); };
    const reduce = () => { animation.current?.cancel(); flowing.current=undefined; previous.current=undefined; delete root.dataset.siaRadioMoving; update(); };
    update();
    const observer = new ResizeObserver(schedule);
    observer.observe(root); root.querySelectorAll(":scope > .sia-radio").forEach(label => observer.observe(label));
    media.addEventListener("change", reduce);
    return () => { observer.disconnect(); cancelAnimationFrame(frame); media.removeEventListener("change", reduce); };
  });
  useLayoutEffect(() => {
    const root = rootRef.current ?? indicatorRef.current?.parentElement;
    return () => {
      animation.current?.cancel();
      if (root) { delete root.dataset.siaRadioMotion; delete root.dataset.siaRadioMoving; }
    };
  }, [rootRef]);
  return <span ref={indicatorRef} className="sia-radio-group__selection" aria-hidden="true" />;
}
