(()=>{
'use strict';
class Canvas3DMaterialsRenderer{
  constructor(canvas,width,height){this.canvas=canvas;this.gridWidth=width;this.gridHeight=height;this.kind='Canvas isometric fallback';this.ctx=canvas.getContext('2d',{alpha:false});this.state=null;this.yaw=0;}
  resize(){const d=Math.min(devicePixelRatio||1,1.5),w=Math.max(1,Math.round(this.canvas.clientWidth*d)),h=Math.max(1,Math.round(this.canvas.clientHeight*d));if(this.canvas.width!==w||this.canvas.height!==h){this.canvas.width=w;this.canvas.height=h;}}
  updateState(packed){this.state=packed;}
  orbit(dx){this.yaw+=dx*.004;}zoom(){}resetCamera(){this.yaw=0;}
  screenToGrid(clientX,clientY){const r=this.canvas.getBoundingClientRect();return{x:Math.max(0,Math.min(this.gridWidth-1,Math.floor((clientX-r.left)/r.width*this.gridWidth))),z:Math.max(0,Math.min(this.gridHeight-1,Math.floor((clientY-r.top)/r.height*this.gridHeight)))};}
  render(){this.resize();const c=this.ctx,w=this.canvas.width,h=this.canvas.height;c.fillStyle='#07111a';c.fillRect(0,0,w,h);if(!this.state)return;const stride=Math.max(1,Math.ceil(this.gridWidth/72)),sx=w/(this.gridWidth+this.gridHeight)*.84,sy=sx*.48,ox=w*.5,oy=h*.19;for(let z=0;z<this.gridHeight;z+=stride)for(let x=this.gridWidth-1;x>=0;x-=stride){const i=(z*this.gridWidth+x)*4,sand=this.state[i],water=this.state[i+1],wet=this.state[i+2],rock=this.state[i+3],height=(rock+sand)*sy*1.8,px=ox+(x-z)*sx,py=oy+(x+z)*sy-height;const size=sx*stride;c.beginPath();c.moveTo(px,py);c.lineTo(px+size,py+sy*stride);c.lineTo(px,py+sy*stride*2);c.lineTo(px-size,py+sy*stride);c.closePath();if(sand>.02){const r=Math.round(184-90*wet),g=Math.round(116-55*wet),b=Math.round(45-25*wet);c.fillStyle=`rgb(${r},${g},${b})`;}else c.fillStyle='#47433e';c.fill();if(water>.01){c.globalAlpha=.55;c.fillStyle='#1496b8';c.fill();c.globalAlpha=1;}}
  }
}
globalThis.GenesisCanvas3DMaterialsRenderer=Canvas3DMaterialsRenderer;
})();
