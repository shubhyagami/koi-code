Write-Host "========================================="
Write-Host "Killing any process using port 8082..."
Write-Host "========================================="

$port = 8082
$process = Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique

if ($process) {
    Write-Host "Found process with PID $process on port $port. Killing it..."
    Stop-Process -Id $process -Force
} else {
    Write-Host "No process found on port $port."
}

Write-Host ""
Write-Host "========================================="
Write-Host "Restarting Java IDE Application..."
Write-Host "========================================="
.\mvnw.cmd spring-boot:run
