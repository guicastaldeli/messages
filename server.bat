@echo off
cd /d "./main"

for /f "delims=" %%i in ('java -cp target\classes com.app.main.root.app.__config.Loading init') do set MSG=%%i
echo %MSG%

::API
start "api" cmd /k "cd /d ".\src\main\java\com\app\main\root\app\_api" && uvicorn __main:app --reload --port 3002"

::Server
.\mvnw -q spring-boot:run -Dspring-boot.run.arguments="--spring.main.banner-mode=off --logging.level.root=OFF"

pause