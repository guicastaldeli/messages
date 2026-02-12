#ifndef JNI_MACROS_H
#define JNI_MACROS_H

#ifdef _WIN32
  #define JNI_EXPORT __declspec(dllexport)
#else
  #define JNI_EXPORT __attribute__((visibility("default")))
#endif

#endif