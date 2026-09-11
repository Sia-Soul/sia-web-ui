import assert from 'node:assert/strict';
import test from 'node:test';
import {createBaiduMapHost} from './baiduMapHost.ts';
import type {BaiduMapInstance,BaiduMapNamespace} from './baiduMapHost.ts';

function fixture(failStyle=false){
 const calls:unknown[]=[];const listeners=new Map<string,()=>void>();let scale=1;
 class Point {lng:number;lat:number;constructor(lng:number,lat:number){this.lng=lng;this.lat=lat;}}
 class MapHost implements BaiduMapInstance {
  constructor(_element:HTMLElement,options:unknown){calls.push(['create',options]);}
  centerAndZoom(p:Point,z:number){calls.push(['center',p.lng,p.lat,z]);}
  enableScrollWheelZoom(){calls.push('wheel-on');}
  disableScrollWheelZoom(){calls.push('wheel-off');}
  disableDragging(){calls.push('drag-off');}
  disableAutoResize(){calls.push('resize-off');}
  clearOverlays(){calls.push('clear');}
  getSize(){return {width:800,height:500};}
  pointToPixel(p:Point){return {x:p.lng*scale,y:p.lat*scale};}
  setMapStyle(s:unknown){calls.push(['style',s]);if(failStyle)throw Error('style failed');}
  addEventListener(e:string,f:()=>void){listeners.set(e,f);}
  removeEventListener(e:string,f:()=>void){assert.equal(listeners.get(e),f);listeners.delete(e);}
 }
 const sdk:BaiduMapNamespace={Map:MapHost,Point};
 const element={replaceChildren:()=>calls.push('empty')} as unknown as HTMLElement;
 return {sdk,element,calls,listeners,setScale:(n:number)=>{scale=n;}};
}
test('百度适配器传递原中心/缩放/样式，投影读取最新视口，正确移除监听',()=>{
 const f=fixture();let refreshed=0,released=0;
 const styles=[{featureType:'water',stylers:{color:'#044161'}}];
 const host=createBaiduMapHost(f.element,f.sdk,{center:[104.114129,37.550339],zoom:5,styleJson:styles,releaseMap:()=>{released++;}});
 assert.deepEqual(f.calls.slice(0,4),[['create',{enableMapClick:false}],['center',104.114129,37.550339,5],'wheel-on',['style',{styleJson:styles}]]);
 const snapshot=host.snapshot();assert.deepEqual([snapshot.width,snapshot.height],[800,500]);assert.equal(snapshot.offset,undefined);
 assert.deepEqual(snapshot.project([10,20]),[10,20]);f.setScale(2);assert.deepEqual(snapshot.project([10,20]),[20,40]);
 const off=host.subscribe('moving',()=>{refreshed++;});const late=f.listeners.get('moving')!;late();assert.equal(refreshed,1);off();off();assert.equal(f.listeners.size,0);
 host.subscribe('zoomend',()=>{refreshed++;});host.destroy();host.destroy();late();
 assert.equal(refreshed,1);assert.equal(released,1);assert.equal(f.listeners.size,0);
 assert.deepEqual(f.calls.slice(-5),['wheel-off','drag-off','resize-off','clear','empty']);
 assert.throws(()=>snapshot.project([0,0]),/已释放/);
});
test('样式初始化失败仍关闭宿主功能并清理 DOM；非法坐标不创建地图',()=>{
 const f=fixture(true);assert.throws(()=>createBaiduMapHost(f.element,f.sdk,{center:[1,2],zoom:5,styleJson:[]}),/style failed/);
 assert.deepEqual(f.calls.slice(-5),['wheel-off','drag-off','resize-off','clear','empty']);
 const g=fixture();assert.throws(()=>createBaiduMapHost(g.element,g.sdk,{center:[NaN,2],zoom:5}),RangeError);assert.equal(g.calls.length,0);
});
