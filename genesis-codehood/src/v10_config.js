export const SIZE_PRESETS=Object.freeze({TINY:[16,10],SMALL:[22,14],MEDIUM:[28,18],LARGE:[36,24]});
export const DEFAULT_WORLD_SETTINGS=Object.freeze({size:'MEDIUM',seed:0,landmass:.68,roughness:.58,wetness:.56,temperature:.52,rivers:.58,forests:.60,minerals:.62,wildlife:.30,predators:.22,ruins:.10});
const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v));
export function sanitizeWorldSettings(input={}){const d=DEFAULT_WORLD_SETTINGS,o={...d,...input};o.size=SIZE_PRESETS[o.size]?o.size:d.size;o.seed=(Number(o.seed)>>>0)||((Math.random()*0xffffffff)>>>0);for(const k of['landmass','roughness','wetness','temperature','rivers','forests','minerals','wildlife','predators','ruins'])o[k]=clamp(Number(o[k]));return o;}
export function dimensionsFor(settings){const s=sanitizeWorldSettings(settings),[cols,rows]=SIZE_PRESETS[s.size];return{cols,rows,cell:64,width:cols*64,height:rows*64};}
export const WORLDGEN_CONTROLS=Object.freeze([
  {key:'landmass',label:'Landmass',help:'More connected land; lower values create oceans and islands.'},
  {key:'roughness',label:'Mountains',help:'Controls relief, cliffs, highlands and alpine terrain.'},
  {key:'wetness',label:'Rainfall',help:'Shifts biome moisture and wetland abundance.'},
  {key:'temperature',label:'Temperature',help:'Moves the climate from colder tundra/taiga toward hot savanna/desert.'},
  {key:'rivers',label:'Rivers',help:'Changes the number of simulated downhill river paths.'},
  {key:'forests',label:'Forest cover',help:'Biases wet temperate land toward forest and rainforest.'},
  {key:'minerals',label:'Mineral wealth',help:'Controls ore richness in geological strata.'},
  {key:'wildlife',label:'Wildlife',help:'Sets carrying capacity and initial animal population.'},
  {key:'predators',label:'Predators',help:'Controls predator share, not total animal density.'},
  {key:'ruins',label:'Ancient traces',help:'Controls rare ruins without inventing a fake pre-generated civilization history.'}
]);
export function randomSeed(){return (crypto?.getRandomValues?crypto.getRandomValues(new Uint32Array(1))[0]:(Math.random()*0xffffffff))>>>0;}
