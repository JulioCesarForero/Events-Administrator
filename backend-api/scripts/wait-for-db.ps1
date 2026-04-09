# Espera a que el puerto TCP de PostgreSQL esté abierto (sin pg_isready en Windows).
param(
    [string]$DbHost = "localhost",
    [int]$Port = 5432,
    [int]$TimeoutSec = 60
)

$deadline = (Get-Date).AddSeconds($TimeoutSec)
Write-Host "Waiting for TCP ${DbHost}:$Port ..."
while ((Get-Date) -lt $deadline) {
    try {
        $c = [System.Net.Sockets.TcpClient]::new()
        $iar = $c.BeginConnect($DbHost, $Port, $null, $null)
        if ($iar.AsyncWaitHandle.WaitOne(1000) -and $c.Connected) {
            $c.Close()
            Write-Host "Port is open."
            exit 0
        }
        $c.Close()
    } catch { }
    Start-Sleep -Seconds 1
}
Write-Error "Timeout waiting for ${DbHost}:$Port"
exit 1
