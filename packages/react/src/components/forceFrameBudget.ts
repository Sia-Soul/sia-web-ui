/** A 60 Hz simulation clock; cap catch-up after a suspended browser tab. */
export function forceFrameBudget(carry:number,elapsed:number,remaining:number,stepsPerFrame=1){
 const interval=1000/60;
 const batch=Number.isFinite(stepsPerFrame)?Math.max(1,Math.floor(stepsPerFrame)):1;
 const available=Math.max(0,Number.isFinite(remaining)?Math.floor(remaining):0);
 const accumulated=Math.max(0,Number.isFinite(carry)?carry:0)+Math.min(100,Math.max(0,Number.isFinite(elapsed)?elapsed:0));
 const frames=Math.floor((accumulated+1e-9)/interval);
 const steps=Math.min(frames*batch,available);
 return {steps,carry:Math.max(0,accumulated-frames*interval),remaining:available-steps};
}
