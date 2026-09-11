/** Calendar tick policy for the 2.x reference pages. Endpoints retain their actual time. */
export function calendarReferenceTicks(domain:readonly [number,number],splitNumber=5){
 const [min,max]=domain;
 if(!Number.isFinite(min)||!Number.isFinite(max)||max<min)return [];
 const day=86400000;
 const intervals=[1000,5000,10000,15000,30000,60000,300000,600000,900000,1800000,3600000,7200000,21600000,43200000,day,day*7,day*31,day*95,day*190,day*380];
 const count=splitNumber>1?splitNumber:2;
 let index=intervals.findIndex(gap=>Math.round(Math.ceil(max/gap)-Math.floor(min/gap))<=count*1.2);
 let gap=index>=0?intervals[index]!:Math.round((Math.ceil(max/(day*367))-Math.floor(min/(day*367)))/(count-1))*day*367;
 if(index<0)index=19;
 gap=Math.max(1000,gap);
 const cursor=new Date(min);
 if(index===15)cursor.setDate(cursor.getDate()+8-cursor.getDay());
 else if(index>=16){const months=[1,3,6,12][index-16]!;cursor.setMonth(Math.ceil((cursor.getMonth()+1)/months)*months);cursor.setDate(1);}
 else if(gap<=7200000)cursor.setTime((Math.floor(min/gap)+1)*gap);
 else {cursor.setTime(min+gap);cursor.setHours(Math.round(cursor.getHours()/6)*6);cursor.setMinutes(0);cursor.setSeconds(0);}
 if(cursor.getTime()-min<gap/2)cursor.setTime(cursor.getTime()+gap);
 const values=[min];
 for(let remaining=Math.min(1000,count*1.5);remaining-->=0;){
  if(index>=16)cursor.setDate(1);
  const value=cursor.getTime();if(max-value<gap/2)break;
  if(value>min&&value<max)values.push(value);
  cursor.setTime(value+gap);
 }
 if(max!==min)values.push(max);
 const pad=(value:number)=>String(value).padStart(2,'0');
 return values.map(value=>{const date=new Date(value),monthDay=`${pad(date.getMonth()+1)} - ${pad(date.getDate())}`,clock=`${pad(date.getHours())} : ${pad(date.getMinutes())}`;return {value,label:index<5?`${clock} : ${pad(date.getSeconds())}`:index<14?`${clock}\n${monthDay}`:`${monthDay}\n${date.getFullYear()}`};});
}
