@echo off
cd /d "./main"

for /f "delims=" %%i in ('java -cp target\classes com.app.main.root.app._config.Loading init') do set MSG=%%i
echo %MSG%

.\mvnw -q spring-boot:run -Dspring-boot.run.arguments="--spring.main.banner-mode=off --logging.level.root=OFF"

pause