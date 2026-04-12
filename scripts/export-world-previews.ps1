param(
  [string]$WorldDir = "C:\Users\Smirk\Ghosted\public\worlds\shared-commons\v1",
  [string]$WorldSpecPath = "C:\Users\Smirk\Ghosted\src\lib\worlds\shared-commons.world.json",
  [string]$OutputDir = "C:\Users\Smirk\Ghosted\tmp\world-previews\shared-commons\v1",
  [int]$Width = 5250,
  [int]$Height = 1050,
  [switch]$IncludeGuides,
  [switch]$CaptureHomepageBaselines
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Resolve-BrowserPath {
  $candidates = @(
    'C:\Program Files\Google\Chrome\Application\chrome.exe',
    'C:\Program Files (x86)\Google\Chrome\Application\chrome.exe',
    'C:\Program Files\Microsoft\Edge\Application\msedge.exe',
    'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'
  )

  foreach ($candidate in $candidates) {
    if (Test-Path $candidate) {
      return $candidate
    }
  }

  throw 'Could not find Chrome or Edge for preview export.'
}

function Convert-ToFileUri([string]$Path) {
  return [System.Uri]::new((Resolve-Path $Path).Path).AbsoluteUri
}

function New-GuideMarkup {
  param(
    [pscustomobject]$Spec
  )

  $guides = $Spec.guides
  $labelSafeTop = if ($guides.labelSafeTop) {
@"
      <rect x="$($guides.labelSafeTop.x)" y="$($guides.labelSafeTop.y)" width="$($guides.labelSafeTop.width)" height="$($guides.labelSafeTop.height)" fill="rgba(255,225,104,0.06)" stroke="rgba(255,225,104,0.52)" stroke-dasharray="5 4" stroke-width="1" />
"@
  } else {
    ''
  }

@"
      <rect x="$($guides.safeArea.x)" y="$($guides.safeArea.y)" width="$($guides.safeArea.width)" height="$($guides.safeArea.height)" fill="none" stroke="rgba(133,209,255,0.92)" stroke-dasharray="6 4" stroke-width="1" />
      <rect x="$($guides.centerSafe.x)" y="$($guides.centerSafe.y)" width="$($guides.centerSafe.width)" height="$($guides.centerSafe.height)" fill="none" stroke="rgba(126,255,211,0.92)" stroke-dasharray="10 4" stroke-width="1" />
      <rect x="$($guides.ultrawideBleed.x)" y="$($guides.ultrawideBleed.y)" width="$($guides.ultrawideBleed.width)" height="$($guides.ultrawideBleed.height)" fill="none" stroke="rgba(255,168,112,0.82)" stroke-dasharray="12 6" stroke-width="1" />
      $labelSafeTop
      <rect x="$($guides.debugFloorBand.x)" y="$($guides.debugFloorBand.y)" width="$($guides.debugFloorBand.width)" height="$($guides.debugFloorBand.height)" fill="rgba(132,98,255,0.06)" stroke="rgba(132,98,255,0.34)" stroke-width="1" />
      <line x1="0" x2="$($Spec.canvas.width)" y1="$($guides.horizonY)" y2="$($guides.horizonY)" stroke="rgba(244,225,160,0.72)" stroke-dasharray="6 4" stroke-width="1" />
      <line x1="0" x2="$($Spec.canvas.width)" y1="$($guides.floorY)" y2="$($guides.floorY)" stroke="rgba(255,165,102,0.78)" stroke-dasharray="8 5" stroke-width="1.2" />
"@
}

function New-PreviewHtml {
  param(
    [string[]]$Sources,
    [string]$TargetPath,
    [int]$WorldWidth,
    [int]$WorldHeight,
    [string]$OverlayMarkup = '',
    [bool]$Transparent = $true
  )

  $background = if ($Transparent) { 'transparent' } else { '#000' }
  $imageMarkup = ($Sources | ForEach-Object {
    $uri = Convert-ToFileUri $_
    "<image href=""$uri"" x=""0"" y=""0"" width=""$WorldWidth"" height=""$WorldHeight"" preserveAspectRatio=""none"" />"
  }) -join [Environment]::NewLine

  $html = @"
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <title>World Preview</title>
    <style>
      html, body {
        margin: 0;
        width: 100%;
        height: 100%;
        overflow: hidden;
        background: $background;
      }

      body {
        position: relative;
      }

      #stage {
        width: 100%;
        height: 100%;
        image-rendering: pixelated;
        image-rendering: crisp-edges;
      }
    </style>
  </head>
  <body>
    <svg id="stage" viewBox="0 0 $WorldWidth $WorldHeight" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg">
      $imageMarkup
      $OverlayMarkup
    </svg>
  </body>
</html>
"@

  Set-Content -Path $TargetPath -Value $html -Encoding UTF8
}

function Export-Preview {
  param(
    [string]$BrowserPath,
    [string]$HtmlPath,
    [string]$PngPath
  )

  & $BrowserPath `
    '--headless=new' `
    '--disable-gpu' `
    '--hide-scrollbars' `
    '--force-device-scale-factor=1' `
    '--run-all-compositor-stages-before-draw' `
    '--virtual-time-budget=1000' `
    '--default-background-color=00000000' `
    "--window-size=$Width,$Height" `
    "--screenshot=$PngPath" `
    (Convert-ToFileUri $HtmlPath) | Out-Null
}

$repoRoot = Split-Path -Parent $PSScriptRoot
$browserPath = Resolve-BrowserPath
$worldSpec = Get-Content -Path $WorldSpecPath -Raw | ConvertFrom-Json
$worldWidth = [int]$worldSpec.canvas.width
$worldHeight = [int]$worldSpec.canvas.height
$layerKeys = @($worldSpec.layers | ForEach-Object { [string]$_.key })
$guideMarkup = if ($IncludeGuides) { New-GuideMarkup -Spec $worldSpec } else { '' }

New-Item -ItemType Directory -Path $OutputDir -Force | Out-Null

foreach ($layer in $layerKeys) {
  $svgPath = Join-Path $WorldDir "$layer.svg"
  if (-not (Test-Path $svgPath)) {
    throw "Missing world layer SVG: $svgPath"
  }

  $htmlPath = Join-Path $OutputDir "$layer.preview.html"
  $pngPath = Join-Path $OutputDir "$layer-preview-3x.png"
  New-PreviewHtml -Sources @($svgPath) -TargetPath $htmlPath -WorldWidth $worldWidth -WorldHeight $worldHeight -Transparent $true
  Export-Preview -BrowserPath $browserPath -HtmlPath $htmlPath -PngPath $pngPath
}

$compositeSources = $layerKeys | ForEach-Object { Join-Path $WorldDir "$_.svg" }
$compositeHtmlPath = Join-Path $OutputDir 'composite.preview.html'
$compositePngPath = Join-Path $OutputDir 'composite-preview-3x.png'
New-PreviewHtml -Sources $compositeSources -TargetPath $compositeHtmlPath -WorldWidth $worldWidth -WorldHeight $worldHeight -Transparent $false
Export-Preview -BrowserPath $browserPath -HtmlPath $compositeHtmlPath -PngPath $compositePngPath

if ($IncludeGuides) {
  $guidesHtmlPath = Join-Path $OutputDir 'guides.preview.html'
  $guidesPngPath = Join-Path $OutputDir 'guides-preview-3x.png'
  New-PreviewHtml -Sources @() -TargetPath $guidesHtmlPath -WorldWidth $worldWidth -WorldHeight $worldHeight -OverlayMarkup $guideMarkup -Transparent $false
  Export-Preview -BrowserPath $browserPath -HtmlPath $guidesHtmlPath -PngPath $guidesPngPath

  $compositeGuidesHtmlPath = Join-Path $OutputDir 'composite-guides.preview.html'
  $compositeGuidesPngPath = Join-Path $OutputDir 'composite-guides-preview-3x.png'
  New-PreviewHtml -Sources $compositeSources -TargetPath $compositeGuidesHtmlPath -WorldWidth $worldWidth -WorldHeight $worldHeight -OverlayMarkup $guideMarkup -Transparent $false
  Export-Preview -BrowserPath $browserPath -HtmlPath $compositeGuidesHtmlPath -PngPath $compositeGuidesPngPath
}

$templateSvgPath = Join-Path $WorldDir 'wander-template.svg'
if (Test-Path $templateSvgPath) {
  $templateHtmlPath = Join-Path $OutputDir 'wander-template.preview.html'
  $templatePngPath = Join-Path $OutputDir 'wander-template-3x.png'
  New-PreviewHtml -Sources @($templateSvgPath) -TargetPath $templateHtmlPath -WorldWidth $worldWidth -WorldHeight $worldHeight -Transparent $false
  Export-Preview -BrowserPath $browserPath -HtmlPath $templateHtmlPath -PngPath $templatePngPath
}

if ($CaptureHomepageBaselines) {
  Push-Location $repoRoot
  try {
    npm run test:visual:update
  } finally {
    Pop-Location
  }
}

Write-Output "Exported world previews to $OutputDir"
