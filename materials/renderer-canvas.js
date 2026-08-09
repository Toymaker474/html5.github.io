(()=>{
'use strict';
class CanvasMaterialsRenderer{
  constructor(canvas,width,height){this.canvas=canvas;this.gridWidth=width;this.gridHeight=height;this.kind='Canvas2D fallback';this.ctx=canvas.getContext('2d',{alpha:false});this.off=document.createElement('canvas');this.off.width=width;this.off.height=height;this.octx=this.off.getContext('2d',{alpha:false});this.image=this.octx.createImageData(width,height);this.state=null;}
  resize(){const d=Math.min(devicePixelRatio||1,2),w=Math.max(1,Math.round(this.canvas.clientWidth*d)),h=Math.max(1,Math.round(this.canvas.clientHeight*d));if(this.canvas.width!==w||this.canvas.height!==h){this.canvas.width=w;this.canvas.height=h;}}
  updateState(packed){this.state=packed;const data=this.image.data,w=this.gridWidth,h=this.gridHeight;for(let y=0;y<h;y++)for(let x=0;x<w;x++){const src=(h-1-y)*w+x,p=packed[src],m=p&255,wet=((p>>8)&255)/255,i=(y*w+x)*4;let r=2,g=5,b=8;if(m===1){const n=((x*73856093^y*19349663)>>>0)%37/36;const dark=1-wet*.56;r=(125+105*n)*dark;g=(67+82*n)*dark;b=(24+26*n)*dark;}else if(m===2){r=8;g=93+((x+y)&7)*5;b=125+((x*3+y)&7)*6;}else if(m===3){const n=((x*13+y*7)&15)/15;r=g=b=35+n*45;}data[i]=r|0;data[i+1]=g|0;data[i+2]=b|0;data[i+3]=255;}this.octx.putImageData(this.image,0,0);}
  render(){this.resize();this.ctx.imageSmoothingEnabled=false;this.ctx.fillStyle='#02060a';this.ctx.fillRect(0,0,this.canvas.width,this.canvas.height);this.ctx.drawImage(this.off,0,0,this.canvas.width,this.canvas.height);}
}
globalThis.GenesisCanvasMaterialsRenderer=CanvasMaterialsRenderer;
})();
