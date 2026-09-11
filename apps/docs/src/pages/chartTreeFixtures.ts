import type {TreeChartProps} from '@sia-ui/react';
import {chartTreeRoamFixture} from './chartTreeRoamFixture';
export const chartTreeFixtures:Record<string,TreeChartProps> = {
  tree2: chartTreeRoamFixture,
  "tree": {
    "title": "树图",
    "description": "虚构数据",
    "data": {
      "name": "根节点",
      "value": 6,
      "children": [
        {
          "name": "节点1",
          "value": 4,
          "children": [
            {
              "name": "叶子节点1",
              "value": 4
            },
            {
              "name": "叶子节点2",
              "value": 4
            },
            {
              "name": "叶子节点3",
              "value": 2
            },
            {
              "name": "叶子节点4",
              "value": 2
            },
            {
              "name": "叶子节点5",
              "value": 2
            },
            {
              "name": "叶子节点6",
              "value": 4
            }
          ]
        },
        {
          "name": "节点2",
          "value": 4,
          "children": [
            {
              "name": "叶子节点7",
              "value": 4
            },
            {
              "name": "叶子节点8",
              "value": 4
            }
          ]
        },
        {
          "name": "节点3",
          "value": 1,
          "children": [
            {
              "name": "叶子节点9",
              "value": 4
            },
            {
              "name": "叶子节点10",
              "value": 4
            },
            {
              "name": "叶子节点11",
              "value": 2
            },
            {
              "name": "叶子节点12",
              "value": 2
            }
          ]
        }
      ]
    },
    "orientation": "vertical",
    "rootPosition": [
      331.5,
      50
    ],
    "nodeSize": 20,
    "nodePadding": 1,
    "layerPadding": 100,
    "nodeColor": "#2ec7c9",
    "edgeColor": "#48b",
    "edgeWidth": 1,
    "edgeShadow": {
      "color": "#000",
      "blur": 3,
      "offsetX": 3,
      "offsetY": 5
    },
    "showLabels": false,
    "emphasisShowLabels": true,
    "linkStyle": "curve"
  }
};
