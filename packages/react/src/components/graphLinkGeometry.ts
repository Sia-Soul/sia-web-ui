/** Native SVG geometry for directed links; reciprocal links use opposite parallel offsets. */
export function graphLinkGeometry(source:{x:number;y:number},target:{x:number;y:number},options:{curvature?:number;offset?:number;arrow?:boolean;targetRadius?:number;arrowSize?:readonly [number,number]}={}){
 const dx=target.x-source.x,dy=target.y-source.y,length=Math.hypot(dx,dy);
 const ux=length?dx/length:1,uy=length?dy/length:0,offset=options.offset??0;
 const sx=source.x-uy*offset,sy=source.y+ux*offset,tx=target.x-uy*offset,ty=target.y+ux*offset;
 const curvature=options.curvature??0,cx=(sx+tx)/2-dy*curvature,cy=(sy+ty)/2+dx*curvature;
 if(!options.arrow||!length)return {path:`M ${sx} ${sy} Q ${cx} ${cy} ${tx} ${ty}`,center:[cx,cy] as const,arrow:undefined};
 const tangentX=tx-cx,tangentY=ty-cy,tangentLength=Math.hypot(tangentX,tangentY)||1,ax=tangentX/tangentLength,ay=tangentY/tangentLength;
 const [width,height]=options.arrowSize??[10,15],gap=(options.targetRadius??0)+2;
 const tipX=tx-ax*gap,tipY=ty-ay*gap,baseX=tipX-ax*height,baseY=tipY-ay*height;
 return {path:`M ${sx} ${sy} Q ${cx} ${cy} ${tx} ${ty}`,center:[cx,cy] as const,arrow:`${tipX},${tipY} ${baseX-ay*width/2},${baseY+ax*width/2} ${baseX+ay*width/2},${baseY-ax*width/2}`};
}
