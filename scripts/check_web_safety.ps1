# scripts/check_web_safety.ps1
# Automated Web Safety Scanner for VectorDB Browser UI
#
# Scans web/ (including web/js/tests) and fails with exit code 1 if it finds in code:
# - innerHTML, outerHTML, insertAdjacentHTML, document.write, eval(, new Function
# - createContextualFragment, DOMParser, srcdoc, javascript:, setAttribute("on...", ...)
# - assignments to .href or .src
# - inline style= or on<event>= attributes in HTML
# - <script> tags without a src attribute
# - external http(s):// URLs (other than 127.0.0.1 or localhost)
# - missing or improper CSP meta tag in index.html (must contain "default-src 'self'")
# Matches in comments are tracked and reported separately as informational notes.

$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot
$webDir = Join-Path $repoRoot "web"
$indexHtmlPath = Join-Path $webDir "index.html"

if (-not (Test-Path $webDir)) {
    Write-Error "Directory not found: $webDir"
    exit 1
}

$codeFindings = @()
$commentFindings = @()

# -----------------------------------------------------------------------------
# 1. Check CSP Meta Tag in web/index.html
# -----------------------------------------------------------------------------
if (-not (Test-Path $indexHtmlPath)) {
    $codeFindings += "ERROR: web/index.html not found"
} else {
    $indexContent = Get-Content $indexHtmlPath -Raw
    $cspRegex = '<meta\s+http-equiv=["'']Content-Security-Policy["'']\s+content=("([^"]+)"|''([^'']+)'')'
    if ($indexContent -match $cspRegex) {
        $cspValue = if ($matches[2]) { $matches[2] } else { $matches[3] }
        if ($cspValue -notmatch "default-src\s+'self'") {
            $codeFindings += "web/index.html: CSP meta tag does not contain required 'default-src ''self''' directive (got: $cspValue)"
        }
    } else {
        $codeFindings += "web/index.html: Missing <meta http-equiv='Content-Security-Policy'> tag"
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
    @{ Name = "new Function"; Pattern = '\bnew\s+Function\b' },
    @{ Name = "createContextualFragment"; Pattern = '\bcreateContextualFragment\b' },
    @{ Name = "DOMParser"; Pattern = '\bDOMParser\b' },
    @{ Name = "srcdoc"; Pattern = '\bsrcdoc\b' },
    @{ Name = "javascript:"; Pattern = '(?i)javascript:' },
    @{ Name = "setAttribute on*"; Pattern = '(?i)setAttribute\s*\(\s*["'']on' },
    @{ Name = "href/src assignment"; Pattern = '\.(href|src)\s*=' }
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
            foreach ($api in $dangerousApis) {
                if ($line -match $api.Pattern) {
                    $commentFindings += "${relPath}:${lineNum}: [Comment] Pattern '$($api.Name)' in block comment -> $trimmed"
                }
            }
            if ($trimmed -match '\*/') {
                $inBlockComment = $false
            }
            continue
        }
        if ($trimmed.StartsWith("/*")) {
            foreach ($api in $dangerousApis) {
                if ($line -match $api.Pattern) {
                    $commentFindings += "${relPath}:${lineNum}: [Comment] Pattern '$($api.Name)' in block comment start -> $trimmed"
                }
            }
            if ($trimmed -notmatch '\*/') {
                $inBlockComment = $true
            }
            continue
        }

        # Single-line comment lines
        if ($trimmed.StartsWith("//") -or $trimmed.StartsWith("*")) {
            foreach ($api in $dangerousApis) {
                if ($line -match $api.Pattern) {
                    $commentFindings += "${relPath}:${lineNum}: [Comment] Pattern '$($api.Name)' in line comment -> $trimmed"
                }
            }
            continue
        }

        # Extract code vs inline comment
        $codeOnly = $line
        $inlineComment = ""
        if ($line -match '(.*?)(//.*)$') {
            $codeOnly = $matches[1]
            $inlineComment = $matches[2]
        }

        # Check inline comment for patterns
        if ($inlineComment -ne "") {
            foreach ($api in $dangerousApis) {
                if ($inlineComment -match $api.Pattern) {
                    $commentFindings += "${relPath}:${lineNum}: [Comment] Pattern '$($api.Name)' in inline comment -> $trimmed"
                }
            }
        }

        # Check Dangerous APIs in real code
        foreach ($api in $dangerousApis) {
            if ($codeOnly -match $api.Pattern) {
                $codeFindings += "${relPath}:${lineNum}: Found dangerous API usage '$($api.Name)' -> $trimmed"
            }
        }

        # Check External URLs (exclude 127.0.0.1, localhost, and CSP http-equiv)
        if ($codeOnly -match 'https?://(?!(127\.0\.0\.1|localhost))') {
            # Ensure it's not http-equiv
            if ($codeOnly -notmatch 'http-equiv=') {
                $codeFindings += "${relPath}:${lineNum}: Found external http(s):// URL -> $trimmed"
            }
        }

        # HTML-specific structural checks
        if ($file.Extension -eq '.html') {
            # Check for inline style= attribute
            if ($codeOnly -match '<[^>]*\bstyle\s*=\s*["''][^"'']*["'']') {
                $codeFindings += "${relPath}:${lineNum}: Found inline style= attribute -> $trimmed"
            }

            # Check for inline on<event>= attribute (onclick, onload, onerror, etc.)
            if ($codeOnly -match '<[^>]*\bon[a-zA-Z]+\s*=\s*["''][^"'']*["'']') {
                $codeFindings += "${relPath}:${lineNum}: Found inline on<event>= attribute -> $trimmed"
            }

            # Check for <script> without src
            if ($codeOnly -match '<script\b(?![^>]*\bsrc\b)[^>]*>') {
                $codeFindings += "${relPath}:${lineNum}: Found <script> tag without src attribute -> $trimmed"
            }

            # Check for srcdoc attribute
            if ($codeOnly -match '<[^>]*\bsrcdoc\b') {
                $codeFindings += "${relPath}:${lineNum}: Found inline srcdoc attribute -> $trimmed"
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

if ($commentFindings.Count -gt 0) {
    Write-Host "Informational matches in comments ($($commentFindings.Count)): " -ForegroundColor Cyan
    foreach ($c in $commentFindings) {
        Write-Host "  [COMMENT] $c" -ForegroundColor DarkCyan
    }
}

if ($codeFindings.Count -eq 0) {
    Write-Host "ALL CHECKS PASSED: Zero forbidden patterns in active code." -ForegroundColor Green
    Write-Host "- Zero innerHTML, outerHTML, or insertAdjacentHTML"
    Write-Host "- Zero document.write, eval(), or new Function"
    Write-Host "- Zero createContextualFragment or DOMParser"
    Write-Host "- Zero srcdoc or javascript: URIs"
    Write-Host "- Zero setAttribute('on...') handlers"
    Write-Host "- Zero assignments to .href or .src"
    Write-Host "- Zero inline style= or on<event>= attributes"
    Write-Host "- Zero <script> tags without src attribute"
    Write-Host "- Zero external HTTP/HTTPS connections"
    Write-Host "- Strict CSP meta tag verified in index.html"
    exit 0
} else {
    Write-Host "SAFETY SCAN FAILED: Found $($codeFindings.Count) issue(s) in active code:" -ForegroundColor Red
    foreach ($f in $codeFindings) {
        Write-Host "  [FAIL] $f" -ForegroundColor Red
    }
    exit 1
}
