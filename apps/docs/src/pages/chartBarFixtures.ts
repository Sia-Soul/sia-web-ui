import type { BarChartProps } from "@sia-ui/react";


// 原始数据来源：ECharts 2.2.7 示例页。这里只保留数据与自研组件属性，不执行源站代码。
export interface BarReferenceFixture extends Omit<BarChartProps, "toolbox"> { magicTypes: string[]; gaps: string[] }
export const chartBarFixtures: Record<string, BarReferenceFixture> = {
  "bar1": {
    "title": "某地区蒸发量和降水量",
    "description": "纯属虚构",
    "categories": [
      "1月",
      "2月",
      "3月",
      "4月",
      "5月",
      "6月",
      "7月",
      "8月",
      "9月",
      "10月",
      "11月",
      "12月"
    ],
    "series": [
      {
        "name": "蒸发量",
        "color": "#2ec7c9",
        "radius": 5,
        "showInLegend": true,
        "showLabels": false,
        "data": [
          {
            "value": 2
          },
          {
            "value": 4.9
          },
          {
            "value": 7
          },
          {
            "value": 23.2
          },
          {
            "value": 25.6
          },
          {
            "value": 76.7
          },
          {
            "value": 135.6
          },
          {
            "value": 162.2
          },
          {
            "value": 32.6
          },
          {
            "value": 20
          },
          {
            "value": 6.4
          },
          {
            "value": 3.3
          }
        ],
        "markAverage": true,
        "markMin": true,
        "markMax": true
      },
      {
        "name": "降水量",
        "color": "#b6a2de",
        "radius": 5,
        "showInLegend": true,
        "showLabels": false,
        "data": [
          {
            "value": 2.6
          },
          {
            "value": 5.9
          },
          {
            "value": 9
          },
          {
            "value": 26.4
          },
          {
            "value": 28.7
          },
          {
            "value": 70.7
          },
          {
            "value": 175.6
          },
          {
            "value": 182.2
          },
          {
            "value": 48.7
          },
          {
            "value": 18.8
          },
          {
            "value": 6
          },
          {
            "value": 2.3
          }
        ],
        "markAverage": true,
        "markMin": false,
        "markMax": false,
        "markPoints": [
          {
            "index": 7,
            "value": 183,
            "label": "182.2"
          },
          {
            "index": 11,
            "value": 3,
            "label": "2.3"
          }
        ]
      }
    ],
    "orientation": "vertical",
    "showLegend": true,
    "legendInteractive": true,
    "showCategoryAxis": true,
    "showValueAxis": true,
    "magicTypes": [
      "line",
      "bar"
    ],
    "gaps": [
      "标点缩放动画与端点符号",
      "提示样式与工具箱布局",
      "动画逐帧对比"
    ]
  },
  "bar10": {
    "barCategoryGap": 0.5,
    "valuePadding": 0.1,
    "title": "温度计式图表",
    "description": "From ExcelHome",
    "categories": [
      "Cosco",
      "CMA",
      "APL",
      "OOCL",
      "Wanhai",
      "Zim"
    ],
    "series": [
      {
        "name": "Acutal",
        "stack": "sum",
        "color": "tomato",
        "radius": 0,
        "showInLegend": true,
        "showLabels": true,
        "borderColor": "tomato",
        "borderWidth": 6,
        "labelPosition": "insideTop",
        "data": [
          {
            "value": 260
          },
          {
            "value": 200
          },
          {
            "value": 220
          },
          {
            "value": 120
          },
          {
            "value": 100
          },
          {
            "value": 80
          }
        ]
      },
      {
        "name": "Forecast",
        "stack": "sum",
        "color": "#fff",
        "radius": 0,
        "showInLegend": true,
        "showLabels": true,
        "borderColor": "tomato",
        "borderWidth": 6,
        "labelPosition": "top",
        "labelColor": "tomato",
        "data": [
          {
            "value": 40,
            "label": "300"
          },
          {
            "value": 80,
            "label": "280"
          },
          {
            "value": 50,
            "label": "270"
          },
          {
            "value": 80,
            "label": "200"
          },
          {
            "value": 80,
            "label": "180"
          },
          {
            "value": 70,
            "label": "150"
          }
        ]
      }
    ],
    "orientation": "vertical",
    "showLegend": true,
    "legendInteractive": false,
    "showCategoryAxis": true,
    "showValueAxis": true,
    "magicTypes": [],
    "gaps": [
      "原站提示格式和工具箱布局",
      "拖拽与动画逐帧对比"
    ]
  },
  "bar2": {
    "categories": [
      "周一",
      "周二",
      "周三",
      "周四",
      "周五",
      "周六",
      "周日"
    ],
    "series": [
      {
        "name": "直接访问",
        "color": "#2ec7c9",
        "radius": 5,
        "showInLegend": true,
        "showLabels": false,
        "data": [
          {
            "value": 320
          },
          {
            "value": 332
          },
          {
            "value": 301
          },
          {
            "value": 334
          },
          {
            "value": 390
          },
          {
            "value": 330
          },
          {
            "value": 320
          }
        ]
      },
      {
        "name": "邮件营销",
        "stack": "广告",
        "color": "#b6a2de",
        "radius": 5,
        "showInLegend": true,
        "showLabels": false,
        "data": [
          {
            "value": 120
          },
          {
            "value": 132
          },
          {
            "value": 101
          },
          {
            "value": 134
          },
          {
            "value": 90
          },
          {
            "value": 230
          },
          {
            "value": 210
          }
        ]
      },
      {
        "name": "联盟广告",
        "stack": "广告",
        "color": "#5ab1ef",
        "radius": 5,
        "showInLegend": true,
        "showLabels": false,
        "data": [
          {
            "value": 220
          },
          {
            "value": 182
          },
          {
            "value": 191
          },
          {
            "value": 234
          },
          {
            "value": 290
          },
          {
            "value": 330
          },
          {
            "value": 310
          }
        ]
      },
      {
        "name": "视频广告",
        "stack": "广告",
        "color": "#ffb980",
        "radius": 5,
        "showInLegend": true,
        "showLabels": false,
        "data": [
          {
            "value": 150
          },
          {
            "value": 232
          },
          {
            "value": 201
          },
          {
            "value": 154
          },
          {
            "value": 190
          },
          {
            "value": 330
          },
          {
            "value": 410
          }
        ]
      },
      {
        "name": "搜索引擎",
        "color": "#d87a80",
        "radius": 5,
        "showInLegend": true,
        "showLabels": false,
        "data": [
          {
            "value": 862
          },
          {
            "value": 1018
          },
          {
            "value": 964
          },
          {
            "value": 1026
          },
          {
            "value": 1679
          },
          {
            "value": 1600
          },
          {
            "value": 1570
          }
        ],
        "markAverage": false,
        "markRange": true
      },
      {
        "name": "百度",
        "stack": "搜索引擎",
        "color": "#8d98b3",
        "barWidth": 5,
        "radius": 5,
        "showInLegend": true,
        "showLabels": false,
        "data": [
          {
            "value": 620
          },
          {
            "value": 732
          },
          {
            "value": 701
          },
          {
            "value": 734
          },
          {
            "value": 1090
          },
          {
            "value": 1130
          },
          {
            "value": 1120
          }
        ]
      },
      {
        "name": "谷歌",
        "stack": "搜索引擎",
        "color": "#e5cf0d",
        "radius": 5,
        "showInLegend": true,
        "showLabels": false,
        "data": [
          {
            "value": 120
          },
          {
            "value": 132
          },
          {
            "value": 101
          },
          {
            "value": 134
          },
          {
            "value": 290
          },
          {
            "value": 230
          },
          {
            "value": 220
          }
        ]
      },
      {
        "name": "必应",
        "stack": "搜索引擎",
        "color": "#97b552",
        "radius": 5,
        "showInLegend": true,
        "showLabels": false,
        "data": [
          {
            "value": 60
          },
          {
            "value": 72
          },
          {
            "value": 71
          },
          {
            "value": 74
          },
          {
            "value": 190
          },
          {
            "value": 130
          },
          {
            "value": 110
          }
        ]
      },
      {
        "name": "其他",
        "stack": "搜索引擎",
        "color": "#95706d",
        "radius": 5,
        "showInLegend": true,
        "showLabels": false,
        "data": [
          {
            "value": 62
          },
          {
            "value": 82
          },
          {
            "value": 91
          },
          {
            "value": 84
          },
          {
            "value": 109
          },
          {
            "value": 110
          },
          {
            "value": 120
          }
        ]
      }
    ],
    "orientation": "vertical",
    "showLegend": true,
    "legendInteractive": true,
    "showCategoryAxis": true,
    "showValueAxis": true,
    "magicTypes": [
      "line",
      "bar",
      "stack",
      "tiled"
    ],
    "gaps": [
      "斜标线端点箭头",
      "工具箱图标及柱间距精确对比",
      "动画逐帧对比"
    ]
  },
  "bar3": {
    "title": "世界人口总量",
    "description": "数据来自网络",
    "categories": [
      "巴西",
      "印尼",
      "美国",
      "印度",
      "中国",
      "世界人口(万)"
    ],
    "series": [
      {
        "name": "2011年",
        "color": "#2ec7c9",
        "radius": 5,
        "showInLegend": true,
        "showLabels": false,
        "data": [
          {
            "value": 18203
          },
          {
            "value": 23489
          },
          {
            "value": 29034
          },
          {
            "value": 104970
          },
          {
            "value": 131744
          },
          {
            "value": 630230
          }
        ]
      },
      {
        "name": "2012年",
        "color": "#b6a2de",
        "radius": 5,
        "showInLegend": true,
        "showLabels": false,
        "data": [
          {
            "value": 19325
          },
          {
            "value": 23438
          },
          {
            "value": 31000
          },
          {
            "value": 121594
          },
          {
            "value": 134141
          },
          {
            "value": 681807
          }
        ]
      }
    ],
    "orientation": "horizontal",
    "showLegend": true,
    "legendInteractive": true,
    "showCategoryAxis": true,
    "showValueAxis": true,
    "magicTypes": [
      "line",
      "bar"
    ],
    "gaps": [
      "原站提示格式和工具箱布局",
      "拖拽与动画逐帧对比"
    ]
  },
  "bar4": {
    "categories": [
      "周一",
      "周二",
      "周三",
      "周四",
      "周五",
      "周六",
      "周日"
    ],
    "series": [
      {
        "name": "直接访问",
        "stack": "总量",
        "color": "#2ec7c9",
        "radius": 5,
        "showInLegend": true,
        "showLabels": true,
        "labelPosition": "insideRight",
        "data": [
          {
            "value": 320
          },
          {
            "value": 302
          },
          {
            "value": 301
          },
          {
            "value": 334
          },
          {
            "value": 390
          },
          {
            "value": 330
          },
          {
            "value": 320
          }
        ]
      },
      {
        "name": "邮件营销",
        "stack": "总量",
        "color": "#b6a2de",
        "radius": 5,
        "showInLegend": true,
        "showLabels": true,
        "labelPosition": "insideRight",
        "data": [
          {
            "value": 120
          },
          {
            "value": 132
          },
          {
            "value": 101
          },
          {
            "value": 134
          },
          {
            "value": 90
          },
          {
            "value": 230
          },
          {
            "value": 210
          }
        ]
      },
      {
        "name": "联盟广告",
        "stack": "总量",
        "color": "#5ab1ef",
        "radius": 5,
        "showInLegend": true,
        "showLabels": true,
        "labelPosition": "insideRight",
        "data": [
          {
            "value": 220
          },
          {
            "value": 182
          },
          {
            "value": 191
          },
          {
            "value": 234
          },
          {
            "value": 290
          },
          {
            "value": 330
          },
          {
            "value": 310
          }
        ]
      },
      {
        "name": "视频广告",
        "stack": "总量",
        "color": "#ffb980",
        "radius": 5,
        "showInLegend": true,
        "showLabels": true,
        "labelPosition": "insideRight",
        "data": [
          {
            "value": 150
          },
          {
            "value": 212
          },
          {
            "value": 201
          },
          {
            "value": 154
          },
          {
            "value": 190
          },
          {
            "value": 330
          },
          {
            "value": 410
          }
        ]
      },
      {
        "name": "搜索引擎",
        "stack": "总量",
        "color": "#d87a80",
        "radius": 5,
        "showInLegend": true,
        "showLabels": true,
        "labelPosition": "insideRight",
        "data": [
          {
            "value": 820
          },
          {
            "value": 832
          },
          {
            "value": 901
          },
          {
            "value": 934
          },
          {
            "value": 1290
          },
          {
            "value": 1330
          },
          {
            "value": 1320
          }
        ]
      }
    ],
    "orientation": "horizontal",
    "showLegend": true,
    "legendInteractive": true,
    "showCategoryAxis": true,
    "showValueAxis": true,
    "magicTypes": [
      "line",
      "bar",
      "stack",
      "tiled"
    ],
    "gaps": [
      "原站提示格式和工具箱布局",
      "拖拽与动画逐帧对比"
    ]
  },
  "bar5": {
    "categories": [
      "周一",
      "周二",
      "周三",
      "周四",
      "周五",
      "周六",
      "周日"
    ],
    "series": [
      {
        "name": "利润",
        "color": "#2ec7c9",
        "radius": 5,
        "showInLegend": true,
        "showLabels": true,
        "labelPosition": "inside",
        "data": [
          {
            "value": 200
          },
          {
            "value": 170
          },
          {
            "value": 240
          },
          {
            "value": 244
          },
          {
            "value": 200
          },
          {
            "value": 220
          },
          {
            "value": 210
          }
        ]
      },
      {
        "name": "收入",
        "stack": "总量",
        "color": "#5ab1ef",
        "barWidth": 5,
        "radius": 5,
        "showInLegend": true,
        "showLabels": true,
        "data": [
          {
            "value": 320
          },
          {
            "value": 302
          },
          {
            "value": 341
          },
          {
            "value": 374
          },
          {
            "value": 390
          },
          {
            "value": 450
          },
          {
            "value": 420
          }
        ]
      },
      {
        "name": "支出",
        "stack": "总量",
        "color": "#b6a2de",
        "radius": 5,
        "showInLegend": true,
        "showLabels": true,
        "labelPosition": "left",
        "data": [
          {
            "value": -120
          },
          {
            "value": -132
          },
          {
            "value": -101
          },
          {
            "value": -134
          },
          {
            "value": -190
          },
          {
            "value": -230
          },
          {
            "value": -210
          }
        ]
      }
    ],
    "orientation": "horizontal",
    "showLegend": true,
    "legendInteractive": true,
    "showCategoryAxis": true,
    "showValueAxis": true,
    "magicTypes": [
      "line",
      "bar"
    ],
    "gaps": [
      "原站提示格式和工具箱布局",
      "拖拽与动画逐帧对比"
    ]
  },
  "bar6": {
    "title": "阶梯瀑布图",
    "description": "From ExcelHome",
    "categories": [
      "11月1日",
      "11月2日",
      "11月3日",
      "11月4日",
      "11月5日",
      "11月6日",
      "11月7日",
      "11月8日",
      "11月9日",
      "11月10日",
      "11月11日"
    ],
    "series": [
      {
        "name": "辅助",
        "stack": "总量",
        "color": "rgba(0,0,0,0)",
        "radius": 5,
        "showInLegend": false,
        "showLabels": false,
        "borderColor": "rgba(0,0,0,0)",
        "data": [
          {
            "value": 0
          },
          {
            "value": 900
          },
          {
            "value": 1245
          },
          {
            "value": 1530
          },
          {
            "value": 1376
          },
          {
            "value": 1376
          },
          {
            "value": 1511
          },
          {
            "value": 1689
          },
          {
            "value": 1856
          },
          {
            "value": 1495
          },
          {
            "value": 1292
          }
        ]
      },
      {
        "name": "收入",
        "stack": "总量",
        "color": "#b6a2de",
        "radius": 5,
        "showInLegend": true,
        "showLabels": true,
        "labelPosition": "top",
        "data": [
          {
            "value": 900
          },
          {
            "value": 345
          },
          {
            "value": 393
          },
          {
            "value": 0,
            "hidden": true
          },
          {
            "value": 0,
            "hidden": true
          },
          {
            "value": 135
          },
          {
            "value": 178
          },
          {
            "value": 286
          },
          {
            "value": 0,
            "hidden": true
          },
          {
            "value": 0,
            "hidden": true
          },
          {
            "value": 0,
            "hidden": true
          }
        ]
      },
      {
        "name": "支出",
        "stack": "总量",
        "color": "#2ec7c9",
        "radius": 5,
        "showInLegend": true,
        "showLabels": true,
        "labelPosition": "bottom",
        "data": [
          {
            "value": 0,
            "hidden": true
          },
          {
            "value": 0,
            "hidden": true
          },
          {
            "value": 0,
            "hidden": true
          },
          {
            "value": 108
          },
          {
            "value": 154
          },
          {
            "value": 0,
            "hidden": true
          },
          {
            "value": 0,
            "hidden": true
          },
          {
            "value": 0,
            "hidden": true
          },
          {
            "value": 119
          },
          {
            "value": 361
          },
          {
            "value": 203
          }
        ]
      }
    ],
    "orientation": "vertical",
    "showLegend": true,
    "legendInteractive": true,
    "showCategoryAxis": true,
    "showValueAxis": true,
    "magicTypes": [],
    "gaps": [
      "原站提示格式和工具箱布局",
      "拖拽与动画逐帧对比"
    ]
  },
  "bar7": {
    "title": "深圳月最低生活费组成（单位:元）",
    "description": "From ExcelHome",
    "categories": [
      "总费用",
      "房租",
      "水电费",
      "交通费",
      "伙食费",
      "日用品数"
    ],
    "series": [
      {
        "name": "辅助",
        "stack": "总量",
        "color": "rgba(0,0,0,0)",
        "radius": 5,
        "showInLegend": false,
        "showLabels": false,
        "borderColor": "rgba(0,0,0,0)",
        "data": [
          {
            "value": 0
          },
          {
            "value": 1700
          },
          {
            "value": 1400
          },
          {
            "value": 1200
          },
          {
            "value": 300
          },
          {
            "value": 0
          }
        ]
      },
      {
        "name": "生活费",
        "stack": "总量",
        "color": "#b6a2de",
        "radius": 5,
        "showInLegend": false,
        "showLabels": true,
        "labelPosition": "inside",
        "data": [
          {
            "value": 2900
          },
          {
            "value": 1200
          },
          {
            "value": 300
          },
          {
            "value": 200
          },
          {
            "value": 900
          },
          {
            "value": 300
          }
        ]
      }
    ],
    "orientation": "vertical",
    "showLegend": false,
    "legendInteractive": true,
    "showCategoryAxis": true,
    "showValueAxis": true,
    "magicTypes": [],
    "gaps": [
      "原站提示格式和工具箱布局",
      "拖拽与动画逐帧对比"
    ]
  },
  "bar8": {
    "grid": {
      "top": 80,
      "bottom": 30
    },
    "valueAxisPosition": "top",
    "title": "交错正负轴标签",
    "description": "From ExcelHome",
    "categories": [
      "ten",
      "nine",
      "eight",
      "seven",
      "six",
      "five",
      "four",
      "three",
      "two",
      "one"
    ],
    "series": [
      {
        "name": "生活费",
        "stack": "总量",
        "color": "orange",
        "radius": 5,
        "showInLegend": false,
        "showLabels": true,
        "labelPosition": "left",
        "data": [
          {
            "value": -0.07,
            "label": "ten",
            "labelPosition": "right"
          },
          {
            "value": -0.09,
            "label": "nine",
            "labelPosition": "right"
          },
          {
            "value": 0.2,
            "label": "eight",
            "labelPosition": "left"
          },
          {
            "value": 0.44,
            "label": "seven",
            "labelPosition": "left"
          },
          {
            "value": -0.23,
            "label": "six",
            "labelPosition": "right"
          },
          {
            "value": 0.08,
            "label": "five",
            "labelPosition": "left"
          },
          {
            "value": -0.17,
            "label": "four",
            "labelPosition": "right"
          },
          {
            "value": 0.47,
            "label": "three",
            "labelPosition": "left"
          },
          {
            "value": -0.36,
            "label": "two",
            "labelPosition": "right"
          },
          {
            "value": 0.18,
            "label": "one",
            "labelPosition": "left"
          }
        ]
      }
    ],
    "orientation": "horizontal",
    "showLegend": false,
    "legendInteractive": true,
    "showCategoryAxis": false,
    "showValueAxis": true,
    "magicTypes": [
      "line",
      "bar"
    ],
    "gaps": [
      "顶部数值轴及虚线样式",
      "负值标签逐像素对比"
    ]
  },
  "bar9": {
    "grid": {
      "top": 80,
      "bottom": 30
    },
    "legendLayout": {
      "y": 65,
      "itemGap": 83
    },
    "title": "多维条形图",
    "description": "From ExcelHome",
    "categories": [
      "重庆",
      "天津",
      "上海",
      "北京"
    ],
    "series": [
      {
        "name": "GML",
        "stack": "总量",
        "color": "#2ec7c9",
        "radius": 5,
        "showInLegend": true,
        "showLabels": true,
        "data": [
          {
            "value": 38,
            "label": "38%",
            "labelPosition": "insideLeft"
          },
          {
            "value": 50,
            "label": "50%",
            "labelPosition": "insideLeft"
          },
          {
            "value": 33,
            "label": "33%",
            "labelPosition": "insideLeft"
          },
          {
            "value": 72,
            "label": "72%",
            "labelPosition": "insideLeft"
          }
        ]
      },
      {
        "name": "GML",
        "stack": "总量",
        "color": "transparent",
        "radius": 5,
        "showInLegend": true,
        "showLabels": false,
        "data": [
          {
            "value": 62
          },
          {
            "value": 50
          },
          {
            "value": 67
          },
          {
            "value": 28
          }
        ]
      },
      {
        "name": "PYP",
        "stack": "总量",
        "color": "#b6a2de",
        "radius": 5,
        "showInLegend": true,
        "showLabels": true,
        "data": [
          {
            "value": 61,
            "label": "61%",
            "labelPosition": "insideLeft"
          },
          {
            "value": 41,
            "label": "41%",
            "labelPosition": "insideLeft"
          },
          {
            "value": 42,
            "label": "42%",
            "labelPosition": "insideLeft"
          },
          {
            "value": 30,
            "label": "30%",
            "labelPosition": "insideLeft"
          }
        ]
      },
      {
        "name": "PYP",
        "stack": "总量",
        "color": "transparent",
        "radius": 5,
        "showInLegend": true,
        "showLabels": false,
        "data": [
          {
            "value": 39
          },
          {
            "value": 59
          },
          {
            "value": 58
          },
          {
            "value": 70
          }
        ]
      },
      {
        "name": "WTC",
        "stack": "总量",
        "color": "#5ab1ef",
        "radius": 5,
        "showInLegend": true,
        "showLabels": true,
        "data": [
          {
            "value": 37,
            "label": "37%",
            "labelPosition": "insideLeft"
          },
          {
            "value": 35,
            "label": "35%",
            "labelPosition": "insideLeft"
          },
          {
            "value": 44,
            "label": "44%",
            "labelPosition": "insideLeft"
          },
          {
            "value": 60,
            "label": "60%",
            "labelPosition": "insideLeft"
          }
        ]
      },
      {
        "name": "WTC",
        "stack": "总量",
        "color": "transparent",
        "radius": 5,
        "showInLegend": true,
        "showLabels": false,
        "data": [
          {
            "value": 63
          },
          {
            "value": 65
          },
          {
            "value": 56
          },
          {
            "value": 40
          }
        ]
      },
      {
        "name": "ZTW",
        "stack": "总量",
        "color": "#ffb980",
        "radius": 5,
        "showInLegend": true,
        "showLabels": true,
        "data": [
          {
            "value": 71,
            "label": "71%",
            "labelPosition": "insideLeft"
          },
          {
            "value": 50,
            "label": "50%",
            "labelPosition": "insideLeft"
          },
          {
            "value": 31,
            "label": "31%",
            "labelPosition": "insideLeft"
          },
          {
            "value": 39,
            "label": "39%",
            "labelPosition": "insideLeft"
          }
        ]
      },
      {
        "name": "ZTW",
        "stack": "总量",
        "color": "transparent",
        "radius": 5,
        "showInLegend": true,
        "showLabels": false,
        "data": [
          {
            "value": 29
          },
          {
            "value": 50
          },
          {
            "value": 69
          },
          {
            "value": 61
          }
        ]
      }
    ],
    "orientation": "horizontal",
    "showLegend": true,
    "legendInteractive": true,
    "showCategoryAxis": true,
    "showValueAxis": false,
    "magicTypes": [],
    "gaps": [
      "顶部数值轴及提示格式",
      "源站拖拽与动画逐帧对比"
    ]
  }
};

// Additional original-data examples; the chart runtime remains entirely SiaWebUI.
Object.assign(chartBarFixtures, {
  "bar12": {
    "title": "ECharts2 vs ECharts1",
    "description": "Chrome下测试数据",
    "categories": [
      "Line",
      "Bar",
      "Scatter",
      "K",
      "Map"
    ],
    "grid": {
      "top": 70,
      "bottom": 30,
      "right": 20
    },
    "showLegend": true,
    "magicTypes": [
      "line",
      "bar"
    ],
    "gaps": [
      "工具箱和提示框逐项交互验收",
      "与原站逐帧视觉和动画对比",
      "重叠柱图的折线切换与源站第二类目轴细节"
    ],
    "legendOrder": [
      "ECharts1 - 2k数据",
      "ECharts1 - 2w数据",
      "ECharts1 - 20w数据",
      "ECharts2 - 2k数据",
      "ECharts2 - 2w数据",
      "ECharts2 - 20w数据"
    ],
    "legendLayout": {
      "x": 440,
      "y": 14,
      "rows": 2,
      "itemGap": 10
    },
    "series": [
      {
        "name": "ECharts2 - 2k数据",
        "color": "rgba(193,35,43,1)",
        "overlayGroup": "0",
        "showLabels": true,
        "data": [
          {
            "value": 40,
            "label": "40"
          },
          {
            "value": 155,
            "label": "155"
          },
          {
            "value": 95,
            "label": "95"
          },
          {
            "value": 75,
            "label": "75"
          },
          {
            "value": 0,
            "label": ""
          }
        ]
      },
      {
        "name": "ECharts2 - 2w数据",
        "color": "rgba(181,195,52,1)",
        "overlayGroup": "1",
        "showLabels": true,
        "labelColor": "#27727B",
        "data": [
          {
            "value": 100,
            "label": "100"
          },
          {
            "value": 200,
            "label": "200"
          },
          {
            "value": 105,
            "label": "105"
          },
          {
            "value": 100,
            "label": "100"
          },
          {
            "value": 156,
            "label": "156"
          }
        ]
      },
      {
        "name": "ECharts2 - 20w数据",
        "color": "rgba(252,206,16,1)",
        "overlayGroup": "2",
        "showLabels": true,
        "labelColor": "#E87C25",
        "data": [
          {
            "value": 906,
            "label": "906"
          },
          {
            "value": 911,
            "label": "911"
          },
          {
            "value": 908,
            "label": "908"
          },
          {
            "value": 778,
            "label": "778"
          },
          {
            "value": 0,
            "label": ""
          }
        ]
      },
      {
        "name": "ECharts1 - 2k数据",
        "color": "rgba(193,35,43,0.5)",
        "overlayGroup": "0",
        "showLabels": true,
        "data": [
          {
            "value": 96,
            "label": "96\n"
          },
          {
            "value": 224,
            "label": "224\n"
          },
          {
            "value": 164,
            "label": "164\n"
          },
          {
            "value": 124,
            "label": "124\n"
          },
          {
            "value": 0,
            "label": ""
          }
        ]
      },
      {
        "name": "ECharts1 - 2w数据",
        "color": "rgba(181,195,52,0.5)",
        "overlayGroup": "1",
        "showLabels": true,
        "data": [
          {
            "value": 491,
            "label": "491"
          },
          {
            "value": 2035,
            "label": "2035"
          },
          {
            "value": 389,
            "label": "389"
          },
          {
            "value": 955,
            "label": "955"
          },
          {
            "value": 347,
            "label": "347"
          }
        ]
      },
      {
        "name": "ECharts1 - 20w数据",
        "color": "rgba(252,206,16,0.5)",
        "overlayGroup": "2",
        "showLabels": true,
        "data": [
          {
            "value": 3000,
            "label": "3000+"
          },
          {
            "value": 3000,
            "label": "3000+"
          },
          {
            "value": 2817,
            "label": "2817+"
          },
          {
            "value": 3000,
            "label": "3000+"
          },
          {
            "value": 0,
            "label": ""
          }
        ]
      }
    ]
  },
  "bar14": {
    "title": "ECharts例子个数统计",
    "description": "Rainbow bar example",
    "categories": [
      "Line",
      "Bar",
      "Scatter",
      "K",
      "Pie",
      "Radar",
      "Chord",
      "Force",
      "Map",
      "Gauge",
      "Funnel"
    ],
    "grid": {
      "top": 80,
      "bottom": 60,
      "right": 80
    },
    "showLegend": false,
    "magicTypes": [],
    "gaps": [
      "工具箱和提示框逐项交互验收",
      "与原站逐帧视觉和动画对比",
      "底部图片标记及其悬浮图片提示尚未实现"
    ],
    "titleAlign": "center",
    "showValueAxis": false,
    "showCategoryAxis": false,
    "series": [
      {
        "name": "ECharts例子个数统计",
        "showLabels": true,
        "data": [
          {
            "value": 12,
            "color": "#C1232B"
          },
          {
            "value": 21,
            "color": "#B5C334"
          },
          {
            "value": 10,
            "color": "#FCCE10"
          },
          {
            "value": 4,
            "color": "#E87C25"
          },
          {
            "value": 12,
            "color": "#27727B"
          },
          {
            "value": 5,
            "color": "#FE8463"
          },
          {
            "value": 6,
            "color": "#9BCA63"
          },
          {
            "value": 5,
            "color": "#FAD860"
          },
          {
            "value": 25,
            "color": "#F3A43B"
          },
          {
            "value": 23,
            "color": "#60C0DD"
          },
          {
            "value": 7,
            "color": "#D7504B"
          }
        ]
      }
    ]
  },
  "bar15": {
    "title": "2010-2013年中国城镇居民家庭人均消费构成（元）",
    "description": "数据来自国家统计局",
    "categories": [
      "食品",
      "衣着",
      "居住",
      "家庭设备及用品",
      "医疗保健",
      "交通和通信",
      "文教娱乐服务",
      "其他"
    ],
    "grid": {
      "top": 80,
      "bottom": 40,
      "right": 40
    },
    "showLegend": true,
    "magicTypes": [],
    "gaps": [
      "工具箱和提示框逐项交互验收",
      "与原站逐帧视觉和动画对比",
      "类目提示框阴影和文字颜色一致性"
    ],
    "legendLayout": {
      "x": 525,
      "y": 14
    },
    "series": [
      {
        "name": "2010",
        "color": "rgb(64,224,208)",
        "data": [
          {
            "value": 4804.7,
            "color": "rgb(255,127,80)"
          },
          {
            "value": 1444.3,
            "color": "rgb(135,206,250)"
          },
          {
            "value": 1332.1,
            "color": "rgb(218,112,214)"
          },
          {
            "value": 908,
            "color": "rgb(50,205,50)"
          },
          {
            "value": 871.8,
            "color": "rgb(100,149,237)"
          },
          {
            "value": 1983.7,
            "color": "rgb(255,105,180)"
          },
          {
            "value": 1627.6,
            "color": "rgb(186,85,211)"
          },
          {
            "value": 499.2,
            "color": "rgb(205,92,92)"
          }
        ]
      },
      {
        "name": "2011",
        "color": "rgb(57,201,187)",
        "data": [
          {
            "value": 5506.3,
            "color": "rgb(229,114,72)"
          },
          {
            "value": 1674.7,
            "color": "rgb(121,185,225)"
          },
          {
            "value": 1405,
            "color": "rgb(196,100,192)"
          },
          {
            "value": 1023.2,
            "color": "rgb(45,184,45)"
          },
          {
            "value": 969,
            "color": "rgb(90,134,213)"
          },
          {
            "value": 2149.7,
            "color": "rgb(229,94,162)"
          },
          {
            "value": 1851.7,
            "color": "rgb(167,76,189)"
          },
          {
            "value": 581.3,
            "color": "rgb(184,82,82)"
          }
        ]
      },
      {
        "name": "2012",
        "color": "rgb(51,179,166)",
        "data": [
          {
            "value": 6040.9,
            "color": "rgb(204,101,64)"
          },
          {
            "value": 1823.4,
            "color": "rgb(108,164,200)"
          },
          {
            "value": 1484.3,
            "color": "rgb(174,89,171)"
          },
          {
            "value": 1116.1,
            "color": "rgb(40,164,40)"
          },
          {
            "value": 1063.7,
            "color": "rgb(80,119,189)"
          },
          {
            "value": 2455.5,
            "color": "rgb(204,84,144)"
          },
          {
            "value": 2033.5,
            "color": "rgb(148,68,168)"
          },
          {
            "value": 657.1,
            "color": "rgb(164,73,73)"
          }
        ]
      },
      {
        "name": "2013",
        "color": "rgb(44,156,145)",
        "data": [
          {
            "value": 6311.9,
            "color": "rgb(178,88,56)"
          },
          {
            "value": 1902,
            "color": "rgb(94,144,175)"
          },
          {
            "value": 1745.1,
            "color": "rgb(152,78,149)"
          },
          {
            "value": 1215.1,
            "color": "rgb(35,143,35)"
          },
          {
            "value": 1118.3,
            "color": "rgb(70,104,165)"
          },
          {
            "value": 2736.9,
            "color": "rgb(178,73,125)"
          },
          {
            "value": 2294,
            "color": "rgb(130,59,147)"
          },
          {
            "value": 699.4,
            "color": "rgb(143,64,64)"
          }
        ]
      }
    ]
  }
});
chartBarFixtures.bar12!.axisLabelFormatter = value => `${value} ms`;
chartBarFixtures.bar12!.showCategorySplitLine = true;
chartBarFixtures.bar15!.showCategorySplitLine = true;
chartBarFixtures.bar12!.legendLayout = {x:331.5,y:14,rows:2,itemGap:10};
chartBarFixtures.bar12!.series = chartBarFixtures.bar12!.series.map((series,index)=>({...series,
  labelFormatter:value=>index===3 ? (value>0?`${value}\n`:"") : index===5 ? (value>0?`${value}+`:"") : value.toLocaleString("en-US"),
}));
chartBarFixtures.bar14!.tooltipTrigger = "item";
chartBarFixtures.bar14!.series = chartBarFixtures.bar14!.series.map(series=>({...series,labelFormatter:(value,category)=>`${category}\n${value}`}));
