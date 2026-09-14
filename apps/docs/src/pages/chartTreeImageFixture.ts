import type {TreeChartProps} from '@sia.soul/sia-react-ui';
// Not registered as implemented: all five original image endpoints are currently unavailable.
export const chartTreeImageFixture:TreeChartProps = {
  "title": "手机品牌",
  "description": "线、节点样式",
  "data": {
    "name": "手机",
    "value": 6,
    "symbol": "image://http://www.iconpng.com/png/ecommerce-business/iphone.png",
    "symbolSize": [
      90,
      70
    ],
    "itemStyle": {
      "label": {
        "show": false
      }
    },
    "children": [
      {
        "name": "小米",
        "value": 4,
        "symbol": "image://http://pic.58pic.com/58pic/12/36/51/66d58PICMUV.jpg",
        "symbolSize": [
          60,
          60
        ],
        "itemStyle": {
          "label": {
            "show": false
          }
        },
        "children": [
          {
            "name": "小米1",
            "value": 4,
            "symbol": "circle",
            "symbolSize": 20,
            "itemStyle": {
              "color": "#fa6900",
              "label": {
                "show": true,
                "position": "right"
              }
            },
            "emphasis": {
              "borderWidth": 0,
              "label": {
                "show": false
              }
            }
          },
          {
            "name": "小米2",
            "value": 4,
            "symbol": "circle",
            "symbolSize": 20,
            "itemStyle": {
              "color": "#fa6900",
              "borderWidth": 2,
              "borderColor": "#cc66ff",
              "label": {
                "show": true,
                "position": "right",
                "formatter": "{b}"
              }
            },
            "emphasis": {
              "borderWidth": 0
            }
          },
          {
            "name": "小米3",
            "value": 2,
            "symbol": "circle",
            "symbolSize": 20,
            "itemStyle": {
              "color": "#fa6900",
              "brushType": "stroke",
              "borderWidth": 1,
              "borderColor": "#999966",
              "label": {
                "position": "right"
              }
            },
            "emphasis": {
              "borderWidth": 0
            }
          }
        ]
      },
      {
        "name": "苹果",
        "value": 4,
        "symbol": "image://http://www.viastreaming.com/images/apple_logo2.png",
        "symbolSize": [
          60,
          60
        ],
        "itemStyle": {
          "label": {
            "show": false
          }
        }
      },
      {
        "name": "华为",
        "value": 2,
        "symbol": "image://http://market.huawei.com/hwgg/logo_cn/download/logo.jpg",
        "symbolSize": [
          60,
          60
        ],
        "itemStyle": {
          "label": {
            "show": false
          }
        }
      },
      {
        "name": "联想",
        "value": 2,
        "symbol": "image://http://www.lenovo.com.cn/HomeUpload/Home001/6d94ee9a20140714.jpg",
        "symbolSize": [
          100,
          40
        ],
        "itemStyle": {
          "label": {
            "show": false
          }
        }
      }
    ]
  },
  "orientation": "horizontal",
  "rootPosition": [
    100,
    227.4
  ],
  "nodePadding": 20,
  "nodeSize": 40,
  "layerPadding": 100,
  "linkStyle": "broken",
  "edgeColor": "#000",
  "edgeWidth": 1,
  "itemStyle": {
    "label": {
      "show": true,
      "position": "inside",
      "color": "#cc9999",
      "fontSize": 15,
      "fontWeight": "bolder"
    }
  },
  "emphasis": {
    "label": {
      "show": true
    }
  }
};
