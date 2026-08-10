export const OPS = Object.freeze([
  'PUSH_A','PUSH_B','PUSH_0','PUSH_1',
  'ADD','SUB','MUL','DIV','ABS','MIN','MAX',
  'DUP','SWAP','GT','LT','EQ',
  'LOAD','STORE','JMP','JZ','JNZ','HALT'
]);
export const EVOLVABLE_OPS = Object.freeze([
  'PUSH_A','PUSH_B','PUSH_0','PUSH_1',
  'ADD','SUB','DUP','SWAP','GT','LT','EQ',
  'LOAD','STORE','JMP','JZ','JNZ','HALT'
]);
export const DEFAULT_LIMITS = Object.freeze({maxInstructions:128,maxStack:32,registerCount:4,maxAbsValue:1e9});
const ARG_OPS=new Set(['LOAD','STORE','JMP','JZ','JNZ']),BRANCH_OPS=new Set(['JMP','JZ','JNZ']);
export function normalizeInstruction(ins){if(typeof ins==='string')return{op:ins,arg:0};if(!ins||typeof ins.op!=='string')return{op:'HALT',arg:0};return{op:OPS.includes(ins.op)?ins.op:'HALT',arg:Number.isFinite(ins.arg)?Math.trunc(ins.arg):0};}
export function cloneProgram(program){return program.map(normalizeInstruction);}
export function runProgram(program,input={},limits=DEFAULT_LIMITS){
  const code=cloneProgram(program),stack=[],regs=new Float64Array(limits.registerCount),a=Number(input.a??0),b=Number(input.b??0);let pc=0,steps=0,halted=false,error=null;
  const push=v=>{if(!Number.isFinite(v)||Math.abs(v)>limits.maxAbsValue){error='non-finite-or-out-of-range';return false;}if(stack.length>=limits.maxStack){error='stack-overflow';return false;}stack.push(v);return true;};
  const pop=()=>{if(!stack.length){error='stack-underflow';return null;}return stack.pop();};
  const jump=offset=>{const target=pc+Math.trunc(offset);if(target<0||target>=code.length){error='bad-jump';return false;}pc=target;return true;};
  while(!error&&!halted&&pc>=0&&pc<code.length&&steps<limits.maxInstructions){const{op,arg}=code[pc];steps++;pc++;const n=stack.length;
    if(op==='PUSH_A')push(a);else if(op==='PUSH_B')push(b);else if(op==='PUSH_0')push(0);else if(op==='PUSH_1')push(1);
    else if(op==='ADD'){const y=pop(),x=pop();if(!error)push(x+y);}else if(op==='SUB'){const y=pop(),x=pop();if(!error)push(x-y);}else if(op==='MUL'){const y=pop(),x=pop();if(!error)push(x*y);}else if(op==='DIV'){const y=pop(),x=pop();if(!error){if(y===0)error='divide-by-zero';else push(x/y);}}else if(op==='ABS'){const x=pop();if(!error)push(Math.abs(x));}else if(op==='MIN'){const y=pop(),x=pop();if(!error)push(Math.min(x,y));}else if(op==='MAX'){const y=pop(),x=pop();if(!error)push(Math.max(x,y));}
    else if(op==='DUP'){if(!n)error='stack-underflow';else push(stack[n-1]);}else if(op==='SWAP'){if(n<2)error='stack-underflow';else[stack[n-1],stack[n-2]]=[stack[n-2],stack[n-1]];}else if(op==='GT'){const y=pop(),x=pop();if(!error)push(x>y?1:0);}else if(op==='LT'){const y=pop(),x=pop();if(!error)push(x<y?1:0);}else if(op==='EQ'){const y=pop(),x=pop();if(!error)push(Object.is(x,y)||x===y?1:0);}else if(op==='LOAD'){const i=Math.abs(arg)%regs.length;push(regs[i]);}else if(op==='STORE'){const x=pop();if(!error)regs[Math.abs(arg)%regs.length]=x;}else if(op==='JMP')jump(arg);else if(op==='JZ'){const x=pop();if(!error&&x===0)jump(arg);}else if(op==='JNZ'){const x=pop();if(!error&&x!==0)jump(arg);}else if(op==='HALT')halted=true;else error='unknown-op';
  }
  if(!error&&!halted&&pc>=0&&pc<code.length&&steps>=limits.maxInstructions)error='instruction-budget';const value=stack.length?stack[stack.length-1]:null;return{ok:!error&&value!==null,value,error,steps,halted,stackDepth:stack.length,registers:Array.from(regs)};
}
export function randomInstruction(rng=Math.random){const op=EVOLVABLE_OPS[(rng()*EVOLVABLE_OPS.length)|0];let arg=0;if(op==='LOAD'||op==='STORE')arg=(rng()*4)|0;else if(BRANCH_OPS.has(op))arg=((rng()*11)|0)-5||1;return{op,arg};}
export function randomProgram(rng=Math.random,min=2,max=10){const n=min+((rng()*Math.max(1,max-min+1))|0);return Array.from({length:n},()=>randomInstruction(rng));}
export function mutateProgram(program,rng=Math.random,maxLength=32){const out=cloneProgram(program),r=rng();if(!out.length)return randomProgram(rng,2,6);if(r<.42)out[(rng()*out.length)|0]=randomInstruction(rng);else if(r<.67&&out.length<maxLength)out.splice((rng()*(out.length+1))|0,0,randomInstruction(rng));else if(r<.84&&out.length>1)out.splice((rng()*out.length)|0,1);else if(r<.93&&out.length<maxLength){const i=(rng()*out.length)|0;out.splice(i,0,{...out[i]});}else{const i=(rng()*out.length)|0,ins=out[i];if(ARG_OPS.has(ins.op))ins.arg+=rng()<.5?-1:1;else out[i]=randomInstruction(rng);}return out;}
export function crossoverPrograms(a,b,rng=Math.random,maxLength=32){if(!a.length)return cloneProgram(b).slice(0,maxLength);if(!b.length)return cloneProgram(a).slice(0,maxLength);const x=(rng()*(a.length+1))|0,y=(rng()*(b.length+1))|0;return cloneProgram(a.slice(0,x).concat(b.slice(y))).slice(0,maxLength);}
export function disassemble(program){return cloneProgram(program).map((ins,i)=>`${String(i).padStart(2,'0')}  ${ins.op}${ARG_OPS.has(ins.op)?' '+ins.arg:''}`).join('\n');}
