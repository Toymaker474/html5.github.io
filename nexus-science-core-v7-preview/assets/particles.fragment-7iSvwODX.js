import{n as e}from"./rolldown-runtime-QTnfLwEv.js";import{t}from"./shaderStore-D-XQlhUT.js";import{t as n}from"./helperFunctions-DXk86ZpZ.js";import{t as r}from"./clipPlaneFragmentDeclaration-DCWCfCrs.js";import{t as i}from"./clipPlaneFragment-B27LjOUS.js";import{t as a}from"./logDepthDeclaration-BJAWQrwd.js";import{t as o}from"./imageProcessingDeclaration-DsCouT7M.js";import{t as s}from"./imageProcessingFunctions-DQRcKXqU.js";import{t as c}from"./fogFragmentDeclaration-D7HleZN3.js";import{t as l}from"./logDepthFragment-C5lxT4l1.js";import{t as u}from"./fogFragment-CKCGTcJi.js";var d=e({particlesPixelShader:()=>h}),f=`particlesPixelShader`,p=`#ifdef LOGARITHMICDEPTH
#extension GL_EXT_frag_depth : enable
#endif
varying vec2 vUV;varying vec4 vColor;uniform vec4 textureMask;uniform sampler2D diffuseSampler;
#include<clipPlaneFragmentDeclaration>
#include<imageProcessingDeclaration>
#include<logDepthDeclaration>
#include<helperFunctions>
#include<imageProcessingFunctions>
#ifdef RAMPGRADIENT
varying vec4 remapRanges;uniform sampler2D rampSampler;
#endif
#include<fogFragmentDeclaration>
#define CUSTOM_FRAGMENT_DEFINITIONS
void main(void) {
#define CUSTOM_FRAGMENT_MAIN_BEGIN
#include<clipPlaneFragment>
vec4 textureColor=texture2D(diffuseSampler,vUV);vec4 baseColor=(textureColor*textureMask+(vec4(1.,1.,1.,1.)-textureMask))*vColor;
#ifdef RAMPGRADIENT
float alpha=baseColor.a;float remappedColorIndex=clamp((alpha-remapRanges.x)/remapRanges.y,0.0,1.0);vec4 rampColor=texture2D(rampSampler,vec2(1.0-remappedColorIndex,0.));baseColor.rgb*=rampColor.rgb;float finalAlpha=baseColor.a;baseColor.a=clamp((alpha*rampColor.a-remapRanges.z)/remapRanges.w,0.0,1.0);
#endif
#ifdef BLENDMULTIPLYMODE
float sourceAlpha=vColor.a*textureColor.a;baseColor.rgb=baseColor.rgb*sourceAlpha+vec3(1.0)*(1.0-sourceAlpha);
#endif
#include<logDepthFragment>
#include<fogFragment>(color,baseColor)
#ifdef IMAGEPROCESSINGPOSTPROCESS
baseColor.rgb=toLinearSpace(baseColor.rgb);
#else
#ifdef IMAGEPROCESSING
baseColor.rgb=toLinearSpace(baseColor.rgb);baseColor=applyImageProcessing(baseColor);
#endif
#endif
gl_FragColor=baseColor;
#define CUSTOM_FRAGMENT_MAIN_END
}`;t.ShadersStore[f]||(t.ShadersStore[f]=p);var m=[r,o,a,n,s,c,i,l,u];for(let e of m)t.IncludesShadersStore[e.name]||(t.IncludesShadersStore[e.name]=e.shader);var h={name:f,shader:p};export{d as t};
//# sourceMappingURL=particles.fragment-7iSvwODX.js.map