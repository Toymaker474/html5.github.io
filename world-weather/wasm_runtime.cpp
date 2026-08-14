#include <stddef.h>
extern "C" void* memset(void* dst,int value,size_t n){unsigned char* p=(unsigned char*)dst;for(size_t i=0;i<n;i++)p[i]=(unsigned char)value;return dst;}
extern "C" void* memcpy(void* dst,const void* src,size_t n){unsigned char* d=(unsigned char*)dst;const unsigned char* s=(const unsigned char*)src;for(size_t i=0;i<n;i++)d[i]=s[i];return dst;}
