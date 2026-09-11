export const wormholeIndicators=['IE8-','IE9+','Safari','Firefox','Chrome'].map(name=>({name,max:400}));
// The original requests 28 intervals, producing 29 colors; its 28 series use the first 28.
let green=255;
export const wormholeSeries=Array.from({length:28},(_,index)=>{
 const i=index+1;
 const color=`rgb(255,${Math.floor(green)},0)`;green-=255/28;
 return {name:String(2000+i),data:[(40-i)*10,(38-i)*4+60,i*5+10,i*9,i*i/2],color,areaOpacity:0,lineWidth:1,showPoints:false,emphasisAreaColor:'rgba(0,250,0,0.3)'};
});
