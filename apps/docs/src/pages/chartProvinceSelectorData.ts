import source from './chartProvinceSelectorCities.json';

/** Called once for every new selection, preserving all 363 original random calls. */
export function createProvinceSelectorValues(random:()=>number=Math.random){
 return source.names.map(name=>({name,value:Math.round(random()*1000)}));
}
