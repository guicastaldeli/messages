@echo off
cd /d "./main"

cd /d ".\src\main\java\com\app\main\root\app\_api"

uvicorn __main:app --reload --port 3002

pause