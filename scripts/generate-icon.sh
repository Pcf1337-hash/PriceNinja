#!/bin/bash
# Generate PriceNinja app icons using ImageMagick

ASSETS_DIR="$(dirname "$0")/../assets"

# Create the SVG icon definition inline and convert to PNG
# Design: dark bg + neon shuriken with price tag

magick -size 1024x1024 \
  \( \
    # Dark background with rounded square
    -size 1024x1024 xc:"#090919" \
    -fill "#0d0d24" \
    -draw "roundrectangle 0,0 1023,1023 160,160" \
  \) \
  \( \
    # Outer glow ring
    -size 1024x1024 xc:none \
    -fill none \
    -stroke "#00ff88" \
    -strokewidth 6 \
    -draw "circle 512,512 512,200" \
    -blur 0x12 \
  \) \
  -composite \
  \( \
    # Shuriken body — 4 rotated blades
    -size 1024x1024 xc:none \
    -fill "#00ff88" \
    -draw "polygon 512,200 460,460 200,512 460,564 512,824 564,564 824,512 564,460" \
  \) \
  -composite \
  \( \
    # Center circle
    -size 1024x1024 xc:none \
    -fill "#090919" \
    -draw "circle 512,512 512,420" \
  \) \
  -composite \
  \( \
    # Inner yen/price symbol — stylized €
    -size 1024x1024 xc:none \
    -fill "#00ff88" \
    -font "DejaVu-Sans-Bold" \
    -pointsize 280 \
    -gravity center \
    -annotate 0 "€" \
  \) \
  -composite \
  -flatten \
  "${ASSETS_DIR}/icon.png"

echo "icon.png generated"

# Adaptive icon foreground (same but without bg, centered with padding)
magick -size 1024x1024 xc:none \
  \( \
    -size 1024x1024 xc:none \
    -fill "#00ff88" \
    -draw "polygon 512,180 452,452 180,512 452,572 512,844 572,572 844,512 572,452" \
  \) \
  -composite \
  \( \
    -size 1024x1024 xc:none \
    -fill "#090919" \
    -draw "circle 512,512 512,412" \
  \) \
  -composite \
  \( \
    -size 1024x1024 xc:none \
    -fill "#00ff88" \
    -font "DejaVu-Sans-Bold" \
    -pointsize 280 \
    -gravity center \
    -annotate 0 "€" \
  \) \
  -composite \
  "${ASSETS_DIR}/adaptive-icon.png"

echo "adaptive-icon.png generated"
