@echo off
setlocal EnableDelayedExpansion

echo Building with Visual Studio Compiler
echo ====================================

set JAVA_HOME=C:\Program Files\Java\jdk-22
set VCPKG_ROOT=C:\Users\casta\OneDrive\Desktop\vscode\messages\main\vcpkg
set OPENSSL_INCLUDE=%VCPKG_ROOT%\installed\x64-windows\include
set OPENSSL_LIB=%VCPKG_ROOT%\installed\x64-windows\lib
set PTHREAD_INCLUDE=%VCPKG_ROOT%\installed\x64-windows\include
set PTHREAD_LIB=%VCPKG_ROOT%\installed\x64-windows\lib

echo.
set VS_PATH=C:\Program Files\Microsoft Visual Studio\2022\Community\VC\Auxiliary\Build

if exist "%VS_PATH%\vcvars64.bat" (
    call "%VS_PATH%\vcvars64.bat"
    echo Visual Studio environment loaded :D
) else (
    echo ERROR: Visual Studio not found. Please install Visual Studio Build Tools.
    pause
    exit /b 1
)

echo.
echo Cleaning previous builds...
del *.obj 2>nul
del file_compressor.dll 2>nul

echo.
echo Compiling with CL.EXE...
cl /nologo /c /O2 /EHsc /std:c++17 /I"%JAVA_HOME%\include" /I"%JAVA_HOME%\include\win32" /I"%OPENSSL_INCLUDE%" /I"%PTHREAD_INCLUDE%" ..\_main.c
if %errorlevel% neq 0 (
    echo ERROR: Failed to compile _main.c
    pause
    exit /b 1
)

echo.
echo Compiling with CL.EXE...
cl /nologo /c /O2 /EHsc /std:c++17 /I"%JAVA_HOME%\include" /I"%JAVA_HOME%\include\win32" /I"%OPENSSL_INCLUDE%" /I"%PTHREAD_INCLUDE%" ..\_file_compressor_jni.c
if %errorlevel% neq 0 (
    echo ERROR: Failed to compile _file_compressor_jni.c
    pause
    exit /b 1
)

echo.
echo Compiling with CL.EXE...
cl /nologo /c /O2 /EHsc /std:c++17 /I"%JAVA_HOME%\include" /I"%JAVA_HOME%\include\win32" /I"%OPENSSL_INCLUDE%" /I"%PTHREAD_INCLUDE%" ..\bp.c
if %errorlevel% neq 0 (
    echo ERROR: Failed to compile bp.c
    pause
    exit /b 1
)

echo.
echo Compiling with CL.EXE...
cl /nologo /c /O2 /EHsc /std:c++17 /I"%JAVA_HOME%\include" /I"%JAVA_HOME%\include\win32" /I"%OPENSSL_INCLUDE%" /I"%PTHREAD_INCLUDE%" ..\comp.c
if %errorlevel% neq 0 (
    echo ERROR: Failed to compile comp.c
    pause
    exit /b 1
)

echo.
echo Compiling with CL.EXE...
cl /nologo /c /O2 /EHsc /std:c++17 /I"%JAVA_HOME%\include" /I"%JAVA_HOME%\include\win32" /I"%OPENSSL_INCLUDE%" /I"%PTHREAD_INCLUDE%" ..\delta.c
if %errorlevel% neq 0 (
    echo ERROR: Failed to compile delta.c
    pause
    exit /b 1
)

echo.
echo Compiling with CL.EXE...
cl /nologo /c /O2 /EHsc /std:c++17 /I"%JAVA_HOME%\include" /I"%JAVA_HOME%\include\win32" /I"%OPENSSL_INCLUDE%" /I"%PTHREAD_INCLUDE%" ..\rl.c
if %errorlevel% neq 0 (
    echo ERROR: Failed to compile rl.c
    pause
    exit /b 1
)

echo.
echo Compiling with CL.EXE...
cl /nologo /c /O2 /EHsc /std:c++17 /I"%JAVA_HOME%\include" /I"%JAVA_HOME%\include\win32" /I"%OPENSSL_INCLUDE%" /I"%PTHREAD_INCLUDE%" ..\sliding_window.c
if %errorlevel% neq 0 (
    echo ERROR: Failed to compile sliding_window.c
    pause
    exit /b 1
)

echo.
echo Linking DLL with link.exe...
link /nologo /DLL /OUT:file_compressor.dll _main.obj _file_compressor_jni.obj bp.obj comp.obj delta.obj rl.obj sliding_window.obj /LIBPATH:"%OPENSSL_LIB%" /LIBPATH:"%PTHREAD_LIB%" libssl.lib libcrypto.lib pthreadVC3.lib ws2_32.lib gdi32.lib crypt32.lib advapi32.lib

if %errorlevel% neq 0 (
    echo ERROR: Linking failed
    pause
    exit /b 1
)

echo.
echo Copying required runtime DLLs...
if exist "%OPENSSL_LIB%\..\bin\libcrypto-3-x64.dll" (
    copy "%OPENSSL_LIB%\..\bin\libcrypto-3-x64.dll" . >nul
    echo Copied libcrypto-3-x64.dll
)

if exist "%OPENSSL_LIB%\..\bin\libssl-3-x64.dll" (
    copy "%OPENSSL_LIB%\..\bin\libssl-3-x64.dll" . >nul
    echo Copied libssl-3-x64.dll
)

if exist "%PTHREAD_LIB%\..\bin\pthreadVC3.dll" (
    copy "%PTHREAD_LIB%\..\bin\pthreadVC3.dll" . >nul
    echo Copied pthreadVC3.dll
)

echo.
echo Final verification...
if exist file_compressor.dll (
    echo BUILD SUCCESSFUL!
    echo.
    echo Created files:
    dir *.dll /B
) else (
    echo BUILD FAILED :/
)

echo.
pause