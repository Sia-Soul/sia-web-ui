export function svgArcPath(cx: number, cy: number, outerRadius: number, startAngle: number, endAngle: number, innerRadius = 0, clockwise = true) {
  if (![cx,cy,outerRadius,innerRadius,startAngle,endAngle].every(Number.isFinite) || outerRadius<=0 || Math.abs(endAngle-startAngle)<1e-12) return "";
  innerRadius=Math.max(0,Math.min(innerRadius,outerRadius));
  const polar = (radius: number, angle: number) => ({ x: cx + Math.cos(angle) * radius, y: cy + Math.sin(angle) * radius });
  const outerStart = polar(outerRadius, startAngle);
  const outerEnd = polar(outerRadius, endAngle);
  const largeArc = Math.abs(endAngle - startAngle) > Math.PI ? 1 : 0;
  const sweep = clockwise ? 1 : 0;
  // A single SVG arc whose endpoints coincide cannot describe a full circle.
  if (Math.abs(endAngle-startAngle)>=Math.PI*2-1e-9) {
    const opposite=polar(outerRadius,startAngle+Math.PI);
    const outside=`M ${outerStart.x} ${outerStart.y} A ${outerRadius} ${outerRadius} 0 1 ${sweep} ${opposite.x} ${opposite.y} A ${outerRadius} ${outerRadius} 0 1 ${sweep} ${outerStart.x} ${outerStart.y} Z`;
    if(innerRadius<=0)return outside;
    const insideStart=polar(innerRadius,startAngle),insideOpposite=polar(innerRadius,startAngle+Math.PI);
    return outside+` M ${insideStart.x} ${insideStart.y} A ${innerRadius} ${innerRadius} 0 1 ${1-sweep} ${insideOpposite.x} ${insideOpposite.y} A ${innerRadius} ${innerRadius} 0 1 ${1-sweep} ${insideStart.x} ${insideStart.y} Z`;
  }
  if (innerRadius <= 0) return `M ${cx} ${cy} L ${outerStart.x} ${outerStart.y} A ${outerRadius} ${outerRadius} 0 ${largeArc} ${sweep} ${outerEnd.x} ${outerEnd.y} Z`;
  const innerEnd = polar(innerRadius, endAngle);
  const innerStart = polar(innerRadius, startAngle);
  return `M ${outerStart.x} ${outerStart.y} A ${outerRadius} ${outerRadius} 0 ${largeArc} ${sweep} ${outerEnd.x} ${outerEnd.y} L ${innerEnd.x} ${innerEnd.y} A ${innerRadius} ${innerRadius} 0 ${largeArc} ${clockwise ? 0 : 1} ${innerStart.x} ${innerStart.y} Z`;
}
