# scripts/check_web_safety.ps1
# Automated Web Safety Scanner for VectorDB Browser UI
#
# Scans web/ (including web/js/tests) and fails with exit code 1 if it finds:
# - innerHTML, outerHTML, insertAdjacentHTML, document.write, eval(, new Function
# - inline style= or on<event>= attributes
# - <script> tags without a src attribute
# - external http(s):// URLs (other than 127.0.0.1 or localhost)
# - missing or improper CSP meta tag in index.html (must contain "default-src 'self'")

$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot
$webDir = Join-Path $repoRoot "web"
$indexHtmlPath = Join-Path $webDir "index.html"

if (-not (Test-Path $webDir)) {
    Write-Error "Directory not found: $webDir"
    exit 1
}

$findings = @()

# -----------------------------------------------------------------------------
# 1. Check CSP Meta Tag in web/index.html
# -----------------------------------------------------------------------------
if (-not (Test-Path $indexHtmlPath)) {
    $findings += "ERROR: web/index.html not found"
} else {
    $indexContent = Get-Content $indexHtmlPath -Raw
    $cspRegex = '<meta\s+http-equiv=["'']Content-Security-Policy["'']\s+content=("([^"]+)"|''([^'']+)'')'
    if ($indexContent -match $cspRegex) {
        $cspValue = if ($matches[2]) { $matches[2] } else { $matches[3] }
        if ($cspValue -notmatch "default-src\s+'self'") {
            $findings += "web/index.html: CSP meta tag does not contain required 'default-src ''self''' directive (got: $cspValue)"
        }
    } else {
        $findings += "web/index.html: Missing <meta http-equiv='Content-Security-Policy'> tag"
    }
}

# -----------------------------------------------------------------------------
# 2. Scan All HTML and JS Files in web/
# -----------------------------------------------------------------------------
$files = Get-ChildItem -Path $webDir -Recurse -File | Where-Object { $_.Extension -in '.html', '.js' }

# Dangerous APIs across all code
$dangerousApis = @(
    @{ Name = "innerHTML"; Pattern = '\binnerHTML\b' },
    @{ Name = "outerHTML"; Pattern = '\bouterHTML\b' },
    @{ Name = "insertAdjacentHTML"; Pattern = '\binsertAdjacentHTML\b' },
    @{ Name = "document.write"; Pattern = '\bdocument\.write\b' },
    @{ Name = "eval("; Pattern = '\beval\s*\(' },
    @{ Name = "new Function"; Pattern = '\bnew\s+Function\b' }
)

foreach ($file in $files) {
    $relPath = $file.FullName.Substring($repoRoot.Length + 1).Replace('\', '/')
    $lines = Get-Content $file.FullName

    $inBlockComment = $false

    for ($i = 0; $i -lt $lines.Count; $i++) {
        $lineNum = $i + 1
        $line = $lines[$i]
        $trimmed = $line.Trim()

        # Handle block comment transitions
        if ($inBlockComment) {
            if ($trimmed -match '\*/') {
                $inBlockComment = $false
            }
            continue
        }
        if ($trimmed.StartsWith("/*")) {
            if ($trimmed -notmatch '\*/') {
                $inBlockComment = $true
            }
            continue
        }

        # Skip JSDoc and single-line comment lines
        if ($trimmed.StartsWith("//") -or $trimmed.StartsWith("*")) {
            continue
        }

        # Remove inline comments for line analysis
        $codeOnly = $line
        if ($codeOnly -match '(.*?)(//.*)$') {
            $codeOnly = $matches[1]
        }

        # Check Dangerous APIs
        foreach ($api in $dangerousApis) {
            if ($codeOnly -match $api.Pattern) {
                $findings += "${relPath}:${lineNum}: Found dangerous API usage '${api.Name}' -> $trimmed"
            }
        }

        # Check External URLs (exclude 127.0.0.1, localhost, and CSP http-equiv)
        if ($codeOnly -match 'https?://(?!(127\.0\.0\.1|localhost))') {
            # Ensure it's not http-equiv
            if ($codeOnly -notmatch 'http-equiv=') {
                $findings += "${relPath}:${lineNum}: Found external http(s):// URL -> $trimmed"
            }
        }

        # HTML-specific structural checks
        if ($file.Extension -eq '.html') {
            # Check for inline style= attribute
            if ($codeOnly -match '<[^>]*\bstyle\s*=\s*["''][^"'']*["'']') {
                $findings += "${relPath}:${lineNum}: Found inline style= attribute -> $trimmed"
            }

            # Check for inline on<event>= attribute (onclick, onload, onerror, etc.)
            if ($codeOnly -match '<[^>]*\bon[a-zA-Z]+\s*=\s*["''][^"'']*["'']') {
                $findings += "${relPath}:${lineNum}: Found inline on<event>= attribute -> $trimmed"
            }

            # Check for <script> without src
            if ($codeOnly -match '<script\b(?![^>]*\bsrc\b)[^>]*>') {
                $findings += "${relPath}:${lineNum}: Found <script> tag without src attribute -> $trimmed"
            }
        }
    }
}

# -----------------------------------------------------------------------------
# 3. Report Results
# -----------------------------------------------------------------------------
Write-Host "========================================="
Write-Host " VectorDB Automated Web Safety Scanner"
Write-Host " Scanned $($files.Count) HTML and JS files in web/"
Write-Host "========================================="

if ($findings.Count -eq 0) {
    Write-Host "ALL CHECKS PASSED: Zero forbidden patterns found." -ForegroundColor Green
    Write-Host "- Zero innerHTML, outerHTML, or insertAdjacentHTML"
    Write-Host "- Zero document.write, eval(), or new Function"
    Write-Host "- Zero inline style= or on<event>= attributes"
    Write-Host "- Zero <script> tags without src attribute"
    Write-Host "- Zero external HTTP/HTTPS connections"
    Write-Host "- Strict CSP meta tag verified in index.html"
    exit 0
} else {
    Write-Host "SAFETY SCAN FAILED: Found $($findings.Count) issue(s):" -ForegroundColor Red
    foreach ($f in $findings) {
        Write-Host "  [FAIL] $f" -ForegroundColor Red
    }
    exit 1
}
