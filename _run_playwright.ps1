param(
  [int]$Port = 5173,
  [string]$TestName = "",
  [int]$SlowMo = 100
)

$ProjectDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ResultDir = Join-Path $ProjectDir "test-results"
$ViteCmd = Join-Path $ProjectDir "node_modules\.bin\vite.cmd"

if (Test-Path $ResultDir) { Remove-Item "$ResultDir\*" -Force -ErrorAction SilentlyContinue }
else { New-Item $ResultDir -ItemType Directory -Force | Out-Null }

Write-Host ("=" * 60)
Write-Host ("[1/3] 启动 Vite 开发服务器 (端口 " + $Port + ") ...")
Write-Host ("=" * 60)

$env:BROWSER = "none"
$viteJob = Start-Job -ScriptBlock {
  param($cmd, $port, $dir)
  Set-Location $dir
  & $cmd "--port" $port "--strictPort"
} -ArgumentList $ViteCmd, $Port, $ProjectDir

$ready = $false
for ($i = 0; $i -lt 30; $i++) {
  Start-Sleep -Milliseconds 500
  try {
    $req = [System.Net.HttpWebRequest]::Create("http://localhost:$Port/")
    $req.Timeout = 1000
    $resp = $req.GetResponse()
    $resp.Close()
    $ready = $true
    break
  } catch { }
}

if (-not $ready) {
  Write-Host "Vite 启动超时！" -ForegroundColor Red
  Stop-Job $viteJob -ErrorAction SilentlyContinue
  Remove-Job $viteJob -ErrorAction SilentlyContinue
  exit 1
}

Write-Host ("Vite 已就绪: http://localhost:" + $Port) -ForegroundColor Green

$env:BASE_URL = "http://localhost:$Port"
$env:HEADLESS = "true"
$env:SLOWMO = [string]$SlowMo

$nodeArgs = @("_playwright_test.js")
if ($TestName) { $nodeArgs += $TestName }

Write-Host ("[2/3] 运行 Playwright 测试...")
$result = & "node" $nodeArgs 2>&1
Write-Host $result

Write-Host ("[3/3] 关闭 Vite...")
Stop-Job $viteJob -ErrorAction SilentlyContinue
Remove-Job $viteJob -ErrorAction SilentlyContinue

$proc = Get-Process -Name "node" -ErrorAction SilentlyContinue | Where-Object { $_.CommandLine -match "vite" }
if ($proc) { $proc | Stop-Process -Force }

Write-Host ("完成。测试结果截图保存在: " + $ResultDir)