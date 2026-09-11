export interface VisualPiece {min:number;max:number;}
/** Adjacent ranges use (min,max], with the overall minimum included. Order independent. */
export function visualPieceIndex(value:number,pieces:readonly VisualPiece[]){
 if(!Number.isFinite(value)||!pieces.length)return -1;
 const minimum=Math.min(...pieces.map(p=>p.min));
 return pieces.findIndex(p=>value<=p.max&&(value>p.min||value===minimum&&p.min===minimum));
}
