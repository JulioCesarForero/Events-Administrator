$ErrorActionPreference = "Stop"

$pgHost = if ($env:PGHOST) { $env:PGHOST } else { "localhost" }
$port = if ($env:PGPORT) { $env:PGPORT } else { "5432" }
$user = if ($env:PGUSER) { $env:PGUSER } else { "events_user" }
$db = if ($env:PGDATABASE) { $env:PGDATABASE } else { "events_admin" }

$scriptsRoot = $PSScriptRoot

Write-Host "Applying SQL from $scriptsRoot to ${user}@${pgHost}:${port}/${db}"

Get-ChildItem -Path $scriptsRoot -Recurse -Filter "*.sql" |
  Sort-Object FullName |
  ForEach-Object {
    Write-Host ">> $($_.FullName)"
    Get-Content $_.FullName | docker run -i --rm -e PGPASSWORD=$env:PGPASSWORD postgres:16-alpine psql -v ON_ERROR_STOP=1 -h $pgHost -p $port -U $user -d $db "sslmode=require"
    if ($LASTEXITCODE -ne 0) { throw "psql failed on $($_.FullName)" }
  }

Write-Host "Done."
