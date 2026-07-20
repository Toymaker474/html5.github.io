const STORAGE_KEY='godgenic_rewarded_ad_v1';

export class RewardedAdBridge {
  constructor({cooldownMs=15*60*1000,reward=25}={}){
    this.cooldownMs=cooldownMs;
    this.reward=reward;
    this.provider=null;
    this.state={lastRewardAt:0};
    try{this.state={...this.state,...JSON.parse(localStorage.getItem(STORAGE_KEY)||'{}')}}catch{}
  }
  setProvider(provider){
    if(provider&&typeof provider.showRewarded==='function')this.provider=provider;
  }
  remaining(now=Date.now()){
    return Math.max(0,this.cooldownMs-(now-this.state.lastRewardAt));
  }
  ready(){return this.remaining()===0}
  async showRewarded(){
    if(!this.ready())return{ok:false,reason:'cooldown',remaining:this.remaining()};
    if(this.provider){
      const result=await this.provider.showRewarded();
      if(!result?.completed)return{ok:false,reason:'not-completed'};
      this.state.lastRewardAt=Date.now();this.persist();
      return{ok:true,reward:this.reward,mode:'provider'};
    }
    await new Promise(resolve=>setTimeout(resolve,900));
    this.state.lastRewardAt=Date.now();this.persist();
    return{ok:true,reward:this.reward,mode:'demo'};
  }
  persist(){try{localStorage.setItem(STORAGE_KEY,JSON.stringify(this.state))}catch{}}
}
