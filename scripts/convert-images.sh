#!/bin/sh
apk add --no-cache imagemagick file libwebp-tools >/dev/null 2>&1
cd /products
for dir in */; do
    slug=$(basename "$dir")
    temp="${dir}temp"
    webp="${dir}product.webp"
    if [ -f "$temp" ]; then
        ftype=$(file -b --mime-type "$temp")
        case "$ftype" in
            image/png)  ext="png" ;;
            image/jpeg) ext="jpg" ;;
            *)          ext="jpg" ;;
        esac
        convert "$temp" -quality 85 "$webp" 2>/dev/null && echo "  OK   $slug ($ftype)" || echo "  FAIL $slug ($ftype)"
    else
        echo "  SKIP $slug (no temp)"
    fi
done
