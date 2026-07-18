export const SENSOR_NAMES=['food','water','danger','kin','energy','temperature','memory','noise'];
export const OUTPUT_NAMES=['turn','thrust','eat','reproduce'];
const randn=()=>{let u=0,v=0;while(!u)u=Math.random();while(!v)v=Math.random();return Math.sqrt(-2*Math.log(u))*Math.cos(2*Math.PI*v)};
const clamp=(v,a=-1,b=1)=>Math.max(a,Math.min(b,v));
export class TinyBrain{
  constructor(weights=null,biases=null){
    this.input=8;this.hidden=6;this.output=4;
    this.w1=weights?.w1?Float32Array.from(weights.w1):Float32Array.from({length:48},()=>randn()*.42);
    this.w2=weights?.w2?Float32Array.from(weights.w2):Float32Array.from({length:24},()=>randn()*.42);
    this.b1=biases?.b1?Float32Array.from(biases.b1):new Float32Array(6);
    this.b2=biases?.b2?Float32Array.from(biases.b2):new Float32Array(4);
    this.hiddenState=new Float32Array(6);this.lastSensors=new Float32Array(8);this.lastOutputs=new Float32Array(4);this.rewardEMA=0;
  }
  forward(sensors){
    const h=this.hiddenState;
    for(let j=0;j<6;j++){let sum=this.b1[j]+h[j]*.16;for(let i=0;i<8;i++)sum+=sensors[i]*this.w1[j*8+i];h[j]=Math.tanh(sum)}
    for(let o=0;o<4;o++){let sum=this.b2[o];for(let j=0;j<6;j++)sum+=h[j]*this.w2[o*6+j];this.lastOutputs[o]=Math.tanh(sum)}
    this.lastSensors.set(sensors);return this.lastOutputs;
  }
  reinforce(reward,rate=.003){
    reward=clamp(reward);this.rewardEMA=this.rewardEMA*.97+reward*.03;
    for(let o=0;o<4;o++)for(let j=0;j<6;j++){const k=o*6+j;this.w2[k]=clamp(this.w2[k]+rate*reward*this.lastOutputs[o]*this.hiddenState[j],-2.5,2.5)}
    for(let j=0;j<6;j++)for(let i=0;i<8;i++){const k=j*8+i;this.w1[k]=clamp(this.w1[k]+rate*.25*reward*this.hiddenState[j]*this.lastSensors[i],-2.5,2.5)}
  }
  clone(){return new TinyBrain({w1:this.w1,w2:this.w2},{b1:this.b1,b2:this.b2})}
  mutate(rate=.04,scale=.18){const child=this.clone();for(const arr of[child.w1,child.w2,child.b1,child.b2])for(let i=0;i<arr.length;i++)if(Math.random()<rate)arr[i]=clamp(arr[i]+randn()*scale,-2.5,2.5);return child}
  static crossover(a,b,rate=.04){const child=a.clone();for(const[dst,x,y]of[[child.w1,a.w1,b.w1],[child.w2,a.w2,b.w2],[child.b1,a.b1,b.b1],[child.b2,a.b2,b.b2]])for(let i=0;i<dst.length;i++)dst[i]=Math.random()<.5?x[i]:y[i];return child.mutate(rate,.14)}
  genomeHash(){let h=2166136261;for(const arr of[this.w1,this.w2])for(const v of arr){h^=(v*10000)|0;h=Math.imul(h,16777619)}return(h>>>0).toString(16).padStart(8,'0')}
  serialize(){return{w1:[...this.w1],w2:[...this.w2],b1:[...this.b1],b2:[...this.b2]}}
}