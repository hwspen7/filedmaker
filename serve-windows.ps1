# Local development server for the FiledMaker static site.
# Works with Windows PowerShell 5.1; requires neither Python nor Node.js.
$ErrorActionPreference = 'Stop'
$root = [System.IO.Path]::GetFullPath((Split-Path -Parent $MyInvocation.MyCommand.Path))
$rootPrefix = $root.TrimEnd([System.IO.Path]::DirectorySeparatorChar) + [System.IO.Path]::DirectorySeparatorChar
$port = 5174
$address = 'http://127.0.0.1:{0}/' -f $port
$listener = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Loopback, $port)

function Send-Response {
    param(
        [System.IO.Stream] $Stream,
        [int] $Status,
        [string] $Reason,
        [byte[]] $Body,
        [string] $ContentType,
        [bool] $HeadOnly = $false
    )
    $headers = "HTTP/1.1 $Status $Reason`r`nContent-Type: $ContentType`r`nContent-Length: $($Body.Length)`r`nCache-Control: no-store`r`nX-Content-Type-Options: nosniff`r`nConnection: close`r`n`r`n"
    $headerBytes = [System.Text.Encoding]::ASCII.GetBytes($headers)
    $Stream.Write($headerBytes, 0, $headerBytes.Length)
    if (-not $HeadOnly -and $Body.Length -gt 0) {
        $Stream.Write($Body, 0, $Body.Length)
    }
    $Stream.Flush()
}

function New-ErrorBody([string] $message) {
    return [System.Text.Encoding]::UTF8.GetBytes($message + "`n")
}

try {
    $listener.Start()
    Write-Host "FiledMaker server started at $address" -ForegroundColor Green
    Write-Host 'Keep this window open. Press Ctrl+C to stop the server.'
    try { Start-Process $address | Out-Null } catch { Write-Host "Open $address in your browser." }

    while ($true) {
        $client = $null
        $stream = $null
        $reader = $null
        try {
            $client = $listener.AcceptTcpClient()
            $client.ReceiveTimeout = 10000
            $client.SendTimeout = 10000
            $stream = $client.GetStream()
            $reader = [System.IO.StreamReader]::new($stream, [System.Text.Encoding]::ASCII, $false, 8192, $true)
            $requestLine = $reader.ReadLine()
            if ([string]::IsNullOrWhiteSpace($requestLine)) { continue }
            while ($true) {
                $line = $reader.ReadLine()
                if ($null -eq $line -or $line.Length -eq 0) { break }
            }
            $tokens = $requestLine.Split(' ')
            if ($tokens.Length -lt 2) {
                Send-Response $stream 400 'Bad Request' (New-ErrorBody 'Bad request') 'text/plain; charset=utf-8'
                continue
            }
            $method = $tokens[0].ToUpperInvariant()
            if ($method -ne 'GET' -and $method -ne 'HEAD') {
                Send-Response $stream 405 'Method Not Allowed' (New-ErrorBody 'Only GET and HEAD are supported') 'text/plain; charset=utf-8'
                continue
            }
            $headOnly = $method -eq 'HEAD'
            $requestPath = $tokens[1].Split('?')[0]
            $relativePath = [System.Uri]::UnescapeDataString($requestPath).TrimStart('/').Replace('/', [System.IO.Path]::DirectorySeparatorChar).Replace('\', [System.IO.Path]::DirectorySeparatorChar)
            if ([string]::IsNullOrEmpty($relativePath)) { $relativePath = 'index.html' }
            elseif ($requestPath.EndsWith('/')) { $relativePath = Join-Path $relativePath 'index.html' }
            $filePath = [System.IO.Path]::GetFullPath((Join-Path $root $relativePath))
            if (-not $filePath.StartsWith($rootPrefix, [System.StringComparison]::OrdinalIgnoreCase)) {
                Send-Response $stream 403 'Forbidden' (New-ErrorBody 'Forbidden') 'text/plain; charset=utf-8' $headOnly
                continue
            }
            if (-not [System.IO.File]::Exists($filePath)) {
                Send-Response $stream 404 'Not Found' (New-ErrorBody 'File not found') 'text/plain; charset=utf-8' $headOnly
                continue
            }
            switch ([System.IO.Path]::GetExtension($filePath).ToLowerInvariant()) {
                '.html' { $type = 'text/html; charset=utf-8' }
                '.css'  { $type = 'text/css; charset=utf-8' }
                '.js'   { $type = 'text/javascript; charset=utf-8' }
                '.mjs'  { $type = 'text/javascript; charset=utf-8' }
                '.json' { $type = 'application/json; charset=utf-8' }
                '.csv'  { $type = 'text/csv; charset=utf-8' }
                '.svg'  { $type = 'image/svg+xml' }
                '.png'  { $type = 'image/png' }
                '.jpg'  { $type = 'image/jpeg' }
                '.jpeg' { $type = 'image/jpeg' }
                '.webp' { $type = 'image/webp' }
                '.ico'  { $type = 'image/x-icon' }
                default { $type = 'application/octet-stream' }
            }
            $bytes = [System.IO.File]::ReadAllBytes($filePath)
            Send-Response $stream 200 'OK' $bytes $type $headOnly
        } catch {
            Write-Host ('Request failed: ' + $_.Exception.Message) -ForegroundColor Yellow
        } finally {
            if ($null -ne $reader) { $reader.Dispose() }
            if ($null -ne $stream) { $stream.Dispose() }
            if ($null -ne $client) { $client.Close() }
        }
    }
} catch {
    Write-Host ('Unable to start the local server: ' + $_.Exception.Message) -ForegroundColor Red
    exit 1
} finally {
    $listener.Stop()
}
