import{RewardedAdBridge}from'./rewarded-ad.js?v=4';
export const TAU=Math.PI*2;
export const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v));
export const wrap=(v,m)=>((v%m)+m)%m;
export const STORE='sandbox_god_genic_alien_v4';
export const ROLE_META={grazer:{name:'Glowgrazer',icon:'◒',hue:125,desc:'Feeds on bioluminescent growth and moves in nervous herds.'},stalker:{name:'Riftstalker',icon:'⌁',hue:350,desc:'Tracks smaller prey, waits, then attacks in short bursts.'},scavenger:{name:'Mirepicker',icon:'⌬',hue:48,desc:'Follows danger and converts carcasses back into energy.'},lurker:{name:'Veil Lurker',icon:'◈',hue:285,desc:'Hides near dense terrain and ambushes passing organisms.'},glider:{name:'Skyfin',icon:'◇',hue:195,desc:'Uses low-cost sweeping movement and escapes storms quickly.'}};
export const wallet={points:0,bucks:0,hunts:0,rains:0,discoveries:0,lastBirths:0,lastSpecies:0};
try{Object.assign(wallet,JSON.parse(localStorage.getItem(STORE)||'{}'))}catch{}
export const input={x:0,y:0,boost:false,pointer:null};
export const v4State=window.__godV4={possessId:0,quality:'auto'};
export const adBridge=new RewardedAdBridge({reward:25});
window.GodGenicAds={setProvider:p=>adBridge.setProvider(p)};
export function save(){try{localStorage.setItem(STORE,JSON.stringify(wallet))}catch{}}
export function renderWallet(){for(const[id,value]of[['v4Points',wallet.points],['v4Bucks',wallet.bucks]]){const el=document.getElementById(id);if(el)el.textContent=Math.floor(value).toLocaleString()}}
export function toast(message){const el=document.getElementById('toast');if(!el)return;el.textContent=message;el.classList.add('show');clearTimeout(window.__v4Toast);window.__v4Toast=setTimeout(()=>el.classList.remove('show'),1800)}
export function award(points=0,bucks=0,label=''){wallet.points+=points;wallet.bucks+=bucks;save();renderWallet();if(label)toast(`${label} · +${points} GP${bucks?` · +${bucks} Buck`:''}`)}
export function shortest(a,b,size){let d=b-a;if(d>size/2)d-=size;if(d<-size/2)d+=size;return d}
export function distance(a,b,size){return Math.hypot(shortest(a.x,b.x,size),shortest(a.y,b.y,size))}
