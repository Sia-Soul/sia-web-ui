/** Local-calendar aligned ticks; endpoints are retained for a partially visible interval. */
export function chartTimeTicks(domain:readonly [number,number],splitNumber=10):number[]{
 const [start,end]=domain;
 if(!Number.isFinite(start)||!Number.isFinite(end)||end<start)return [];
 if(end===start)return [start];
 const target=(end-start)/Math.max(1,splitNumber);
 const intervals=[1000,5000,10000,30000,60000,300000,600000,1800000,3600000,7200000,10800000,21600000,43200000,86400000];
 const interval=intervals.reduce((a,b)=>Math.abs(b-target)<Math.abs(a-target)?b:a);
 const cursor=new Date(start);
 if(target>86400000*20){cursor.setDate(1);cursor.setHours(0,0,0,0);}
 else if(interval===86400000){cursor.setHours(0,0,0,0);}
 else if(interval>=3600000){cursor.setHours(Math.floor(cursor.getHours()/(interval/3600000))*(interval/3600000),0,0,0);}
 else if(interval>=60000){cursor.setMinutes(Math.floor(cursor.getMinutes()/(interval/60000))*(interval/60000),0,0);}
 else {cursor.setSeconds(Math.floor(cursor.getSeconds()/(interval/1000))*(interval/1000),0);}
 const result=[start];
 for(let i=0;i<1000;i++){
  if(target>86400000*20)cursor.setMonth(cursor.getMonth()+Math.max(1,Math.round(target/(86400000*30))));
  else if(interval===86400000)cursor.setDate(cursor.getDate()+Math.max(1,Math.round(target/86400000)));
  else cursor.setTime(cursor.getTime()+interval);
  const value=cursor.getTime();if(value>=end)break;
  if(value>start)result.push(value);
 }
 result.push(end);return result;
}
