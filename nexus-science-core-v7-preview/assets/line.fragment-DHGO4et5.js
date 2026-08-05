import{n as e}from"./rolldown-runtime-QTnfLwEv.js";import{t}from"./shaderStore-D-XQlhUT.js";import{t as n}from"./clipPlaneFragmentDeclaration-DCWCfCrs.js";import{t as r}from"./clipPlaneFragment-B27LjOUS.js";import{t as i}from"./logDepthDeclaration-BJAWQrwd.js";import{t as a}from"./logDepthFragment-C5lxT4l1.js";var o=e({linePixelShader:()=>u}),s=`linePixelShader`,c=`#include<clipPlaneFragmentDeclaration>
uniform vec4 color;
#ifdef LOGARITHMICDEPTH
#extension GL_EXT_frag_depth : enable
#endif
#include<logDepthDeclaration>
#define CUSTOM_FRAGMENT_DEFINITIONS
void main(void) {
#define CUSTOM_FRAGMENT_MAIN_BEGIN
#include<logDepthFragment>
#include<clipPlaneFragment>
gl_FragColor=color;
#define CUSTOM_FRAGMENT_MAIN_END
}`;t.ShadersStore[s]||(t.ShadersStore[s]=c);var l=[n,i,a,r];for(let e of l)t.IncludesShadersStore[e.name]||(t.IncludesShadersStore[e.name]=e.shader);var u={name:s,shader:c};export{o as t};
//# sourceMappingURL=line.fragment-DHGO4et5.js.map