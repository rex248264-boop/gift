# Re-master the UI assets so they actually look transparent over the scene video.
#
# History (2026-05-12):
#   • First pass: the dialogue / narration / choice "PNGs" handed in by the user
#     were actually JPEG bitstreams renamed .png (FF D8 FF E0 SOI). JPEG has no
#     alpha so we chroma-keyed the solid outer (black for bubbles, near-white
#     for choices) before frosting the cream interior.
#   • Second pass (current, evening): the user supplied real PNG-RGBA versions
#     of the three choice assets (choice-normal / selected / confirm). They
#     already carry alpha=0 in the transparent border, so the outer chroma-key
#     step is a no-op for them — we *must* preserve those alpha=0 pixels rather
#     than re-frost them. The dialogue / narration bubbles remain JPEG-as-PNG
#     and still need the full chroma-key + frost path.
#
# What this script does, per file:
#   1) Hard-key the *outer* color (black for JPEGs that sit on solid black,
#      off-white for JPEGs that sit on near-white). Pixels close to the key
#      become fully transparent; a soft band around the key fades to alpha.
#      Disabled (KeyR = $null) for files that already ship with alpha.
#   2) For the *interior* cream/ivory fill (low saturation + high lightness),
#      reduce alpha to a frosted-glass level so the scene video shows through.
#      Saturated pixels (gold decoration, ribbons, candle flames) and dark
#      pixels (shadows, edges) stay fully opaque. Already-transparent pixels
#      (a == 0) are left alone so we don't bleed cream back into the border.
#
# Outputs land back over public/assets/ui/. Originals stay backed up in
# public/assets/ui/_originals/ from the previous run.

Add-Type -AssemblyName System.Drawing

function Process-Image {
    param(
        [string]$InPath,
        [string]$OutPath,
        # Outer key color (the JPEG's solid surround). null = skip outer keying.
        [Nullable[int]]$KeyR,
        [Nullable[int]]$KeyG,
        [Nullable[int]]$KeyB,
        [int]$OuterTolerance,
        [int]$OuterSoft,
        # Frosted interior: target alpha (0-255) for low-sat / high-light pixels.
        [int]$FrostAlpha,
        [double]$FrostSatMax,
        [double]$FrostLightMin
    )

    $src = [System.Drawing.Bitmap]::new($InPath)
    $w = $src.Width
    $h = $src.Height
    $rect = [System.Drawing.Rectangle]::new(0, 0, $w, $h)

    $dst = [System.Drawing.Bitmap]::new($w, $h, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $g = [System.Drawing.Graphics]::FromImage($dst)
    $g.DrawImage($src, 0, 0, $w, $h)
    $g.Dispose()
    $src.Dispose()

    $bd = $dst.LockBits($rect,
        [System.Drawing.Imaging.ImageLockMode]::ReadWrite,
        [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $stride = $bd.Stride
    $byteCount = $stride * $h
    $bytes = New-Object byte[] $byteCount
    [System.Runtime.InteropServices.Marshal]::Copy($bd.Scan0, $bytes, 0, $byteCount)

    $hardR = $OuterTolerance
    $softR = $OuterTolerance + $OuterSoft
    $useOuter = $KeyR -ne $null

    for ($y = 0; $y -lt $h; $y++) {
        $rowStart = $y * $stride
        for ($x = 0; $x -lt $w; $x++) {
            $i = $rowStart + ($x * 4)
            $b = [int]$bytes[$i]
            $g0 = [int]$bytes[$i + 1]
            $r = [int]$bytes[$i + 2]

            # ---- Outer chroma key ----
            $outerHandled = $false
            if ($useOuter) {
                $dr = [Math]::Abs($r - $KeyR)
                $dg = [Math]::Abs($g0 - $KeyG)
                $db = [Math]::Abs($b - $KeyB)
                $maxD = [Math]::Max($dr, [Math]::Max($dg, $db))
                if ($maxD -le $hardR) {
                    $bytes[$i + 3] = 0
                    $outerHandled = $true
                } elseif ($maxD -le $softR -and $OuterSoft -gt 0) {
                    $t = ($maxD - $hardR) / [double]$OuterSoft
                    $a = [int]([Math]::Round($t * 255))
                    if ($a -gt 255) { $a = 255 }
                    if ($a -lt 0) { $a = 0 }
                    $bytes[$i + 3] = [byte]$a
                    $outerHandled = $true
                }
            }
            if ($outerHandled) { continue }

            # Already-transparent pixels (e.g. the border of a real PNG-RGBA)
            # must stay transparent — otherwise the frost step below would
            # re-paint the border with cream alpha=178.
            if ([int]$bytes[$i + 3] -eq 0) { continue }

            # ---- Interior frost (only acts on still-opaque pixels) ----
            # Compute HSL-ish: lightness as max/255, saturation as (max-min)/max.
            $maxC = [Math]::Max($r, [Math]::Max($g0, $b))
            $minC = [Math]::Min($r, [Math]::Min($g0, $b))
            if ($maxC -eq 0) { continue }   # pure black: keep opaque
            $sat = ($maxC - $minC) / [double]$maxC
            $light = $maxC / 255.0

            if ($sat -le $FrostSatMax -and $light -ge $FrostLightMin) {
                # Cream / ivory fill: dial alpha down to FrostAlpha.
                # Blend smoothly so the frost-to-decoration boundary doesn't pop.
                $satRatio = $sat / [double]$FrostSatMax    # 0..1
                $lightRatio = ($light - $FrostLightMin) / (1.0 - $FrostLightMin)
                if ($lightRatio -lt 0) { $lightRatio = 0 }
                if ($lightRatio -gt 1) { $lightRatio = 1 }
                # Stronger frosting where pixel is more "cream" (low sat, high light).
                $w0 = (1.0 - $satRatio) * $lightRatio
                $alphaF = [int]([Math]::Round(255 - (255 - $FrostAlpha) * $w0))
                if ($alphaF -gt 255) { $alphaF = 255 }
                if ($alphaF -lt 0) { $alphaF = 0 }
                $bytes[$i + 3] = [byte]$alphaF
            }
        }
    }

    [System.Runtime.InteropServices.Marshal]::Copy($bytes, 0, $bd.Scan0, $byteCount)
    $dst.UnlockBits($bd)
    $dst.Save($OutPath, [System.Drawing.Imaging.ImageFormat]::Png)
    $dst.Dispose()
}

$uiDir = Join-Path $PSScriptRoot "..\public\assets\ui"
$uiDir = [System.IO.Path]::GetFullPath($uiDir)
$backupDir = Join-Path $uiDir "_originals"
New-Item -ItemType Directory -Path $backupDir -Force | Out-Null

# Frost defaults: alpha=178 (~70% opaque) for the cream fill — keeps text
# legible while still letting the scene video bleed through. sat<=0.18 and
# lightness>=0.72 catches ivory / pearl / pale-sparkle pixels without eating
# the saturated gold ribbons or the dark vignette shadows.
$frostAlpha = 178
$frostSatMax = 0.18
$frostLightMin = 0.72

$jobs = @(
    # Bubble-style JPEGs that sit on near-black:
    @{ name = "dialogue-bubble.png";      keyR = 0;   keyG = 0;   keyB = 0;   tol = 24; soft = 8  }
    @{ name = "narration-background.png"; keyR = 0;   keyG = 0;   keyB = 0;   tol = 24; soft = 8  }
    # Choice assets — all now ship as real PNG-RGBA (2026-05-12 second drop).
    # Outer chroma-key is disabled; we only frost the cream interior.
    @{ name = "choice-normal.png";        keyR = $null; keyG = $null; keyB = $null; tol = 0; soft = 0 }
    @{ name = "choice-selected.png";      keyR = $null; keyG = $null; keyB = $null; tol = 0; soft = 0 }
    @{ name = "choice-confirm.png";       keyR = $null; keyG = $null; keyB = $null; tol = 0; soft = 0 }
)

foreach ($job in $jobs) {
    $live = Join-Path $uiDir $job.name
    $backup = Join-Path $backupDir $job.name
    if (-not (Test-Path -LiteralPath $backup)) {
        if (Test-Path -LiteralPath $live) {
            Copy-Item -LiteralPath $live -Destination $backup -Force
        } else {
            Write-Host "[skip] $($job.name) not found"
            continue
        }
    }
    Write-Host "Processing $($job.name) (outerKey=$($job.keyR),$($job.keyG),$($job.keyB) tol=$($job.tol) soft=$($job.soft) frostA=$frostAlpha sat<=$frostSatMax light>=$frostLightMin)..."
    Process-Image -InPath $backup -OutPath $live `
        -KeyR $job.keyR -KeyG $job.keyG -KeyB $job.keyB `
        -OuterTolerance $job.tol -OuterSoft $job.soft `
        -FrostAlpha $frostAlpha -FrostSatMax $frostSatMax -FrostLightMin $frostLightMin
    $size = (Get-Item -LiteralPath $live).Length
    Write-Host "  -> $size bytes"
}

Write-Host "Done. Originals (JPEG-renamed-to-.png + real PNGs) preserved at $backupDir"
