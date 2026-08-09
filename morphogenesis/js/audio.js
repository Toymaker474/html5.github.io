// ---------------- audio ----------------
function enableAudio(){
  if(audioOn)return;

  audioCtx=new(window.AudioContext||window.webkitAudioContext)();
  masterGain=audioCtx.createGain();
  masterGain.gain.value=.14;
  masterGain.connect(audioCtx.destination);

  const osc=audioCtx.createOscillator();
  const g=audioCtx.createGain();
  osc.type='sine';
  osc.frequency.value=43;
  g.gain.value=.05;
  osc.connect(g);
  g.connect(masterGain);
  osc.start();

  const len=audioCtx.sampleRate*2;
  const b=audioCtx.createBuffer(1,len,audioCtx.sampleRate);
  const d=b.getChannelData(0);
  for(let i=0;i<len;i++)d[i]=(Math.random()*2-1)*.22;

  const src=audioCtx.createBufferSource();
  const fil=audioCtx.createBiquadFilter();
  const ng=audioCtx.createGain();
  src.buffer=b;src.loop=true;
  fil.type='lowpass';fil.frequency.value=520;
  ng.gain.value=.028;
  src.connect(fil);fil.connect(ng);ng.connect(masterGain);
  src.start();

  audioOn=true;
  $('audio').textContent='SOUND ON';
}

function soundEvent(type,vol=.05){
  if(!audioOn||!audioCtx)return;
  const o=audioCtx.createOscillator(),g=audioCtx.createGain(),now=audioCtx.currentTime;
  let f=210,d=.06,w='sine';
  if(type==='kill'){f=70;d=.11;w='sawtooth'}
  if(type==='birth'){f=320;d=.12;w='triangle'}
  o.type=w;
  o.frequency.setValueAtTime(f,now);
  o.frequency.exponentialRampToValueAtTime(Math.max(30,f*.6),now+d);
  g.gain.setValueAtTime(vol,now);
  g.gain.exponentialRampToValueAtTime(.0001,now+d);
  o.connect(g);g.connect(masterGain);o.start(now);o.stop(now+d+.01);
}
