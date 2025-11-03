@echo off
setlocal

if "%1"=="" (
    set APP_ENV=dev
) else (
    set APP_ENV=%1
)

cd /d "./main"

for /f "delims=" %%i in ('java -cp target\classes com.app.main.root.app.__config.Loading init') do set MSG=%%i

start "Server (%APP_ENV%)" cmd /k "echo %MSG% && echo Running in %APP_ENV% enviroment... && .\mvnw -q spring-boot:run -e -Dspring-boot.run.jvmArguments="-Dapp.env=%APP_ENV%" -Dspring-boot.run.arguments="--spring.main.banner-mode=off --logging.level.root=OFF""