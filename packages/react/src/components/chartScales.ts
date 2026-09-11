/** Logarithmic axes support either a positive domain or an entirely negative one. */
export function logarithmicScale(value: number, domain: readonly [number, number], range: readonly [number, number]) {
  const negative = domain[1] < 0;
  const clamped = Math.max(domain[0],Math.min(domain[1],value));
  const transform = (n: number) => (negative ? -1 : 1)*Math.log(Math.abs(n));
  const start = transform(domain[0]);
  const end = transform(domain[1]);
  return range[0]+(transform(clamped)-start)/(end-start)*(range[1]-range[0]);
}

export function logarithmicTicks(domain: readonly [number, number], base = 10, exponentStep = 1) {
  if (base <= 1 || exponentStep <= 0 || domain[0] === 0 || domain[1] === 0 || Math.sign(domain[0]) !== Math.sign(domain[1])) return [];
  const negative = domain[1] < 0;
  const minimum = Math.min(Math.abs(domain[0]),Math.abs(domain[1]));
  const maximum = Math.max(Math.abs(domain[0]),Math.abs(domain[1]));
  const count = Math.min(100,Math.floor(Math.log(maximum/minimum)/Math.log(base)/exponentStep+1e-8)+1);
  const ticks = Array.from({length:count},(_,i)=>(negative ? -1 : 1)*minimum*base**(i*exponentStep));
  return negative ? ticks.reverse() : ticks;
}

export function logarithmicValueAt(progress: number, domain: readonly [number, number]) {
  const sign = domain[1] < 0 ? -1 : 1;
  const start=sign*Math.log(Math.abs(domain[0]));
  const end=sign*Math.log(Math.abs(domain[1]));
  return sign*Math.exp(sign*(start+Math.max(0,Math.min(1,progress))*(end-start)));
}
