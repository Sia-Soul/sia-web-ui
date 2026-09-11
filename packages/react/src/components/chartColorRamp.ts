/** Equally spaced low-to-high color stops, shared by map fills and range handles. */
export function chartColorRamp(colors:readonly string[],ratio:number):string {
 if(!colors.length)return '#ccc';
 const aliases:Record<string,string>={aqua:'#00ffff',lime:'#00ff00',orange:'#ffa500',orangered:'#ff4500',yellow:'#ffff00',lightskyblue:'#87cefa'};
 const normalize=(color:string)=>{const value=aliases[color.toLowerCase()]??color;return /^#[0-9a-f]{3}$/i.test(value)?'#'+[...value.slice(1)].map(c=>c+c).join(''):value;};
 const at=(Number.isFinite(ratio)?Math.max(0,Math.min(1,ratio)):0)*(colors.length-1);
 const index=Math.min(Math.floor(at),colors.length-1),weight=at-index;
 const start=normalize(colors[index]!),end=normalize(colors[Math.min(index+1,colors.length-1)]!);
 if(!/^#[0-9a-f]{6}$/i.test(start)||!/^#[0-9a-f]{6}$/i.test(end))return weight<.5?start:end;
 return '#'+[1,3,5].map(i=>Math.round(parseInt(start.slice(i,i+2),16)*(1-weight)+parseInt(end.slice(i,i+2),16)*weight).toString(16).padStart(2,'0')).join('');
}
