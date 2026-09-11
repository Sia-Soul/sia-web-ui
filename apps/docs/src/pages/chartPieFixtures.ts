import type { PieChartProps } from "@sia-ui/react";

// Static original data only; no downloaded configuration or callback is executed.
export interface PieReferenceFixture extends Omit<PieChartProps,"toolbox"> { magicTypes:string[]; gaps:string[]; frames?:readonly {label:string;series:NonNullable<PieChartProps["series"]>}[] }
export const chartPieFixtures:Record<string,PieReferenceFixture> = {
  "pie1": {
    "title": "某站点用户访问来源",
    "description": "纯属虚构",
    "titleAlign": "center",
    "center": [
      331.5,
      189.5
    ],
    "innerRadius": 0,
    "legendLayout": {
      "x": 5,
      "y": 14,
      "orientation": "vertical",
      "align": "start",
      "itemGap": 12
    },
    "magicTypes": [
      "pie",
      "funnel"
    ],
    "gaps": [
      "标签避让和提示框布局仍待逐像素校正",
      "扇区更新、工具箱及切换漏斗的完整行为待验收",
      "动画逐帧对比及原站可计算拖拽尚未完成"
    ],
    "series": [
      {
        "name": "访问来源",
        "data": [
          {
            "name": "直接访问",
            "value": 335
          },
          {
            "name": "邮件营销",
            "value": 310
          },
          {
            "name": "联盟广告",
            "value": 234
          },
          {
            "name": "视频广告",
            "value": 135
          },
          {
            "name": "搜索引擎",
            "value": 1548
          }
        ],
        "innerRadius": 0,
        "outerRadius": 104.22500000000001,
        "center": [
          331.5,
          227.4
        ],
        "selectedMode": false,
        "showLabels": true,
        "labelPosition": "outside"
      }
    ]
  },
  "pie2": {
    "titleAlign": "center",
    "center": [
      331.5,
      189.5
    ],
    "innerRadius": 0,
    "legendLayout": {
      "x": 5,
      "y": 14,
      "orientation": "vertical",
      "align": "start",
      "itemGap": 12
    },
    "magicTypes": [
      "pie",
      "funnel"
    ],
    "gaps": [
      "标签避让和提示框布局仍待逐像素校正",
      "扇区更新、工具箱及切换漏斗的完整行为待验收",
      "动画逐帧对比及原站可计算拖拽尚未完成"
    ],
    "series": [
      {
        "name": "访问来源",
        "data": [
          {
            "name": "直接访问",
            "value": 335
          },
          {
            "name": "邮件营销",
            "value": 310
          },
          {
            "name": "联盟广告",
            "value": 234
          },
          {
            "name": "视频广告",
            "value": 135
          },
          {
            "name": "搜索引擎",
            "value": 1548
          }
        ],
        "innerRadius": 94.75,
        "outerRadius": 132.65,
        "selectedMode": false,
        "showLabels": false,
        "labelPosition": "outside",
        "emphasisLabel": "center"
      }
    ]
  },
  "pie3": {
    "titleAlign": "center",
    "center": [
      331.5,
      189.5
    ],
    "innerRadius": 0,
    "legendLayout": {
      "x": 5,
      "y": 14,
      "orientation": "vertical",
      "align": "start",
      "itemGap": 12
    },
    "magicTypes": [
      "pie",
      "funnel"
    ],
    "gaps": [
      "标签避让和提示框布局仍待逐像素校正",
      "扇区更新、工具箱及切换漏斗的完整行为待验收",
      "动画逐帧对比及原站可计算拖拽尚未完成"
    ],
    "series": [
      {
        "name": "访问来源",
        "data": [
          {
            "name": "直达",
            "value": 335
          },
          {
            "name": "营销广告",
            "value": 679
          },
          {
            "name": "搜索引擎",
            "value": 1548,
            "selected": true
          }
        ],
        "innerRadius": 0,
        "outerRadius": 70,
        "selectedMode": "single",
        "showLabels": true,
        "labelPosition": "inside"
      },
      {
        "name": "访问来源",
        "data": [
          {
            "name": "直达",
            "value": 335
          },
          {
            "name": "邮件营销",
            "value": 310
          },
          {
            "name": "联盟广告",
            "value": 234
          },
          {
            "name": "视频广告",
            "value": 135
          },
          {
            "name": "百度",
            "value": 1048
          },
          {
            "name": "谷歌",
            "value": 251
          },
          {
            "name": "必应",
            "value": 147
          },
          {
            "name": "其他",
            "value": 102
          }
        ],
        "innerRadius": 100,
        "outerRadius": 140,
        "selectedMode": false,
        "showLabels": true,
        "labelPosition": "outside"
      }
    ]
  },
  "pie4": {
    "title": "南丁格尔玫瑰图",
    "description": "纯属虚构",
    "titleAlign": "center",
    "center": [
      331.5,
      189.5
    ],
    "innerRadius": 0,
    "legendLayout": {
      "x": 331.5,
      "y": 365,
      "orientation": "horizontal",
      "align": "center",
      "itemGap": 12
    },
    "magicTypes": [
      "pie",
      "funnel"
    ],
    "gaps": [
      "标签避让和提示框布局仍待逐像素校正",
      "扇区更新、工具箱及切换漏斗的完整行为待验收",
      "动画逐帧对比及原站可计算拖拽尚未完成"
    ],
    "series": [
      {
        "name": "半径模式",
        "data": [
          {
            "name": "rose1",
            "value": 10
          },
          {
            "name": "rose2",
            "value": 5
          },
          {
            "name": "rose3",
            "value": 15
          },
          {
            "name": "rose4",
            "value": 25
          },
          {
            "name": "rose5",
            "value": 20
          },
          {
            "name": "rose6",
            "value": 35
          },
          {
            "name": "rose7",
            "value": 30
          },
          {
            "name": "rose8",
            "value": 40
          }
        ],
        "innerRadius": 20,
        "outerRadius": 110,
        "center": [
          165.75,
          200
        ],
        "rose": "radius",
        "selectedMode": false,
        "showLabels": false,
        "labelPosition": "outside",
        "emphasisLabel": "outside"
      },
      {
        "name": "面积模式",
        "data": [
          {
            "name": "rose1",
            "value": 10
          },
          {
            "name": "rose2",
            "value": 5
          },
          {
            "name": "rose3",
            "value": 15
          },
          {
            "name": "rose4",
            "value": 25
          },
          {
            "name": "rose5",
            "value": 20
          },
          {
            "name": "rose6",
            "value": 35
          },
          {
            "name": "rose7",
            "value": 30
          },
          {
            "name": "rose8",
            "value": 40
          }
        ],
        "innerRadius": 30,
        "outerRadius": 110,
        "center": [
          497.25,
          200
        ],
        "rose": "area",
        "selectedMode": false,
        "showLabels": true,
        "labelPosition": "outside"
      }
    ]
  },
  "pie5": {
    "title": "The App World",
    "description": "from global web index",
    "titleAlign": "center",
    "center": [
      331.5,
      189.5
    ],
    "innerRadius": 0,
    "legendLayout": {
      "x": 331.5,
      "y": 189.5,
      "orientation": "horizontal",
      "align": "center",
      "itemGap": 12
    },
    "magicTypes": [
      "pie",
      "funnel"
    ],
    "gaps": [
      "标签避让和提示框布局仍待逐像素校正",
      "扇区更新、工具箱及切换漏斗的完整行为待验收",
      "动画逐帧对比及原站可计算拖拽尚未完成"
    ],
    "series": [
      {
        "name": "GoogleMaps",
        "data": [
          {
            "name": "other",
            "value": 46,
            "color": "#ccc",
            "showInLegend": false,
            "interactive": true
          },
          {
            "name": "GoogleMaps",
            "value": 54
          }
        ],
        "innerRadius": 40,
        "outerRadius": 55,
        "center": [
          66.3,
          113.7
        ],
        "selectedMode": false,
        "showLabels": false,
        "labelPosition": "outside"
      },
      {
        "name": "Facebook",
        "data": [
          {
            "name": "other",
            "value": 56,
            "color": "#ccc",
            "showInLegend": false,
            "interactive": true
          },
          {
            "name": "Facebook",
            "value": 44
          }
        ],
        "innerRadius": 40,
        "outerRadius": 55,
        "center": [
          198.9,
          113.7
        ],
        "selectedMode": false,
        "showLabels": false,
        "labelPosition": "outside"
      },
      {
        "name": "Youtube",
        "data": [
          {
            "name": "other",
            "value": 65,
            "color": "#ccc",
            "showInLegend": false,
            "interactive": true
          },
          {
            "name": "Youtube",
            "value": 35
          }
        ],
        "innerRadius": 40,
        "outerRadius": 55,
        "center": [
          331.5,
          113.7
        ],
        "selectedMode": false,
        "showLabels": false,
        "labelPosition": "outside"
      },
      {
        "name": "Google+",
        "data": [
          {
            "name": "other",
            "value": 70,
            "color": "#ccc",
            "showInLegend": false,
            "interactive": true
          },
          {
            "name": "Google+",
            "value": 30
          }
        ],
        "innerRadius": 40,
        "outerRadius": 55,
        "center": [
          464.09999999999997,
          113.7
        ],
        "selectedMode": false,
        "showLabels": false,
        "labelPosition": "outside"
      },
      {
        "name": "Weixin",
        "data": [
          {
            "name": "other",
            "value": 73,
            "color": "#ccc",
            "showInLegend": false,
            "interactive": true
          },
          {
            "name": "Weixin",
            "value": 27
          }
        ],
        "innerRadius": 40,
        "outerRadius": 55,
        "center": [
          596.7,
          113.7
        ],
        "selectedMode": false,
        "showLabels": false,
        "labelPosition": "outside"
      },
      {
        "name": "Twitter",
        "data": [
          {
            "name": "other",
            "value": 78,
            "color": "#ccc",
            "showInLegend": false,
            "interactive": true
          },
          {
            "name": "Twitter",
            "value": 22
          }
        ],
        "innerRadius": 40,
        "outerRadius": 55,
        "center": [
          66.3,
          265.3
        ],
        "selectedMode": false,
        "showLabels": false,
        "labelPosition": "outside"
      },
      {
        "name": "Skype",
        "data": [
          {
            "name": "other",
            "value": 78,
            "color": "#ccc",
            "showInLegend": false,
            "interactive": true
          },
          {
            "name": "Skype",
            "value": 22
          }
        ],
        "innerRadius": 40,
        "outerRadius": 55,
        "center": [
          198.9,
          265.3
        ],
        "selectedMode": false,
        "showLabels": false,
        "labelPosition": "outside"
      },
      {
        "name": "Messenger",
        "data": [
          {
            "name": "other",
            "value": 78,
            "color": "#ccc",
            "showInLegend": false,
            "interactive": true
          },
          {
            "name": "Messenger",
            "value": 22
          }
        ],
        "innerRadius": 40,
        "outerRadius": 55,
        "center": [
          331.5,
          265.3
        ],
        "selectedMode": false,
        "showLabels": false,
        "labelPosition": "outside"
      },
      {
        "name": "Whatsapp",
        "data": [
          {
            "name": "other",
            "value": 83,
            "color": "#ccc",
            "showInLegend": false,
            "interactive": true
          },
          {
            "name": "Whatsapp",
            "value": 17
          }
        ],
        "innerRadius": 40,
        "outerRadius": 55,
        "center": [
          464.09999999999997,
          265.3
        ],
        "selectedMode": false,
        "showLabels": false,
        "labelPosition": "outside"
      },
      {
        "name": "Instagram",
        "data": [
          {
            "name": "other",
            "value": 89,
            "color": "#ccc",
            "showInLegend": false,
            "interactive": true
          },
          {
            "name": "Instagram",
            "value": 11
          }
        ],
        "innerRadius": 40,
        "outerRadius": 55,
        "center": [
          596.7,
          265.3
        ],
        "selectedMode": false,
        "showLabels": false,
        "labelPosition": "outside"
      }
    ]
  },
  "pie6": {
    "titleAlign": "center",
    "center": [
      331.5,
      189.5
    ],
    "innerRadius": 0,
    "legendLayout": {
      "x": 331.5,
      "y": 45,
      "orientation": "vertical",
      "align": "start",
      "itemGap": 12
    },
    "magicTypes": [],
    "gaps": [
      "标签避让和提示框布局仍待逐像素校正",
      "扇区更新、工具箱及切换漏斗的完整行为待验收",
      "动画逐帧对比及原站可计算拖拽尚未完成"
    ],
    "series": [
      {
        "name": "1",
        "data": [
          {
            "name": "68%的人表示过的不错",
            "value": 68
          },
          {
            "name": "invisible",
            "value": 32,
            "color": "transparent",
            "showInLegend": false,
            "interactive": false
          }
        ],
        "innerRadius": 125,
        "outerRadius": 150,
        "clockwise": false,
        "selectedMode": false,
        "showLabels": false,
        "labelPosition": "outside"
      },
      {
        "name": "2",
        "data": [
          {
            "name": "29%的人表示生活压力很大",
            "value": 29
          },
          {
            "name": "invisible",
            "value": 71,
            "color": "transparent",
            "showInLegend": false,
            "interactive": false
          }
        ],
        "innerRadius": 100,
        "outerRadius": 125,
        "clockwise": false,
        "selectedMode": false,
        "showLabels": false,
        "labelPosition": "outside"
      },
      {
        "name": "3",
        "data": [
          {
            "name": "3%的人表示“我姓曾”",
            "value": 3
          },
          {
            "name": "invisible",
            "value": 97,
            "color": "transparent",
            "showInLegend": false,
            "interactive": false
          }
        ],
        "innerRadius": 75,
        "outerRadius": 100,
        "clockwise": false,
        "selectedMode": false,
        "showLabels": false,
        "labelPosition": "outside"
      }
    ]
  }
};
// pie7 initializes idx=1, then advances it once for each monthly snapshot.
chartPieFixtures.pie7 = {"title":"浏览器占比变化","description":"纯属虚构","titleAlign":"left","legendLayout":{"x":331.5,"y":14,"itemGap":10},"magicTypes":["pie","funnel"],"series":[{"name":"浏览器（数据纯属虚构）","center":[331.5,170.55],"innerRadius":0,"outerRadius":94.75,"data":[{"name":"Chrome","value":208},{"name":"Firefox","value":224},{"name":"Safari","value":352},{"name":"IE9+","value":656},{"name":"IE8-","value":1288}]}],"frames":[{"label":"2013-01","series":[{"name":"浏览器（数据纯属虚构）","center":[331.5,170.55],"innerRadius":0,"outerRadius":94.75,"data":[{"name":"Chrome","value":208},{"name":"Firefox","value":224},{"name":"Safari","value":352},{"name":"IE9+","value":656},{"name":"IE8-","value":1288}]}]},{"label":"2013-02","series":[{"name":"浏览器（数据纯属虚构）","center":[331.5,170.55],"innerRadius":0,"outerRadius":94.75,"data":[{"name":"Chrome","value":336},{"name":"Firefox","value":288},{"name":"Safari","value":384},{"name":"IE9+","value":672},{"name":"IE8-","value":1296}]}]},{"label":"2013-03","series":[{"name":"浏览器（数据纯属虚构）","center":[331.5,170.55],"innerRadius":0,"outerRadius":94.75,"data":[{"name":"Chrome","value":464},{"name":"Firefox","value":352},{"name":"Safari","value":416},{"name":"IE9+","value":688},{"name":"IE8-","value":1304}]}]},{"label":"2013-04","series":[{"name":"浏览器（数据纯属虚构）","center":[331.5,170.55],"innerRadius":0,"outerRadius":94.75,"data":[{"name":"Chrome","value":592},{"name":"Firefox","value":416},{"name":"Safari","value":448},{"name":"IE9+","value":704},{"name":"IE8-","value":1312}]}]},{"label":"2013-05","series":[{"name":"浏览器（数据纯属虚构）","center":[331.5,170.55],"innerRadius":0,"outerRadius":94.75,"data":[{"name":"Chrome","value":720},{"name":"Firefox","value":480},{"name":"Safari","value":480},{"name":"IE9+","value":720},{"name":"IE8-","value":1320}]}]},{"label":"2013-06","series":[{"name":"浏览器（数据纯属虚构）","center":[331.5,170.55],"innerRadius":0,"outerRadius":94.75,"data":[{"name":"Chrome","value":848},{"name":"Firefox","value":544},{"name":"Safari","value":512},{"name":"IE9+","value":736},{"name":"IE8-","value":1328}]}]},{"label":"2013-07","series":[{"name":"浏览器（数据纯属虚构）","center":[331.5,170.55],"innerRadius":0,"outerRadius":94.75,"data":[{"name":"Chrome","value":976},{"name":"Firefox","value":608},{"name":"Safari","value":544},{"name":"IE9+","value":752},{"name":"IE8-","value":1336}]}]},{"label":"2013-08","series":[{"name":"浏览器（数据纯属虚构）","center":[331.5,170.55],"innerRadius":0,"outerRadius":94.75,"data":[{"name":"Chrome","value":1104},{"name":"Firefox","value":672},{"name":"Safari","value":576},{"name":"IE9+","value":768},{"name":"IE8-","value":1344}]}]},{"label":"2013-09","series":[{"name":"浏览器（数据纯属虚构）","center":[331.5,170.55],"innerRadius":0,"outerRadius":94.75,"data":[{"name":"Chrome","value":1232},{"name":"Firefox","value":736},{"name":"Safari","value":608},{"name":"IE9+","value":784},{"name":"IE8-","value":1352}]}]},{"label":"2013-10","series":[{"name":"浏览器（数据纯属虚构）","center":[331.5,170.55],"innerRadius":0,"outerRadius":94.75,"data":[{"name":"Chrome","value":1360},{"name":"Firefox","value":800},{"name":"Safari","value":640},{"name":"IE9+","value":800},{"name":"IE8-","value":1360}]}]},{"label":"2013-11","series":[{"name":"浏览器（数据纯属虚构）","center":[331.5,170.55],"innerRadius":0,"outerRadius":94.75,"data":[{"name":"Chrome","value":1488},{"name":"Firefox","value":864},{"name":"Safari","value":672},{"name":"IE9+","value":816},{"name":"IE8-","value":1368}]}]},{"label":"2013-12","series":[{"name":"浏览器（数据纯属虚构）","center":[331.5,170.55],"innerRadius":0,"outerRadius":94.75,"data":[{"name":"Chrome","value":1616},{"name":"Firefox","value":928},{"name":"Safari","value":704},{"name":"IE9+","value":832},{"name":"IE8-","value":1376}]}]}],"gaps":["时间轴节点、星形标记及布局尚未与原站一致","标签避让、漏斗切换配置及逐帧更新动画待验收"]};
