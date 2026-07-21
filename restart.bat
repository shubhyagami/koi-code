@echo off
echo =========================================
echo Killing any process using port 8082...
echo =========================================

FOR /F "tokens=5" %%T IN ('netstat -aon ^| findstr ":8082 "') DO (
    echo Found process with PID %%T on port 8082. Killing it...
    taskkill /F /PID %%T
)

echo.
echo =========================================
echo Restarting Java IDE Application...
echo =========================================
call mvnw.cmd spring-boot:run
