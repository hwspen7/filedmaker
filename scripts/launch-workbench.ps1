# Start a verified FiledMaker Venue Workbench instance without
# mistakenly reusing an old localhost:5174 server on another checkout.
$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$target = 'feature/big-ten-arena-parity'
Set-Location $root
if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
    throw 'Git is not installed or not on PATH.'
}
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    throw 'Node.js is not installed or not on PATH.'
}

Write-Host 'Checking the actual FiledMaker Git checkout...'
& git fetch origin $target
if ($LASTEXITCODE -ne 0) { throw 'Cannot fetch the designated FiledMaker development branch.' }

$localBranch = (& git branch --show-current).Trim()
if ($localBranch -ne $target) {
    $dirty = & git status --porcelain
    if ($dirty) {
        throw 'Local edits exist. Commit or stash them before switching branches; no files were discarded.'
    }
    & git switch $target
    if ($LASTEXITCODE -ne 0) {
        & git switch --track "origin/$target"
        if ($LASTEXITCODE -ne 0) { throw 'Cannot switch to the development branch.' }
    }
}
& git pull --ff-only origin $target
if ($LASTEXITCODE -ne 0) { throw 'Branch cannot fast-forward. Check local commits before updating.' }

$sha = (& git rev-parse HEAD).Trim()
$branch = (& git branch --show-current).Trim()
$head = Get-Content -Raw (Join-Path $root 'index.html')
if ($branch -ne $target -or -not $head.Contains('href="./workbench/"')) {
    throw 'This checkout does not contain Venue Workbench.'
}

# Never reuse an existing listening port: its process may serve an old
# main-branch checkout and a browser refresh cannot replace its files.
$port = 0
foreach ($candidate in 5188..5217) {
    $probe = [System.Net.Sockets.TcpListener]::new(
        [System.Net.IPAddress]::Loopback, [int]$candidate)
    try {
        $probe.Start()
        $probe.Stop()
        $port = $candidate
        break
    } catch {
        try { $probe.Stop() } catch {}
    }
}
if (-not $port) { throw 'No available port in 5188 through 5217.' }

$logDirectory = Join-Path $root 'build'
New-Item -ItemType Directory -Path $logDirectory -Force | Out-Null
$logOut = Join-Path $logDirectory "filedmaker-$port.stdout.log"
$logErr = Join-Path $logDirectory "filedmaker-$port.stderr.log"
$env:PORT = [string]$port
$nodeBinary = (Get-Command node).Source
$server = Start-Process -FilePath $nodeBinary -ArgumentList 'scripts/server.mjs' `
    -WorkingDirectory $root -RedirectStandardOutput $logOut `
    -RedirectStandardError $logErr -WindowStyle Hidden -PassThru

$url = "http://127.0.0.1:$port"
$served = $null
for ($i = 0; $i -lt 45; $i++) {
    Start-Sleep -Milliseconds 200
    try {
        $served = Invoke-RestMethod -Uri "$url/__filedmaker/status" -TimeoutSec 2
        break
    } catch {
        if ($server.HasExited) { break }
    }
}
if ($null -eq $served -or $served.branch -ne $target -or $served.commit -ne $sha) {
    if (-not $server.HasExited) { Stop-Process -Id $server.Id -Force }
    throw "Wrong or unresponsive server. Expected $target @ $sha. See $logErr"
}
Write-Host ""
Write-Host "Verified running source: $($served.branch)"
Write-Host "Verified running commit: $($served.commit.Substring(0, 12))"
Write-Host "Serving from: $($served.root)"
Write-Host "Open this Workbench URL, NOT an old localhost:5174 tab: $url/workbench/"
Write-Host "Server process: $($server.Id)"
Start-Process "$url/workbench/"
