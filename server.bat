@echo off
setlocal

if "%1"=="" (
    set APP_ENV=dev
) else (
    set APP_ENV=%1
)

cd /d "./main"

echo Generating configuration from .env...
node src\main\java\com\app\main\root\public\generate-config.js
if %errorlevel% neq 0 (
    echo Failed to generate configuration!
    pause
    exit /b %errorlevel%
)

for /f "delims=" %%i in ('java -cp target\classes com.app.main.root.app.__config.Loading init') do set MSG=%%i

start "Server (%APP_ENV%)" cmd /k "echo %MSG% && echo Running in %APP_ENV% enviroment... && .\mvnw -q spring-boot:run -e -Dspring-boot.run.jvmArguments="-Dapp.env=%APP_ENV%" -Dspring-boot.run.arguments="--spring.main.banner-mode=off --logging.level.root=OFF""