@echo off
setlocal

if "%1"=="" (
    set APP_ENV=dev
) else (
    set APP_ENV=%1
)

cd /d "./main"
cd /d ".\src\main\java\com\app\main\root"

set APP_ENV=%APP_ENV%
set TURBOPACK=0
start "Client (%APP_ENV%)" cmd /k "echo Running in %APP_ENV% environment... && set APP_ENV=%APP_ENV% && set TURBOPACK=0 && npx next dev"