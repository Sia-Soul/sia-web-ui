/** Shared by sidebar, routes, galleries and future reference registrations. */
export const chartCategories = [
 ["line","折线与面积图"],["bar","柱状与条形图"],["scatter","散点与气泡图"],["k","K 线图"],
 ["pie","饼图、环图与玫瑰图"],["radar","雷达图"],["chord","和弦图"],["force","力导向图"],
 ["map","地图"],["gauge","仪表盘"],["funnel","漏斗与金字塔"],["heatmap","热力图"],
 ["eventriver","事件与主题河流"],["venn","韦恩图"],["treemap","矩形树图"],["tree","树图"],
 ["wordcloud","字符云"],["mix","混搭图"],["components","坐标轴与辅助组件"],
 ["dynamic","动态、事件与主题"],["topics","专题与扩展示例"],
].map(([id,title])=>({id:id!,title:title!,path:`/components/chart/${id}`}));

export function chartCategoryForUrl(url:string):string {
 const path=new URL(url).pathname;
 if(path.includes("/extension/BMap/"))return "map";
 if(/\/topic\//.test(path))return "topics";
 const id=path.split("/").at(-1)!.replace(/\.html$/,"").toLowerCase();
 if(id==="lasagna")return "pie";
 if(id==="wormhole")return "radar";
 if(id==="datarange1")return "scatter";
 if(/^(dynamic|loading)/.test(id)||["event","theme"].includes(id)||/\/www2?\//.test(path))return "dynamic";
 for(const prefix of ["eventriver","wordcloud","treemap","heatmap","scatter","funnel","gauge","radar","chord","force","tree","line","bar","pie","map","venn","mix","k"]){
  if(new RegExp(`^${prefix}(?:\\d+)?$`).test(id))return prefix;
 }
 if(id==="heatmap_map")return "heatmap";
 return "components";
}
