import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { chartMotionBaseline, interpolateChartPoints } from "./chartMotion";
import type { ChartMotionPoint as Point } from "./chartMotion";

/** Animate actual coordinates; interrupted updates continue from the displayed frame. */
export function ChartPointMotion({ points, enabled, duration, updateDuration = 500, animateInitial = true, easing = 'linear', progress, horizontal = false, origin, children }: {
  points: readonly Point[];
  enabled: boolean;
  duration: number;
  updateDuration?: number;
  /** Start at final coordinates while retaining animated subsequent updates. */
  animateInitial?: boolean;
  easing?: 'linear' | 'exponential-out';
  progress?: number;
  horizontal?: boolean;
  origin?: Point;
  children: (points: readonly Point[]) => ReactNode;
}) {
  const baseline = (target: readonly Point[]) => origin ? target.map(()=>origin) : chartMotionBaseline(target, horizontal);
  const [frame, setFrame] = useState<readonly Point[]>(() => enabled && animateInitial ? baseline(points) : points);
  const displayed = useRef(frame);
  const initialized = useRef(!animateInitial);
  const signature = JSON.stringify(points);
  useEffect(() => {
    // JSON is a dependency key only: parsing it would turn missing NaN coordinates into zero-like nulls.
    const target = points;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (!enabled || progress != null || reduced.matches) {
      displayed.current = progress != null ? interpolateChartPoints(baseline(target), target, progress) : target;
      setFrame(displayed.current);
      return;
    }
    const from = initialized.current ? displayed.current : baseline(target);
    const milliseconds = initialized.current ? updateDuration : duration;
    let request = 0;
    const started = performance.now();
    const finish = () => { cancelAnimationFrame(request); displayed.current = target; setFrame(target); };
    const tick = (now: number) => {
      // StrictMode replays the effect before the first RAF. It must not turn a
      // fresh 2000 ms entrance into a 500 ms data update.
      initialized.current = true;
      const t = milliseconds <= 0 ? 1 : Math.min(1, (now - started) / milliseconds);
      const eased=easing==='exponential-out'&&t<1?1-Math.pow(2,-10*t):t;
      displayed.current = interpolateChartPoints(from, target, eased);
      setFrame(displayed.current);
      if (t < 1) request = requestAnimationFrame(tick);
    };
    request = requestAnimationFrame(tick);
    reduced.addEventListener("change", finish);
    return () => { cancelAnimationFrame(request); reduced.removeEventListener("change", finish); };
  }, [signature, enabled, duration, updateDuration, easing, progress, horizontal, origin?.[0], origin?.[1]]);
  const shown = progress != null ? interpolateChartPoints(baseline(points), points, progress) : enabled ? frame : points;
  return <>{children(shown)}</>;
}
