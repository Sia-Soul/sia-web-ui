/** Missing values split the path rather than connecting across the missing category. */
export function lineSegments(points:readonly (readonly [number,number])[]):(readonly [number,number])[][]{
 const result:(readonly [number,number])[][]=[];let segment:(readonly [number,number])[]=[];
 for(const point of points){if(point.every(Number.isFinite)){segment.push(point);}else if(segment.length){result.push(segment);segment=[];}}
 if(segment.length)result.push(segment);return result;
}
