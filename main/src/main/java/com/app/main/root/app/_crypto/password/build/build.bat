@echo off
setlocal EnableDelayedExpansion

echo Building with Visual Studio Compiler
echo ====================================

set JAVA_HOME=C:\Program Files\Java\jdk-22
set VCPKG_ROOT=C:\Users\casta\OneDrive\Desktop\vscode\messages\main\vcpkg
set OPENSSL_INCLUDE=%VCPKG_ROOT%\installed\x64-windows\include
set OPENSSL_LIB=%VCPKG_ROOT%\installed\x64-windows\lib

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
echo Step 2: Cleaning previous builds...
del *.obj 2>nul
del passwordencoder.dll 2>nul

echo.
echo Step 3: Compiling with CL.EXE...
cl /nologo /c /O2 /EHsc /I"%JAVA_HOME%\include" /I"%JAVA_HOME%\include\win32" /I"%OPENSSL_INCLUDE%" ..\password_encoder.cpp
if %errorlevel% neq 0 (
    echo ERROR: Failed to compile password_encoder.cpp
    pause
    exit /b 1
)

cl /nologo /c /O2 /EHsc /I"%JAVA_HOME%\include" /I"%JAVA_HOME%\include\win32" /I"%OPENSSL_INCLUDE%" ..\password_encoder_jni.cpp
if %errorlevel% neq 0 (
    echo ERROR: Failed to compile password_encoder_jni.cpp
    pause
    exit /b 1
)

echo.
echo Step 4: Linking DLL with link.exe...
link /nologo /DLL /OUT:passwordencoder.dll password_encoder.obj password_encoder_jni.obj /LIBPATH:"%OPENSSL_LIB%" libssl.lib libcrypto.lib ws2_32.lib gdi32.lib crypt32.lib advapi32.lib

if %errorlevel% neq 0 (
    echo ERROR: Linking failed
    pause
    exit /b 1
)

echo.
echo Step 5: Copying required runtime DLLs...
if exist "%OPENSSL_LIB%\..\bin\libcrypto-3-x64.dll" (
    copy "%OPENSSL_LIB%\..\bin\libcrypto-3-x64.dll" . >nul
    echo Copied libcrypto-3-x64.dll
) else (
    echo libcrypto-3-x64.dll not found
)

if exist "%OPENSSL_LIB%\..\bin\libssl-3-x64.dll" (
    copy "%OPENSSL_LIB%\..\bin\libssl-3-x64.dll" . >nul
    echo Copied libssl-3-x64.dll
) else (
    echo libssl-3-x64.dll not found
)

echo.
echo Step 6: Final verification...
if exist passwordencoder.dll (
    echo BUILD SUCCESSFUL!
    echo.
    echo Created files:
    dir *.dll /B
) else (
    echo BUILD FAILED :/
)

echo.
pause