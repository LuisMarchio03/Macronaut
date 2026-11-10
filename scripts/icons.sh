#!/bin/sh
# Gera os PNGs e o favicon.ico a partir dos SVGs (precisa de rsvg-convert e magick).
set -e
cd "$(dirname "$0")/../public"
rsvg-convert -w 192 -h 192 favicon.svg -o icon-192.png
rsvg-convert -w 512 -h 512 favicon.svg -o icon-512.png
rsvg-convert -w 180 -h 180 favicon.svg -o apple-touch-icon.png
rsvg-convert -w 32 -h 32 favicon.svg -o favicon-32.png
rsvg-convert -w 16 -h 16 favicon.svg -o favicon-16.png
f48=$(mktemp --suffix=.png)
rsvg-convert -w 48 -h 48 favicon.svg -o "$f48"
magick favicon-16.png favicon-32.png "$f48" favicon.ico
rm -f "$f48"
# Maskable: fundo sem cantos e símbolo dentro da zona segura central.
rsvg-convert -w 512 -h 512 maskable.svg -o maskable-512.png
