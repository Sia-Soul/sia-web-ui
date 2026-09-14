import type { FunnelSeries, RadarPanel } from "@sia.soul/sia-react-ui";
export interface AdditionalFixture {
  kind: "funnel" | "radar";
  title?:string; description?:string; palette?:string[];
  legendOrder:string[]; legendLayout:{x:number;y:number;orientation?:"horizontal"|"vertical";align?:"start"|"center"|"end"};
  series?: (FunnelSeries & {labelTemplate?:string})[];
  radars?: RadarPanel[];
  gaps:string[];
}
export const chartAdditionalFixtures:Record<string,AdditionalFixture>={
  "funnel": {
    "kind": "funnel",
    "title": "漏斗图",
    "description": "纯属虚构",
    "legendOrder": [
      "展现",
      "点击",
      "访问",
      "咨询",
      "订单"
    ],
    "legendLayout": {
      "x": 331.5,
      "y": 15
    },
    "series": [
      {
        "name": "漏斗图",
        "data": [
          {
            "value": 60,
            "name": "访问"
          },
          {
            "value": 40,
            "name": "咨询"
          },
          {
            "value": 20,
            "name": "订单"
          },
          {
            "value": 80,
            "name": "点击"
          },
          {
            "value": 100,
            "name": "展现"
          }
        ],
        "left": 66.3,
        "top": 60,
        "width": 530.4,
        "height": 259,
        "sort": "descending",
        "align": "center",
        "min": 0,
        "max": 100,
        "minSize": 0,
        "maxSize": 1,
        "gap": 10,
        "labelPosition": "inside",
        "showLabelLines": false,
        "borderColor": "#fff",
        "borderWidth": 1
      }
    ],
    "gaps": [
      "工具箱位置、强调标签及可计算拖拽未对齐",
      "漏斗入场及切换动画未逐帧验收"
    ]
  },
  "funnel1": {
    "kind": "funnel",
    "title": "漏斗图",
    "description": "纯属虚构",
    "legendOrder": [
      "展现",
      "点击",
      "访问",
      "咨询",
      "订单"
    ],
    "legendLayout": {
      "x": 331.5,
      "y": 15
    },
    "series": [
      {
        "name": "漏斗图",
        "data": [
          {
            "value": 60,
            "name": "访问"
          },
          {
            "value": 40,
            "name": "咨询"
          },
          {
            "value": 20,
            "name": "订单"
          },
          {
            "value": 80,
            "name": "点击"
          },
          {
            "value": 100,
            "name": "展现"
          }
        ],
        "left": 80,
        "top": 60,
        "width": 265.2,
        "height": 259,
        "sort": "descending",
        "align": "center",
        "min": 0,
        "max": 100,
        "minSize": 0,
        "maxSize": 1,
        "gap": 0,
        "labelPosition": "right"
      },
      {
        "name": "金字塔",
        "data": [
          {
            "value": 60,
            "name": "访问"
          },
          {
            "value": 40,
            "name": "咨询"
          },
          {
            "value": 20,
            "name": "订单"
          },
          {
            "value": 80,
            "name": "点击"
          },
          {
            "value": 100,
            "name": "展现"
          }
        ],
        "left": 331.5,
        "top": 60,
        "width": 251.5,
        "height": 259,
        "sort": "ascending",
        "align": "center",
        "min": 0,
        "max": 100,
        "minSize": 0,
        "maxSize": 1,
        "gap": 0,
        "labelPosition": "left"
      }
    ],
    "gaps": [
      "工具箱位置、强调标签及可计算拖拽未对齐",
      "漏斗入场及切换动画未逐帧验收"
    ]
  },
  "funnel2": {
    "kind": "funnel",
    "title": "漏斗图",
    "description": "纯属虚构",
    "palette": [
      "rgba(255, 69, 0, 0.5)",
      "rgba(255, 150, 0, 0.5)",
      "rgba(255, 200, 0, 0.5)",
      "rgba(155, 200, 50, 0.5)",
      "rgba(55, 200, 100, 0.5)"
    ],
    "legendOrder": [
      "展现",
      "点击",
      "访问",
      "咨询",
      "订单"
    ],
    "legendLayout": {
      "x": 331.5,
      "y": 15
    },
    "series": [
      {
        "name": "预期",
        "data": [
          {
            "value": 60,
            "name": "访问"
          },
          {
            "value": 40,
            "name": "咨询"
          },
          {
            "value": 20,
            "name": "订单"
          },
          {
            "value": 80,
            "name": "点击"
          },
          {
            "value": 100,
            "name": "展现"
          }
        ],
        "left": 66.3,
        "top": 60,
        "width": 530.4,
        "height": 259,
        "sort": "descending",
        "align": "center",
        "min": 0,
        "max": 100,
        "minSize": 0,
        "maxSize": 1,
        "gap": 0,
        "labelPosition": "right",
        "labelTemplate": "{b}预期",
        "showLabelLines": false
      },
      {
        "name": "实际",
        "data": [
          {
            "value": 30,
            "name": "访问"
          },
          {
            "value": 10,
            "name": "咨询"
          },
          {
            "value": 5,
            "name": "订单"
          },
          {
            "value": 50,
            "name": "点击"
          },
          {
            "value": 80,
            "name": "展现"
          }
        ],
        "left": 66.3,
        "top": 60,
        "width": 530.4,
        "height": 259,
        "sort": "descending",
        "align": "center",
        "min": 0,
        "max": 100,
        "minSize": 0,
        "maxSize": 0.8,
        "gap": 0,
        "labelPosition": "inside",
        "labelTemplate": "{c}%",
        "borderColor": "#fff",
        "borderWidth": 2
      }
    ],
    "gaps": [
      "工具箱位置、强调标签及可计算拖拽未对齐",
      "漏斗入场及切换动画未逐帧验收"
    ]
  },
  "funnel3": {
    "kind": "funnel",
    "title": "漏斗图",
    "description": "纯属虚构",
    "legendOrder": [
      "展现",
      "点击",
      "访问",
      "咨询",
      "订单"
    ],
    "legendLayout": {
      "x": 5,
      "y": 15,
      "orientation": "vertical"
    },
    "series": [
      {
        "name": "漏斗图",
        "data": [
          {
            "value": 60,
            "name": "访问"
          },
          {
            "value": 30,
            "name": "咨询"
          },
          {
            "value": 10,
            "name": "订单"
          },
          {
            "value": 80,
            "name": "点击"
          },
          {
            "value": 100,
            "name": "展现"
          }
        ],
        "left": 33.15,
        "top": 189.5,
        "width": 265.2,
        "height": 170.55,
        "sort": "descending",
        "align": "center",
        "min": 0,
        "max": 100,
        "minSize": 0,
        "maxSize": 1,
        "gap": 0,
        "labelPosition": "right"
      },
      {
        "name": "金字塔",
        "data": [
          {
            "value": 60,
            "name": "访问"
          },
          {
            "value": 30,
            "name": "咨询"
          },
          {
            "value": 10,
            "name": "订单"
          },
          {
            "value": 80,
            "name": "点击"
          },
          {
            "value": 100,
            "name": "展现"
          }
        ],
        "left": 33.15,
        "top": 18.95,
        "width": 265.2,
        "height": 170.55,
        "sort": "ascending",
        "align": "center",
        "min": 0,
        "max": 100,
        "minSize": 0,
        "maxSize": 1,
        "gap": 0,
        "labelPosition": "right"
      },
      {
        "name": "漏斗图",
        "data": [
          {
            "value": 60,
            "name": "访问"
          },
          {
            "value": 30,
            "name": "咨询"
          },
          {
            "value": 10,
            "name": "订单"
          },
          {
            "value": 80,
            "name": "点击"
          },
          {
            "value": 100,
            "name": "展现"
          }
        ],
        "left": 364.65,
        "top": 18.95,
        "width": 265.2,
        "height": 170.55,
        "sort": "descending",
        "align": "center",
        "min": 0,
        "max": 100,
        "minSize": 0,
        "maxSize": 1,
        "gap": 0,
        "labelPosition": "left"
      },
      {
        "name": "金字塔",
        "data": [
          {
            "value": 60,
            "name": "访问"
          },
          {
            "value": 30,
            "name": "咨询"
          },
          {
            "value": 10,
            "name": "订单"
          },
          {
            "value": 80,
            "name": "点击"
          },
          {
            "value": 100,
            "name": "展现"
          }
        ],
        "left": 364.65,
        "top": 189.5,
        "width": 265.2,
        "height": 170.55,
        "sort": "ascending",
        "align": "center",
        "min": 0,
        "max": 100,
        "minSize": 0,
        "maxSize": 1,
        "gap": 0,
        "labelPosition": "left"
      }
    ],
    "gaps": [
      "工具箱位置、强调标签及可计算拖拽未对齐",
      "漏斗入场及切换动画未逐帧验收"
    ]
  },
  "funnel4": {
    "kind": "funnel",
    "title": "漏斗图(对比)",
    "description": "纯属虚构",
    "legendOrder": [
      "产品A",
      "产品B",
      "产品C",
      "产品D",
      "产品E"
    ],
    "legendLayout": {
      "x": 5,
      "y": 15,
      "orientation": "vertical"
    },
    "series": [
      {
        "name": "漏斗图",
        "data": [
          {
            "value": 60,
            "name": "产品C"
          },
          {
            "value": 30,
            "name": "产品D"
          },
          {
            "value": 10,
            "name": "产品E"
          },
          {
            "value": 80,
            "name": "产品B"
          },
          {
            "value": 100,
            "name": "产品A"
          }
        ],
        "left": 33.15,
        "top": 189.5,
        "width": 265.2,
        "height": 170.55,
        "sort": "descending",
        "align": "right",
        "min": 0,
        "max": 100,
        "minSize": 0,
        "maxSize": 1,
        "gap": 0,
        "labelPosition": "right",
        "pieCenter": [
          165.75,
          94.75
        ]
      },
      {
        "name": "金字塔",
        "data": [
          {
            "value": 60,
            "name": "产品C"
          },
          {
            "value": 30,
            "name": "产品D"
          },
          {
            "value": 10,
            "name": "产品E"
          },
          {
            "value": 80,
            "name": "产品B"
          },
          {
            "value": 100,
            "name": "产品A"
          }
        ],
        "left": 33.15,
        "top": 18.95,
        "width": 265.2,
        "height": 170.55,
        "sort": "ascending",
        "align": "right",
        "min": 0,
        "max": 100,
        "minSize": 0,
        "maxSize": 1,
        "gap": 0,
        "labelPosition": "right",
        "pieCenter": [
          165.75,
          284.25
        ]
      },
      {
        "name": "漏斗图",
        "data": [
          {
            "value": 60,
            "name": "产品C"
          },
          {
            "value": 30,
            "name": "产品D"
          },
          {
            "value": 10,
            "name": "产品E"
          },
          {
            "value": 80,
            "name": "产品B"
          },
          {
            "value": 100,
            "name": "产品A"
          }
        ],
        "left": 364.65,
        "top": 18.95,
        "width": 265.2,
        "height": 170.55,
        "sort": "descending",
        "align": "left",
        "min": 0,
        "max": 100,
        "minSize": 0,
        "maxSize": 1,
        "gap": 0,
        "labelPosition": "right",
        "pieCenter": [
          497.25,
          94.75
        ]
      },
      {
        "name": "金字塔",
        "data": [
          {
            "value": 60,
            "name": "产品C"
          },
          {
            "value": 30,
            "name": "产品D"
          },
          {
            "value": 10,
            "name": "产品E"
          },
          {
            "value": 80,
            "name": "产品B"
          },
          {
            "value": 100,
            "name": "产品A"
          }
        ],
        "left": 364.65,
        "top": 189.5,
        "width": 265.2,
        "height": 170.55,
        "sort": "ascending",
        "align": "left",
        "min": 0,
        "max": 100,
        "minSize": 0,
        "maxSize": 1,
        "gap": 0,
        "labelPosition": "right",
        "pieCenter": [
          497.25,
          284.25
        ]
      }
    ],
    "gaps": [
      "工具箱位置、强调标签及可计算拖拽未对齐",
      "漏斗入场及切换动画未逐帧验收"
    ]
  },
  "radar1": {
    "kind": "radar",
    "title": "预算 vs 开销（Budget vs spending）",
    "description": "纯属虚构",
    "legendOrder": [
      "预算分配（Allocated Budget）",
      "实际开销（Actual Spending）"
    ],
    "legendLayout": {
      "x": 650,
      "y": 330,
      "orientation": "vertical",
      "align": "end"
    },
    "radars": [
      {
        "center": [
          331.5,
          189.5
        ],
        "radius": 142.125,
        "indicators": [
          {
            "name": "销售（sales）",
            "max": 6000
          },
          {
            "name": "管理（Administration）",
            "max": 16000
          },
          {
            "name": "信息技术（Information Techology）",
            "max": 30000
          },
          {
            "name": "客服（Customer Support）",
            "max": 38000
          },
          {
            "name": "研发（Development）",
            "max": 52000
          },
          {
            "name": "市场（Marketing）",
            "max": 25000
          }
        ],
        "series": [
          {
            "name": "预算分配（Allocated Budget）",
            "data": [
              4300,
              10000,
              28000,
              35000,
              50000,
              19000
            ],
            "areaOpacity": 0,
            "lineWidth": 2
          },
          {
            "name": "实际开销（Actual Spending）",
            "data": [
              5000,
              14000,
              28000,
              31000,
              42000,
              21000
            ],
            "areaOpacity": 0,
            "lineWidth": 2
          }
        ],
        "levels": 5
      }
    ],
    "gaps": [
      "极坐标网格、提示触发及标签布局仍待精确对照",
      "数据拖拽和逐帧动画未验收"
    ]
  },
  "radar2": {
    "kind": "radar",
    "title": "罗纳尔多 vs 舍普琴科",
    "description": "完全实况球员数据",
    "legendOrder": [
      "罗纳尔多",
      "舍普琴科"
    ],
    "legendLayout": {
      "x": 331.5,
      "y": 15
    },
    "radars": [
      {
        "center": [
          331.5,
          189.5
        ],
        "radius": 130,
        "indicators": [
          {
            "name": "进攻",
            "max": 100
          },
          {
            "name": "防守",
            "max": 100
          },
          {
            "name": "体能",
            "max": 100
          },
          {
            "name": "速度",
            "max": 100
          },
          {
            "name": "力量",
            "max": 100
          },
          {
            "name": "技巧",
            "max": 100
          }
        ],
        "series": [
          {
            "name": "舍普琴科",
            "data": [
              97,
              42,
              88,
              94,
              90,
              86
            ],
            "areaOpacity": 0.3,
            "lineWidth": 2
          },
          {
            "name": "罗纳尔多",
            "data": [
              97,
              32,
              74,
              95,
              88,
              92
            ],
            "areaOpacity": 0.3,
            "lineWidth": 2
          }
        ],
        "levels": 5
      }
    ],
    "gaps": [
      "极坐标网格、提示触发及标签布局仍待精确对照",
      "数据拖拽和逐帧动画未验收"
    ]
  },
  "radar3": {
    "kind": "radar",
    "title": "多雷达图",
    "description": "纯属虚构",
    "legendOrder": [
      "某软件",
      "某主食手机",
      "某水果手机",
      "降水量",
      "蒸发量"
    ],
    "legendLayout": {
      "x": 331.5,
      "y": 15
    },
    "radars": [
      {
        "center": [
          165.75,
          200
        ],
        "radius": 80,
        "indicators": [
          {
            "name": "品牌",
            "max": 100
          },
          {
            "name": "内容",
            "max": 100
          },
          {
            "name": "可用性",
            "max": 100
          },
          {
            "name": "功能",
            "max": 100
          }
        ],
        "series": [
          {
            "name": "某软件",
            "data": [
              60,
              73,
              85,
              40
            ],
            "areaOpacity": 0.3,
            "lineWidth": 2
          }
        ],
        "levels": 5
      },
      {
        "center": [
          331.5,
          189.5
        ],
        "radius": 80,
        "indicators": [
          {
            "name": "外观",
            "max": 100
          },
          {
            "name": "拍照",
            "max": 100
          },
          {
            "name": "系统",
            "max": 100
          },
          {
            "name": "性能",
            "max": 100
          },
          {
            "name": "屏幕",
            "max": 100
          }
        ],
        "series": [
          {
            "name": "某主食手机",
            "data": [
              85,
              90,
              90,
              95,
              95
            ],
            "areaOpacity": 0,
            "lineWidth": 2
          },
          {
            "name": "某水果手机",
            "data": [
              95,
              80,
              95,
              90,
              93
            ],
            "areaOpacity": 0,
            "lineWidth": 2
          }
        ],
        "levels": 5
      },
      {
        "center": [
          497.25,
          200
        ],
        "radius": 80,
        "indicators": [
          {
            "name": "1月",
            "max": 100
          },
          {
            "name": "2月",
            "max": 100
          },
          {
            "name": "3月",
            "max": 100
          },
          {
            "name": "4月",
            "max": 100
          },
          {
            "name": "5月",
            "max": 100
          },
          {
            "name": "6月",
            "max": 100
          },
          {
            "name": "7月",
            "max": 100
          },
          {
            "name": "8月",
            "max": 100
          },
          {
            "name": "9月",
            "max": 100
          },
          {
            "name": "10月",
            "max": 100
          },
          {
            "name": "11月",
            "max": 100
          },
          {
            "name": "12月",
            "max": 100
          }
        ],
        "series": [
          {
            "name": "降水量",
            "data": [
              2.6,
              5.9,
              9,
              26.4,
              28.7,
              70.7,
              75.6,
              82.2,
              48.7,
              18.8,
              6,
              2.3
            ],
            "areaOpacity": 0.3,
            "lineWidth": 2
          },
          {
            "name": "蒸发量",
            "data": [
              2,
              4.9,
              7,
              23.2,
              25.6,
              76.7,
              35.6,
              62.2,
              32.6,
              20,
              6.4,
              3.3
            ],
            "areaOpacity": 0.3,
            "lineWidth": 2
          }
        ],
        "levels": 5
      }
    ],
    "gaps": [
      "极坐标网格、提示触发及标签布局仍待精确对照",
      "数据拖拽和逐帧动画未验收"
    ]
  }
};
