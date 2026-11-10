# scripts/run_benchmarks_pinned.ps1
# Runs vectordb_demo.exe pinned to a single CPU core (Affinity = 1) with High priority.
# Standard output is redirected to results\logs\full_run.txt for clean timing analysis.

$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot
$exePath = Join-Path $repoRoot "build\vectordb_demo.exe"
$outDir = Join-Path $repoRoot "results\logs"
$outPath = Join-Path $outDir "full_run.txt"

if (-not (Test-Path $exePath)) {
    Write-Error "Executable not found: $exePath. Please run cmake --build build first."
    exit 1
}

if (-not (Test-Path $outDir)) {
    New-Item -ItemType Directory -Path $outDir -Force | Out-Null
}

Write-Host "========================================="
Write-Host " VectorDB Pinned Benchmark Launcher"
Write-Host " Binary:    $exePath"
Write-Host " Priority:  High"
Write-Host " Affinity:  1 (Core 0)"
Write-Host " Output:    $outPath"
Write-Host "========================================="

$proc = Start-Process -FilePath $exePath `
    -RedirectStandardOutput $outPath `
    -PassThru `
    -NoNewWindow

# Pin to Core 0 (mask = 1) and elevate process priority
$proc.PriorityClass = 'High'
$proc.ProcessorAffinity = 1

Write-Host "Benchmark process started (PID: $($proc.Id)). Waiting for execution to complete..."
$proc.WaitForExit()

$exitCode = $proc.ExitCode
Write-Host "Benchmark completed with exit code: $exitCode"
exit $exitCode

