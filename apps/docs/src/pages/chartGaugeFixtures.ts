import type {GaugeDatum} from "@sia.soul/sia-react-ui";
export const chartGaugeFixtures:Record<string,{background?:string;data:(GaugeDatum&{labelMap?:Record<string,string>})[]}>={
  "gauge": {
    "data": [
      {
        "name": "仪表盘",
        "value": 50,
        "min": 0,
        "max": 100,
        "center": [
          331.5,
          189.5
        ],
        "radius": 142.125,
        "startAngle": -140,
        "endAngle": 140,
        "axisWidth": 30,
        "segments": [
          {
            "until": 0.2,
            "color": "lightgreen"
          },
          {
            "until": 0.4,
            "color": "orange"
          },
          {
            "until": 0.8,
            "color": "skyblue"
          },
          {
            "until": 1,
            "color": "#ff4500"
          }
        ],
        "splitNumber": 10,
        "tickCount": 5,
        "tickLength": 8,
        "tickColor": "#eee",
        "showTicks": true,
        "splitLength": 30,
        "splitWidth": 2,
        "splitColor": "#eee",
        "labelColor": "#333",
        "pointerWidth": 8,
        "pointerLength": 0.8,
        "pointerColor": "auto",
        "nameOffset": [
          -92.38125,
          -10
        ],
        "detailPosition": [
          -85.275,
          10
        ],
        "showName": true,
        "showDetail": true,
        "nameColor": "#333",
        "detailColor": "auto",
        "nameFontSize": 15,
        "detailFontSize": 30,
        "unit": "%",
        "glow": false,
        "labelMap": {
          "10": "弱",
          "30": "低",
          "60": "中",
          "90": "高"
        },
        "zIndex": 2,
        "detailBox": {
          "width": 100,
          "height": 40,
          "background": "rgba(0,0,0,0)",
          "borderWidth": 0,
          "borderColor": "#ccc"
        }
      }
    ]
  },
  "gauge1": {
    "data": [
      {
        "name": "完成率",
        "value": 50,
        "min": 0,
        "max": 100,
        "center": [
          331.5,
          189.5
        ],
        "radius": 142.125,
        "startAngle": -225,
        "endAngle": 45,
        "axisWidth": 10,
        "segments": [
          {
            "until": 0.2,
            "color": "#2ec7c9"
          },
          {
            "until": 0.8,
            "color": "#5ab1ef"
          },
          {
            "until": 1,
            "color": "#d87a80"
          }
        ],
        "splitNumber": 10,
        "tickCount": 10,
        "tickLength": 15,
        "splitLength": 22,
        "pointerWidth": 5,
        "pointerLength": 0.8,
        "nameOffset": [
          0,
          -56.85
        ],
        "detailPosition": [
          0,
          56.85
        ],
        "unit": "%",
        "glow": false,
        "tickColor": "auto",
        "splitColor": "auto",
        "labelColor": "auto",
        "zIndex": 2,
        "detailBox": {
          "width": 100,
          "height": 40,
          "borderWidth": 0
        }
      }
    ]
  },
  "gauge2": {
    "data": [
      {
        "name": "完成率",
        "value": 50,
        "min": 0,
        "max": 100,
        "center": [
          331.5,
          189.5
        ],
        "radius": 142.125,
        "startAngle": -225,
        "endAngle": 45,
        "axisWidth": 8,
        "segments": [
          {
            "until": 0.2,
            "color": "#228b22"
          },
          {
            "until": 0.8,
            "color": "#48b"
          },
          {
            "until": 1,
            "color": "#ff4500"
          }
        ],
        "splitNumber": 10,
        "tickCount": 10,
        "tickLength": 12,
        "tickColor": "auto",
        "splitLength": 30,
        "splitColor": "auto",
        "labelColor": "auto",
        "pointerWidth": 5,
        "pointerLength": 0.8,
        "nameOffset": [
          0,
          -56.85
        ],
        "detailPosition": [
          0,
          56.85
        ],
        "showName": true,
        "detailColor": "auto",
        "unit": "%",
        "glow": false,
        "zIndex": 2,
        "nameFontWeight": "bolder",
        "detailFontWeight": "bolder",
        "detailBox": {
          "width": 100,
          "height": 40,
          "borderWidth": 0
        }
      }
    ]
  },
  "gauge3": {
    "data": [
      {
        "name": "完成率",
        "value": 50,
        "min": 0,
        "max": 100,
        "center": [
          331.5,
          341.1
        ],
        "radius": 320,
        "startAngle": -180,
        "endAngle": 0,
        "axisWidth": 200,
        "segments": [
          {
            "until": 0.2,
            "color": "#2ec7c9"
          },
          {
            "until": 0.8,
            "color": "#5ab1ef"
          },
          {
            "until": 1,
            "color": "#d87a80"
          }
        ],
        "splitNumber": 10,
        "tickCount": 10,
        "tickLength": 12,
        "splitLength": 22,
        "labelColor": "#fff",
        "labelFontSize": 15,
        "pointerWidth": 50,
        "pointerLength": 0.9,
        "pointerColor": "rgba(255, 255, 255, 0.8)",
        "nameOffset": [
          0,
          -192
        ],
        "detailPosition": [
          0,
          -40
        ],
        "showName": true,
        "showDetail": true,
        "nameColor": "#fff",
        "nameFontSize": 30,
        "detailFontSize": 50,
        "unit": "%",
        "glow": false,
        "labelMap": {
          "10": "低",
          "50": "中",
          "90": "高"
        },
        "tickColor": "auto",
        "splitColor": "auto",
        "zIndex": 2,
        "labelFontWeight": "bolder",
        "detailBox": {
          "width": 100,
          "height": 40,
          "background": "rgba(0,0,0,0)",
          "borderWidth": 0,
          "borderColor": "#ccc"
        }
      }
    ]
  },
  "gauge4": {
    "data": [
      {
        "name": "km/h",
        "value": 40,
        "min": 0,
        "max": 220,
        "center": [
          331.5,
          189.5
        ],
        "radius": 142.125,
        "startAngle": -225,
        "endAngle": 45,
        "axisWidth": 10,
        "segments": [
          {
            "until": 0.2,
            "color": "#2ec7c9"
          },
          {
            "until": 0.8,
            "color": "#5ab1ef"
          },
          {
            "until": 1,
            "color": "#d87a80"
          }
        ],
        "splitNumber": 11,
        "tickCount": 10,
        "tickLength": 15,
        "tickColor": "auto",
        "splitLength": 20,
        "splitColor": "auto",
        "pointerWidth": 5,
        "pointerLength": 0.8,
        "nameOffset": [
          0,
          -56.85
        ],
        "detailPosition": [
          0,
          56.85
        ],
        "nameFontSize": 20,
        "unit": "",
        "glow": false,
        "labelColor": "auto",
        "zIndex": 3,
        "nameFontWeight": "bolder",
        "nameFontStyle": "italic",
        "detailFontWeight": "bolder",
        "detailBox": {
          "width": 100,
          "height": 40,
          "borderWidth": 0
        }
      },
      {
        "name": "x1000 r/min",
        "value": 1.5,
        "min": 0,
        "max": 7,
        "center": [
          165.75,
          208.45
        ],
        "radius": 94.75,
        "startAngle": -225,
        "endAngle": -45,
        "axisWidth": 8,
        "segments": [
          {
            "until": 0.2,
            "color": "#2ec7c9"
          },
          {
            "until": 0.8,
            "color": "#5ab1ef"
          },
          {
            "until": 1,
            "color": "#d87a80"
          }
        ],
        "splitNumber": 7,
        "tickCount": 10,
        "tickLength": 12,
        "tickColor": "auto",
        "splitLength": 20,
        "splitColor": "auto",
        "pointerWidth": 5,
        "pointerLength": 0.8,
        "nameOffset": [
          0,
          -28.425
        ],
        "detailPosition": [
          0,
          37.9
        ],
        "unit": "",
        "glow": false,
        "labelColor": "auto",
        "zIndex": 2,
        "detailFontWeight": "bolder",
        "detailBox": {
          "width": 100,
          "height": 40,
          "borderWidth": 0
        }
      },
      {
        "name": "gas",
        "value": 0.5,
        "min": 0,
        "max": 2,
        "center": [
          497.25,
          189.5
        ],
        "radius": 94.75,
        "startAngle": -135,
        "endAngle": -45,
        "axisWidth": 8,
        "segments": [
          {
            "until": 0.2,
            "color": "#ff4500"
          },
          {
            "until": 0.8,
            "color": "#48b"
          },
          {
            "until": 1,
            "color": "#228b22"
          }
        ],
        "splitNumber": 2,
        "tickCount": 5,
        "tickLength": 10,
        "tickColor": "auto",
        "splitLength": 15,
        "splitColor": "auto",
        "pointerWidth": 2,
        "pointerLength": 0.8,
        "nameOffset": [
          0,
          -37.9
        ],
        "detailPosition": [
          0,
          37.9
        ],
        "showName": false,
        "showDetail": false,
        "unit": "",
        "glow": false,
        "labelMap": {
          "0": "E",
          "1": "Gas",
          "2": "F"
        },
        "labelColor": "auto",
        "zIndex": 2,
        "detailBox": {
          "width": 100,
          "height": 40,
          "borderWidth": 0
        }
      },
      {
        "name": "gas",
        "value": 0.5,
        "min": 0,
        "max": 2,
        "center": [
          497.25,
          189.5
        ],
        "radius": 94.75,
        "startAngle": -315,
        "endAngle": -225,
        "axisWidth": 8,
        "segments": [
          {
            "until": 0.2,
            "color": "#ff4500"
          },
          {
            "until": 0.8,
            "color": "#48b"
          },
          {
            "until": 1,
            "color": "#228b22"
          }
        ],
        "splitNumber": 2,
        "tickCount": 10,
        "tickLength": 15,
        "showTicks": false,
        "splitLength": 15,
        "splitColor": "auto",
        "pointerWidth": 2,
        "pointerLength": 0.8,
        "nameOffset": [
          0,
          -37.9
        ],
        "detailPosition": [
          0,
          37.9
        ],
        "showName": false,
        "showDetail": false,
        "unit": "",
        "glow": false,
        "labelMap": {
          "0": "H",
          "1": "Water",
          "2": "C"
        },
        "tickColor": "auto",
        "labelColor": "auto",
        "zIndex": 2,
        "detailBox": {
          "width": 100,
          "height": 40,
          "borderWidth": 0
        }
      }
    ]
  },
  "gauge5": {
    "background": "#1b1b1b",
    "data": [
      {
        "name": "km/h",
        "value": 40,
        "min": 0,
        "max": 220,
        "center": [
          331.5,
          189.5
        ],
        "radius": 142.125,
        "startAngle": -225,
        "endAngle": 45,
        "axisWidth": 3,
        "segments": [
          {
            "until": 0.09,
            "color": "lime"
          },
          {
            "until": 0.82,
            "color": "#1e90ff"
          },
          {
            "until": 1,
            "color": "#ff4500"
          }
        ],
        "splitNumber": 11,
        "tickCount": 10,
        "tickLength": 15,
        "tickColor": "auto",
        "splitLength": 25,
        "splitWidth": 3,
        "splitColor": "#fff",
        "labelColor": "#fff",
        "pointerWidth": 5,
        "pointerLength": 0.8,
        "nameOffset": [
          0,
          -56.85
        ],
        "detailPosition": [
          0,
          71.0625
        ],
        "nameColor": "#fff",
        "detailColor": "#fff",
        "nameFontSize": 20,
        "unit": "",
        "glow": true,
        "zIndex": 2,
        "labelFontWeight": "bolder",
        "nameFontWeight": "bolder",
        "nameFontStyle": "italic",
        "detailFontWeight": "bolder",
        "detailBox": {
          "width": 100,
          "height": 40,
          "background": "rgba(30,144,255,0.8)",
          "borderWidth": 1,
          "borderColor": "#fff"
        }
      },
      {
        "name": "x1000 r/min",
        "value": 1.5,
        "min": 0,
        "max": 7,
        "center": [
          165.75,
          208.45
        ],
        "radius": 94.75,
        "startAngle": -225,
        "endAngle": -45,
        "axisWidth": 2,
        "segments": [
          {
            "until": 0.29,
            "color": "lime"
          },
          {
            "until": 0.86,
            "color": "#1e90ff"
          },
          {
            "until": 1,
            "color": "#ff4500"
          }
        ],
        "splitNumber": 7,
        "tickCount": 10,
        "tickLength": 12,
        "tickColor": "auto",
        "splitLength": 20,
        "splitWidth": 3,
        "splitColor": "#fff",
        "labelColor": "#fff",
        "pointerWidth": 5,
        "pointerLength": 0.8,
        "nameOffset": [
          0,
          -28.425
        ],
        "detailPosition": [
          25,
          18.95
        ],
        "nameColor": "#fff",
        "detailColor": "#fff",
        "unit": "",
        "glow": true,
        "zIndex": 2,
        "labelFontWeight": "bolder",
        "nameFontWeight": "bolder",
        "nameFontStyle": "italic",
        "detailFontWeight": "bolder",
        "detailBox": {
          "width": 80,
          "height": 30,
          "borderWidth": 0,
          "borderColor": "#fff"
        }
      },
      {
        "name": "gas",
        "value": 0.5,
        "min": 0,
        "max": 2,
        "center": [
          497.25,
          189.5
        ],
        "radius": 94.75,
        "startAngle": -135,
        "endAngle": -45,
        "axisWidth": 2,
        "segments": [
          {
            "until": 0.2,
            "color": "lime"
          },
          {
            "until": 0.8,
            "color": "#1e90ff"
          },
          {
            "until": 1,
            "color": "#ff4500"
          }
        ],
        "splitNumber": 2,
        "tickCount": 10,
        "tickLength": 12,
        "tickColor": "auto",
        "splitLength": 15,
        "splitWidth": 3,
        "splitColor": "#fff",
        "labelColor": "#fff",
        "pointerWidth": 2,
        "pointerLength": 0.8,
        "nameOffset": [
          0,
          -37.9
        ],
        "detailPosition": [
          0,
          37.9
        ],
        "showName": false,
        "showDetail": false,
        "unit": "",
        "glow": true,
        "labelMap": {
          "0": "E",
          "1": "Gas",
          "2": "F"
        },
        "zIndex": 2,
        "labelFontWeight": "bolder",
        "detailBox": {
          "width": 100,
          "height": 40,
          "borderWidth": 0
        }
      },
      {
        "name": "gas",
        "value": 0.5,
        "min": 0,
        "max": 2,
        "center": [
          497.25,
          189.5
        ],
        "radius": 94.75,
        "startAngle": -315,
        "endAngle": -225,
        "axisWidth": 2,
        "segments": [
          {
            "until": 0.2,
            "color": "lime"
          },
          {
            "until": 0.8,
            "color": "#1e90ff"
          },
          {
            "until": 1,
            "color": "#ff4500"
          }
        ],
        "splitNumber": 2,
        "tickCount": 10,
        "tickLength": 15,
        "showTicks": false,
        "splitLength": 15,
        "splitWidth": 3,
        "splitColor": "#fff",
        "labelColor": "#fff",
        "pointerWidth": 2,
        "pointerLength": 0.8,
        "nameOffset": [
          0,
          -37.9
        ],
        "detailPosition": [
          0,
          37.9
        ],
        "showName": false,
        "showDetail": false,
        "unit": "",
        "glow": true,
        "labelMap": {
          "0": "H",
          "1": "Water",
          "2": "C"
        },
        "tickColor": "auto",
        "zIndex": 2,
        "labelFontWeight": "bolder",
        "detailBox": {
          "width": 100,
          "height": 40,
          "borderWidth": 0
        }
      }
    ]
  }
};
