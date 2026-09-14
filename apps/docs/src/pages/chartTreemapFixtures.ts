import type {TreemapChartProps} from '@sia.soul/sia-react-ui';
// Statically transcribed reference data; no downloaded scripts execute in the application.
export const chartTreemapFixtures:Record<string,Pick<TreemapChartProps,'title'|'description'|'data'|'itemStyle'|'emphasis'>> = {
  "treemap": {
    "title": "手机占有率",
    "description": "虚构数据",
    "data": [
      {
        "name": "三星",
        "value": 6
      },
      {
        "name": "小米",
        "value": 4
      },
      {
        "name": "苹果",
        "value": 4
      },
      {
        "name": "华为",
        "value": 2
      },
      {
        "name": "联想",
        "value": 2
      },
      {
        "name": "魅族",
        "value": 1
      },
      {
        "name": "中兴",
        "value": 1
      }
    ],
    "itemStyle": {
      "borderColor": "#ccc",
      "borderWidth": 1,
      "label": {
        "x": 5,
        "y": 12,
        "color": "#000",
        "fontSize": 13,
        "fontFamily": "Arial",
        "fontWeight": 400,
        "show": true,
        "formatter": "{b}"
      }
    },
    "emphasis": {
      "label": {
        "show": true
      }
    }
  },
  "treemap1": {
    "title": "手机占有率",
    "description": "数据下钻例子，虚构数据",
    "data": [
      {
        "name": "三星",
        "value": 6,
        "children": [
          {
            "name": "Galaxy S4",
            "value": 2
          },
          {
            "name": "Galaxy S5",
            "value": 3
          },
          {
            "name": "Galaxy S6",
            "value": 3
          },
          {
            "name": "Galaxy Tab",
            "value": 1
          }
        ],
        "style": {
          "color": "#99cccc"
        }
      },
      {
        "name": "小米",
        "value": 4,
        "children": [
          {
            "name": "小米3",
            "value": 6
          },
          {
            "name": "小米4",
            "value": 6
          },
          {
            "name": "红米",
            "value": 4
          }
        ],
        "style": {
          "color": "#99ccff"
        }
      },
      {
        "name": "苹果",
        "value": 4,
        "children": [
          {
            "name": "iPhone 5s",
            "value": 6
          },
          {
            "name": "iPhone 6",
            "value": 3
          },
          {
            "name": "iPhone 6+",
            "value": 3
          }
        ],
        "style": {
          "color": "#9999cc"
        }
      },
      {
        "name": "魅族",
        "value": 1,
        "children": [
          {
            "name": "MX4",
            "value": 6,
            "style": {
              "color": "#ccccff"
            }
          },
          {
            "name": "MX3",
            "value": 6,
            "style": {
              "color": "#99ccff"
            }
          },
          {
            "name": "魅蓝note",
            "value": 4,
            "style": {
              "color": "#9999cc"
            }
          },
          {
            "name": "MX4 pro",
            "value": 3,
            "style": {
              "color": "#99cccc"
            }
          }
        ],
        "style": {
          "color": "#ccff99"
        }
      },
      {
        "name": "华为",
        "value": 2,
        "style": {
          "color": "#ccffcc"
        }
      },
      {
        "name": "联想",
        "value": 2,
        "style": {
          "color": "#ccccff"
        }
      },
      {
        "name": "中兴",
        "value": 1,
        "children": [
          {
            "name": "V5",
            "value": 16
          },
          {
            "name": "努比亚",
            "value": 6
          },
          {
            "name": "功能机",
            "value": 4
          },
          {
            "name": "青漾",
            "value": 4
          },
          {
            "name": "星星",
            "value": 4
          },
          {
            "name": "儿童机",
            "value": 1
          }
        ],
        "style": {
          "color": "#ffffcc"
        }
      }
    ],
    "itemStyle": {
      "borderColor": "#ccc",
      "borderWidth": 1,
      "label": {
        "x": 5,
        "y": 12,
        "color": "#000",
        "fontSize": 13,
        "fontFamily": "Arial",
        "fontWeight": 400,
        "show": true,
        "formatter": "{b}"
      }
    },
    "emphasis": {
      "color": "#cc99cc",
      "borderWidth": 3,
      "borderColor": "#996699",
      "label": {
        "show": true
      }
    }
  },
  "treemap2": {
    "title": "手机占有率",
    "description": "虚构数据",
    "data": [
      {
        "name": "三星",
        "value": 6,
        "children": [
          {
            "name": "S4",
            "value": 6,
            "children": [
              {
                "name": "2012",
                "value": 6
              },
              {
                "name": "2013",
                "value": 4
              },
              {
                "name": "2014",
                "value": 3
              }
            ]
          },
          {
            "name": "note 3",
            "value": 6
          },
          {
            "name": "S5",
            "value": 4
          },
          {
            "name": "S6",
            "value": 3
          }
        ],
        "style": {
          "color": "#ccff99",
          "borderWidth": 1,
          "label": {
            "show": true,
            "formatter": "{b}最多",
            "x": 60,
            "y": 65,
            "color": "#ccc",
            "fontSize": 16
          }
        },
        "emphasis": {
          "color": "#cc9999",
          "borderWidth": 3,
          "borderColor": "#999999",
          "label": {
            "show": true,
            "formatter": "{b}-{c}",
            "x": 80,
            "y": 85,
            "color": "red",
            "fontSize": 18
          }
        }
      },
      {
        "name": "小米",
        "value": 4,
        "style": {
          "color": "#99ccff"
        },
        "emphasis": {
          "label": {
            "show": false
          }
        }
      },
      {
        "name": "苹果",
        "value": 4,
        "style": {
          "color": "#9999cc"
        }
      },
      {
        "name": "魅族",
        "value": 3,
        "style": {
          "color": "#99cccc"
        }
      },
      {
        "name": "华为",
        "value": 2,
        "style": {
          "color": "#ccffcc"
        }
      },
      {
        "name": "联想",
        "value": 2,
        "style": {
          "color": "#ccccff"
        }
      },
      {
        "name": "中兴",
        "value": 1,
        "style": {
          "borderWidth": 3,
          "label": {
            "show": true,
            "formatter": "{b}: {c}"
          }
        },
        "emphasis": {
          "color": "#cc9999",
          "borderWidth": 3,
          "borderColor": "#999999",
          "label": {
            "show": true
          }
        }
      }
    ],
    "itemStyle": {
      "borderColor": "#000",
      "borderWidth": 1,
      "label": {
        "x": 5,
        "y": 12,
        "color": "#00ffdd",
        "fontSize": 20,
        "fontFamily": "Times New Roman\",Georgia,Serif",
        "fontWeight": "bolder",
        "show": true,
        "formatter": "{b}: {c}",
        "fontStyle": "italic"
      }
    },
    "emphasis": {
      "color": "#cc99cc",
      "borderWidth": 3,
      "borderColor": "#996699",
      "label": {
        "show": true,
        "color": "#0000ff",
        "fontFamily": "Times New Roman\",Georgia,Serif",
        "fontSize": 18,
        "fontStyle": "normal",
        "fontWeight": "bold"
      }
    }
  }
};
