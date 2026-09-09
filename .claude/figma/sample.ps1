# Figma skrinshotidan piksel rangini olish.
# Foydalanish:
#   powershell -File .claude/figma/sample.ps1 -Points "436,20 460,42 1500,290"
# Koordinatalar 1920x1080 kadr bo'yicha (00-full.png).
param(
  [string]$Points = "",
  [string]$Image = ".claude/figma/feeder/00-full.png"
)
Add-Type -AssemblyName System.Drawing
$full = (Resolve-Path $Image).Path
$bmp = New-Object System.Drawing.Bitmap($full)
foreach ($p in ($Points -split '\s+')) {
  if (-not $p) { continue }
  $parts = $p -split ','
  $x = [int]$parts[0]; $y = [int]$parts[1]
  if ($x -lt 0 -or $y -lt 0 -or $x -ge $bmp.Width -or $y -ge $bmp.Height) {
    "{0,-12} kadrdan tashqarida" -f $p
    continue
  }
  $c = $bmp.GetPixel($x, $y)
  "{0,-12} #{1:X2}{2:X2}{3:X2}" -f $p, $c.R, $c.G, $c.B
}
$bmp.Dispose()
