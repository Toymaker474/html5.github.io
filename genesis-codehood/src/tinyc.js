const BIN_OPS=['+','-','*','min','max','==','>'];
const UNARY_OPS=['abs','neg'];

const clone=x=>JSON.parse(JSON.stringify(x));
const pick=(a,rng)=>a[(rng()*a.length)|0];

export function randomTinyC(rng=Math.random,depth=0){
  if(depth>=3||rng()<.34){
    const leaf=(rng()*4)|0;
    if(leaf===0)return{kind:'var',name:'a'};
    if(leaf===1)return{kind:'var',name:'b'};
    return{kind:'const',value:leaf===2?0:1};
  }
  if(rng()<.22)return{kind:'unary',op:pick(UNARY_OPS,rng),x:randomTinyC(rng,depth+1)};
  return{kind:'binary',op:pick(BIN_OPS,rng),left:randomTinyC(rng,depth+1),right:randomTinyC(rng,depth+1)};
}

function mutateNode(node,rng,depth=0){
  if(rng()<.20)return randomTinyC(rng,Math.min(depth,2));
  const out=clone(node);
  if(out.kind==='var'){
    if(rng()<.45)out.name=out.name==='a'?'b':'a';
    else return randomTinyC(rng,depth);
  }else if(out.kind==='const'){
    if(rng()<.5)out.value=out.value?0:1;
    else return randomTinyC(rng,depth);
  }else if(out.kind==='unary'){
    if(rng()<.35)out.op=pick(UNARY_OPS,rng);else out.x=mutateNode(out.x,rng,depth+1);
  }else if(out.kind==='binary'){
    const r=rng();
    if(r<.25)out.op=pick(BIN_OPS,rng);
    else if(r<.62)out.left=mutateNode(out.left,rng,depth+1);
    else out.right=mutateNode(out.right,rng,depth+1);
  }
  return out;
}

export function mutateTinyC(ast,rng=Math.random){return mutateNode(ast,rng,0);}

export function crossoverTinyC(a,b,rng=Math.random){
  const donor=clone(b);
  function inject(node,depth=0){
    if(depth>0&&rng()<.28)return clone(donor);
    const out=clone(node);
    if(out.kind==='unary')out.x=inject(out.x,depth+1);
    else if(out.kind==='binary'){
      if(rng()<.5)out.left=inject(out.left,depth+1);else out.right=inject(out.right,depth+1);
    }
    return out;
  }
  return inject(a,0);
}

export function compileTinyC(ast){
  const code=[];
  function emit(node){
    if(!node){code.push({op:'PUSH_0',arg:0});return;}
    if(node.kind==='var'){code.push({op:node.name==='b'?'PUSH_B':'PUSH_A',arg:0});return;}
    if(node.kind==='const'){code.push({op:node.value?'PUSH_1':'PUSH_0',arg:0});return;}
    if(node.kind==='unary'){
      if(node.op==='neg'){code.push({op:'PUSH_0',arg:0});emit(node.x);code.push({op:'SUB',arg:0});}
      else{emit(node.x);code.push({op:'ABS',arg:0});}
      return;
    }
    if(node.kind==='binary'){
      emit(node.left);emit(node.right);
      const map={'+':'ADD','-':'SUB','*':'MUL','min':'MIN','max':'MAX','==':'EQ','>':'GT'};
      code.push({op:map[node.op]||'ADD',arg:0});
    }
  }
  emit(ast);return code;
}

function expr(node){
  if(node.kind==='var')return node.name;
  if(node.kind==='const')return String(node.value);
  if(node.kind==='unary')return node.op==='neg'?`(-${expr(node.x)})`:`abs(${expr(node.x)})`;
  if(node.op==='min'||node.op==='max')return `${node.op}(${expr(node.left)}, ${expr(node.right)})`;
  return `(${expr(node.left)} ${node.op} ${expr(node.right)})`;
}
export function renderTinyC(ast,name='program'){
  return `int ${name}(int a, int b) {\n  return ${expr(ast)};\n}`;
}
export function cloneTinyC(ast){return clone(ast);}
