@echo off
setlocal

if "%1"=="" (
    set APP_ENV=dev
) else (
    set APP_ENV=%1
)

cd /d "./main"
cd /d ".\src\main\java\com\app\main\root\app\_api"

set APP_ENV=%APP_ENV%
start "API Server (%APP_ENV%)" cmd /k "echo Running in %APP_ENV% environment... && set APP_ENV=%APP_ENV% && uvicorn __main:app --reload --port 3002"