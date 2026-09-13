# PowerShell script to download official NEOLIFE product images
# Downloads original images using curl.exe, then they are batch-converted to WebP

$imageMap = @{
    "acidophilus-plus-food-supplement-236" = "https://neolifeshop.com/thumb/3288/350x0/560.png"
    "all-c-vitamin-c-supplement-chewable-tablets-230" = "https://neolifeshop.com/thumb/606/350x0/552.jpg"
    "aloe-vera-plus-aloe-vera-drink-269" = "https://neolifeshop.com/thumb/608/350x0/731.jpg"
    "betaguard-food-supplement-278" = "https://neolifeshop.com/thumb/609/350x0/789.jpg"
    "bio-tone-amino-acid-food-supplement-5692" = "https://neolifeshop.com/thumb/1521/350x0/935.jpg"
    "botanical-balance-food-supplement-6702" = "https://neolifeshop.com/thumb/1684/350x0/800.jpg"
    "carotenoid-complex-carotenoid-food-supplement-242" = "https://neolifeshop.com/thumb/610/350x0/566.jpg"
    "chelated-zinc-zinc-food-supplement-7737" = "https://neolifeshop.com/thumb/2095/350x0/830.jpg"
    "coq10-food-supplement-5627" = "https://neolifeshop.com/thumb/1463/350x0/930.jpg"
    "cruciferous-plus-food-supplement-284" = "https://neolifeshop.com/thumb/611/350x0/892.jpg"
    "elevate-9549" = "https://neolifeshop.com/thumb/3279/350x0/860.png"
    "fibre-tablets-8997" = "https://neolifeshop.com/thumb/3100/350x0/850.jpg"
    "flavonoid-complex-flavonoid-food-supplement-281" = "https://neolifeshop.com/thumb/612/350x0/790.jpg"
    "formula-iv-plus-multivitamin-and-mineral-food-supplement-263" = "https://neolifeshop.com/thumb/3356/350x0/691-ee-lt-uk-ie.jpg"
    "formula-iv-multivitamin-and-mineral-supplement-245" = "https://neolifeshop.com/thumb/613/350x0/576.jpg"
    "garlic-allium-complex-garlic-onion-food-supplement-233" = "https://neolifeshop.com/thumb/627/350x0/555.jpg"
    "kal-mag-plus-d-mineral-food-supplement-266" = "https://neolifeshop.com/thumb/615/350x0/724.jpg"
    "magnesium-complex-food-supplement-7117" = "https://neolifeshop.com/thumb/1828/350x0/805.jpg"
    "neolifebar-fruit-nuts-snack-bar-308" = "https://neolifeshop.com/thumb/616/350x0/950.jpg"
    "neolifeshake-berries-n-cream-meal-replacement-protein-shake-5145" = "https://neolifeshop.com/thumb/1277/350x0/917.jpg"
    "neolifeshake-creamy-vanilla-meal-replacement-protein-shake-5139" = "https://neolifeshop.com/thumb/1275/350x0/915.jpg"
    "neolifeshake-rich-chocolate-meal-replacement-protein-shake-5142" = "https://neolifeshop.com/thumb/1276/350x0/916.jpg"
    "neolifetea-herbal-tea-blend-296" = "https://neolifeshop.com/thumb/3335/350x0/920-lt-ee-uk-ie.jpg"
    "omega-3-plus-302" = "https://neolifeshop.com/thumb/3243/350x0/929_baltic.jpg"
    "pro-vitality-food-supplement-305" = "https://neolifeshop.com/thumb/3099/350x0/942_new.png"
    "resp-x-8055" = "https://neolifeshop.com/thumb/2381/350x0/820.jpg"
    "sustained-release-vitamin-c-vitamin-c-supplement-227" = "https://neolifeshop.com/thumb/630/350x0/551.jpg"
    "tre-food-supplement-liquid-nutritional-essence-272" = "https://neolifeshop.com/thumb/631/350x0/735.jpg"
    "tre-en-en-food-supplement-299" = "https://neolifeshop.com/thumb/632/350x0/927.jpg"
    "upbeet-8709" = "https://neolifeshop.com/thumb/2850/350x0/840.jpg"
    "vegan-d-vitamin-d-food-supplement-7549" = "https://neolifeshop.com/thumb/2023/350x0/865.jpg"
    "vita-squares-childrens-food-supplement-chewable-tablets-275" = "https://neolifeshop.com/thumb/605/350x0/740.jpg"
    "wheat-germ-oil-with-vitamin-e-vitamin-e-food-supplement-239" = "https://neolifeshop.com/thumb/633/350x0/562.jpg"
    "neolife-shaker-1756" = "https://neolifeshop.com/thumb/659/350x0/608.jpg"
    "vitamin-box-large-7299" = "https://neolifeshop.com/thumb/1886/350x0/5001.jpg"
    "aloe-vera-gel-194" = "https://neolifeshop.com/thumb/642/350x0/316.jpg"
    "balancing-tonic-all-skin-types-6041" = "https://neolifeshop.com/thumb/1567/350x0/360.jpg"
    "cleansing-gel-combination-to-oily-skin-6047" = "https://neolifeshop.com/thumb/1569/350x0/362.jpg"
    "cleansing-milk-dry-to-normal-skin-6044" = "https://neolifeshop.com/thumb/1568/350x0/361.jpg"
    "enriching-conditioner-185" = "https://neolifeshop.com/thumb/637/350x0/312.jpg"
    "hydrating-serum-combination-to-oily-skin-6059" = "https://neolifeshop.com/thumb/1573/350x0/366.jpg"
    "insta-lift-eye-gel-all-skin-types-6992" = "https://neolifeshop.com/thumb/1749/350x0/368.jpg"
    "mild-revitalizing-shampoo-182" = "https://neolifeshop.com/thumb/635/350x0/311.jpg"
    "moisturizing-cream-combination-to-oily-skin-6053" = "https://neolifeshop.com/thumb/1571/350x0/364.jpg"
    "moisturizing-hand-body-lotion-191" = "https://neolifeshop.com/thumb/636/350x0/315.jpg"
    "nutriance-organic-set-combination-to-oily-skin-6522" = "https://neolifeshop.com/thumb/1649/350x0/3690.jpg"
    "nutriance-organic-set-normal-to-dry-skin" = "https://neolifeshop.com/thumb/1648/350x0/3670.jpg"
    "refreshing-bath-shower-gel-188" = "https://neolifeshop.com/thumb/638/350x0/314.jpg"
    "rejuvenating-rich-cream-all-skin-types-a-rich-nourishing-cream-7332" = "https://neolifeshop.com/thumb/1885/350x0/369.jpg"
    "rich-revitalizing-shampoo-179" = "https://neolifeshop.com/thumb/634/350x0/310.jpg"
    "ultra-hydrating-serum-dry-to-normal-skin-6062" = "https://neolifeshop.com/thumb/1574/350x0/367.jpg"
    "ultra-moisturizing-cream-dry-to-normal-skin-6056" = "https://neolifeshop.com/thumb/1572/350x0/365.jpg"
    "g1-laundry-detergent-176" = "https://neolifeshop.com/thumb/599/350x0/144.jpg"
    "ldc-light-duty-cleaner-5-liter-170" = "https://neolifeshop.com/thumb/601/350x0/25.jpg"
    "ldc-light-duty-cleaner-hand-soap-1-litre-167" = "https://neolifeshop.com/thumb/604/350x0/21.jpg"
    "soft-fabric-softener-173" = "https://neolifeshop.com/thumb/603/350x0/42.jpg"
    "super-10-all-purpose-cleaning-agent-1-litre-161" = "https://neolifeshop.com/thumb/602/350x0/16.jpg"
    "super-10-all-purpose-cleaning-agent-10-litre-1890" = "https://neolifeshop.com/thumb/798/350x0/18.jpg"
    "super-10-all-purpose-cleaning-agent-25-litre" = "https://neolifeshop.com/thumb/799/350x0/19.jpg"
    "super-10-all-purpose-cleaning-agent-5-litre-164" = "https://neolifeshop.com/thumb/600/350x0/17.jpg"
    "dispenser-ldc-5-liter-1761" = "https://neolifeshop.com/thumb/650/350x0/1586.jpg"
    "dispenser-super-10-10-liter-4566" = "https://neolifeshop.com/thumb/653/350x0/1585.jpg"
    "dispenser-super-10-5-liter-1760" = "https://neolifeshop.com/thumb/654/350x0/1584.jpg"
    "mixing-bottle-500-ml-1753" = "https://neolifeshop.com/thumb/657/350x0/308.jpg"
    "spray-bottle-500-ml-1750" = "https://neolifeshop.com/thumb/656/350x0/303.jpg"
}

$publicDir = "E:\AI-Development\GHub\projects\Neolife\public\products"
$total = $imageMap.Count
$i = 0
$success = 0
$failed = 0

foreach ($slug in $imageMap.Keys) {
    $i++
    $url = $imageMap[$slug]
    $outDir = Join-Path $publicDir $slug
    $tempFile = Join-Path $outDir "temp"
    
    if (-not (Test-Path $outDir)) {
        New-Item -ItemType Directory -Path $outDir -Force | Out-Null
    }
    
    $webpFile = Join-Path $outDir "product.webp"
    if (Test-Path $webpFile) {
        Write-Host "  [$i/$total] SKIP  $slug (exists)"
        $success++
        continue
    }
    
    Write-Host "  [$i/$total] DOWNLOAD  $slug"
    curl.exe -sfL --connect-timeout 10 --max-time 30 "$url" -o $tempFile 2>$null
    if ($LASTEXITCODE -eq 0 -and (Test-Path $tempFile) -and (Get-Item $tempFile).Length -gt 0) {
        Write-Host "  [$i/$total] OK    $slug"
        $success++
    } else {
        Write-Host "  [$i/$total] FAIL  $slug"
        $failed++
        Remove-Item $tempFile -ErrorAction SilentlyContinue
    }
}

Write-Host ""
Write-Host "Results: $success succeeded, $failed failed (of $total)"
