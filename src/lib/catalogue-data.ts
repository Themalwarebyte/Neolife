/**
 * NEOLIFE product catalogue data.
 *
 * Source: official NeoLife shop (https://neolifeshop.com/i/shop.html), Northern
 * Europe market, researched 2026-09-13.
 *
 * - Official product/category/subcategory names and SKU numbers are factual
 *   data and are reproduced exactly as they appear on the official site.
 * - Descriptions are concise ORIGINAL summaries based on official product
 *   information. They are NOT copied verbatim from official marketing copy.
 * - No Kenyan (KSh) prices are included. The Owner will supply the authoritative
 *   Kenyan product list and KSh price list later.
 * - Official product imagery is embedded from self-hosted WebP assets under
 *   public/products/<slug>/product.webp, sourced from the official NeoLife shop.
 */

export type CatalogueCategory = {
  name: string;
  slug: string;
  description: string;
  displayOrder: number;
};

export type CatalogueSubcategory = {
  name: string;
  slug: string;
  categorySlug: string;
  description: string;
  displayOrder: number;
};

export type CatalogueProduct = {
  name: string;
  slug: string;
  sku: string;
  description: string;
  categorySlugs: string[];
  subcategorySlugs: string[];
  displayOrder: number;
  image: string;
};

export const CATALOGUE_CATEGORIES: CatalogueCategory[] = [
  {
    name: "Nutritionals",
    slug: "nutritionals",
    description:
      "Whole-food-based nutritional supplements built on over 60 years of product experience. Designed to supply nutrients that may be missing from the daily diet and to support everyday wellness for the whole family.",
    displayOrder: 1,
  },
  {
    name: "Weight Management",
    slug: "weight-management",
    description:
      "Products aimed at supporting everyday wellbeing and simplifying weight control. Includes meal replacement protein shakes, nutritious snack bars, and a herbal tea blend to support a calorie-controlled programme.",
    displayOrder: 2,
  },
  {
    name: "Personal Care",
    slug: "personal-care",
    description:
      "Nutriance Organics, a scientifically formulated marine-botanical-based organic skincare line, complemented by nourishing hair and body care products. Designed for biocompatibility, pH balance, and active skin cell renewal.",
    displayOrder: 3,
  },
  {
    name: "Home Care",
    slug: "home-care",
    description:
      "Golden Home Care products with a minimum environmental burden: biodegradable, with no toxic fumes and no harsh chemicals. Concentrated, low-dose cleaning technology that is economical and effective.",
    displayOrder: 4,
  },
];

export const CATALOGUE_SUBCATEGORIES: CatalogueSubcategory[] = [
  // Nutritionals
  { name: "Nutritional Products", slug: "nutritional-products", categorySlug: "nutritionals", description: "The full NeoLife Nutritionals range, bringing together core nutrition and targeted solutions in one place.", displayOrder: 1 },
  { name: "Core Products", slug: "core-products", categorySlug: "nutritionals", description: "Essential products to create a foundation for vitality. Based on cellular nutrition, they feed your cells with key nutrients and are the recommended starting point for any NeoLife programme.", displayOrder: 2 },
  { name: "Targeted Solutions", slug: "targeted-solutions", categorySlug: "nutritionals", description: "Nutritional products that target specific wellness needs, building on a foundation of core nutrition.", displayOrder: 3 },
  { name: "Active Lifestyle and Wellness", slug: "active-lifestyle-and-wellness", categorySlug: "nutritionals", description: "A broad spectrum of nutrients to support an active lifestyle.", displayOrder: 1 },
  { name: "Oxidative Stress", slug: "oxidative-stress", categorySlug: "nutritionals", description: "Nutritional support targeting oxidative stress.", displayOrder: 2 },
  { name: "Nutrients to Support Your Heart", slug: "nutrients-to-support-your-heart", categorySlug: "nutritionals", description: "Nutritional products formulated to support heart health.", displayOrder: 3 },
  { name: "Women's Solutions", slug: "womens-solutions", categorySlug: "nutritionals", description: "Nutritional solutions tailored for women's health needs.", displayOrder: 4 },
  { name: "Children's Nutrition", slug: "childrens-nutrition", categorySlug: "nutritionals", description: "Nutritional products formulated for children.", displayOrder: 5 },
  { name: "For Your Bones", slug: "for-your-bones", categorySlug: "nutritionals", description: "Nutritional products formulated to support bone health.", displayOrder: 6 },
  { name: "Aging", slug: "aging", categorySlug: "nutritionals", description: "Nutritional support for healthy aging.", displayOrder: 7 },
  { name: "Herbal Alternatives", slug: "herbal-alternatives", categorySlug: "nutritionals", description: "Herbal-based nutritional alternatives.", displayOrder: 8 },
  { name: "NeoLife Accessories", slug: "neolife-accessories", categorySlug: "nutritionals", description: "Accessories to support your NeoLife nutritional programme.", displayOrder: 4 },
  // Weight Management
  { name: "Complementary Product", slug: "complementary-product", categorySlug: "weight-management", description: "Complementary products to support a weight management programme.", displayOrder: 1 },
  { name: "Protein", slug: "protein", categorySlug: "weight-management", description: "Protein-based meal replacement products.", displayOrder: 2 },
  { name: "Snacks", slug: "snacks", categorySlug: "weight-management", description: "Nutritious between-meal snack products.", displayOrder: 3 },
  // Personal Care
  { name: "Personal Care Products", slug: "personal-care-products", categorySlug: "personal-care", description: "The full Nutriance Organics personal care range.", displayOrder: 1 },
  { name: "Organic Skin Care", slug: "organic-skin-care", categorySlug: "personal-care", description: "Certified organic marine-botanical skincare formulated for specific skin types.", displayOrder: 2 },
  { name: "Organic Certified", slug: "organic-certified", categorySlug: "personal-care", description: "Certified organic Nutriance skincare products.", displayOrder: 1 },
  { name: "Normal to Dry Skin", slug: "normal-to-dry-skin", categorySlug: "personal-care", description: "Nutriance organic skincare formulated for normal to dry skin.", displayOrder: 2 },
  { name: "Combination to Oily Skin", slug: "combination-to-oily-skin", categorySlug: "personal-care", description: "Nutriance organic skincare formulated for combination to oily skin.", displayOrder: 3 },
  { name: "Hair Care", slug: "hair-care", categorySlug: "personal-care", description: "Nourishing shampoo and conditioner products.", displayOrder: 3 },
  { name: "Body Care", slug: "body-care", categorySlug: "personal-care", description: "Nourishing body care products.", displayOrder: 4 },
  { name: "Nutriance Accessories", slug: "nutriance-accessories", categorySlug: "personal-care", description: "Accessories to support the Nutriance skincare programme.", displayOrder: 5 },
  // Home Care
  { name: "Home Care Products", slug: "home-care-products", categorySlug: "home-care", description: "The full Golden Home Care range.", displayOrder: 1 },
  { name: "Golden Accessories", slug: "golden-accessories", categorySlug: "home-care", description: "Accessories to support the Golden Home Care programme.", displayOrder: 2 },
];

export const CATALOGUE_PRODUCTS: CatalogueProduct[] = [
  // ---- Nutritionals ----
  { name: "Acidophilus Plus", slug: "acidophilus-plus-food-supplement-236", sku: "560", description: "A food supplement based on lactic acid bacteria to support digestive comfort.", categorySlugs: ["nutritionals"], subcategorySlugs: ["nutritional-products"], displayOrder: 1, image: "/products/acidophilus-plus-food-supplement-236/product.webp" },
  { name: "All C", slug: "all-c-vitamin-c-supplement-chewable-tablets-230", sku: "552", description: "A chewable vitamin C supplement providing a convenient daily dose of this essential nutrient.", categorySlugs: ["nutritionals"], subcategorySlugs: ["nutritional-products", "targeted-solutions"], displayOrder: 2, image: "/products/all-c-vitamin-c-supplement-chewable-tablets-230/product.webp" },
  { name: "Aloe Vera Plus", slug: "aloe-vera-plus-aloe-vera-drink-269", sku: "731", description: "An aloe vera drink providing a convenient liquid nutritional supplement.", categorySlugs: ["nutritionals"], subcategorySlugs: ["nutritional-products", "targeted-solutions"], displayOrder: 3, image: "/products/aloe-vera-plus-aloe-vera-drink-269/product.webp" },
  { name: "Betaguard", slug: "betaguard-food-supplement-278", sku: "789", description: "A food supplement formulated to support the body's natural defences.", categorySlugs: ["nutritionals"], subcategorySlugs: ["nutritional-products", "targeted-solutions"], displayOrder: 4, image: "/products/betaguard-food-supplement-278/product.webp" },
  { name: "Bio-Tone", slug: "bio-tone-amino-acid-food-supplement-5692", sku: "935", description: "An amino acid food supplement providing building blocks for protein metabolism.", categorySlugs: ["nutritionals"], subcategorySlugs: ["nutritional-products"], displayOrder: 5, image: "/products/bio-tone-amino-acid-food-supplement-5692/product.webp" },
  { name: "Botanical Balance", slug: "botanical-balance-food-supplement-6702", sku: "800", description: "A food supplement combining botanical extracts to support overall balance.", categorySlugs: ["nutritionals"], subcategorySlugs: ["nutritional-products"], displayOrder: 6, image: "/products/botanical-balance-food-supplement-6702/product.webp" },
  { name: "Carotenoid Complex", slug: "carotenoid-complex-carotenoid-food-supplement-242", sku: "566", description: "A carotenoid food supplement providing naturally sourced plant pigments with antioxidant properties.", categorySlugs: ["nutritionals"], subcategorySlugs: ["nutritional-products", "targeted-solutions", "oxidative-stress"], displayOrder: 7, image: "/products/carotenoid-complex-carotenoid-food-supplement-242/product.webp" },
  { name: "Chelated Zinc", slug: "chelated-zinc-zinc-food-supplement-7737", sku: "830", description: "A zinc food supplement using chelated minerals for improved absorption.", categorySlugs: ["nutritionals"], subcategorySlugs: ["nutritional-products", "targeted-solutions"], displayOrder: 8, image: "/products/chelated-zinc-zinc-food-supplement-7737/product.webp" },
  { name: "CoQ10", slug: "coq10-food-supplement-5627", sku: "930", description: "A food supplement providing coenzyme Q10, a nutrient involved in cellular energy production.", categorySlugs: ["nutritionals"], subcategorySlugs: ["nutritional-products", "targeted-solutions", "active-lifestyle-and-wellness"], displayOrder: 9, image: "/products/coq10-food-supplement-5627/product.webp" },
  { name: "Cruciferous Plus", slug: "cruciferous-plus-food-supplement-284", sku: "892", description: "A food supplement based on cruciferous vegetables to support the body's natural detoxification processes.", categorySlugs: ["nutritionals"], subcategorySlugs: ["nutritional-products", "targeted-solutions"], displayOrder: 10, image: "/products/cruciferous-plus-food-supplement-284/product.webp" },
  { name: "Elevate", slug: "elevate-9549", sku: "860", description: "A nutritional supplement designed to support energy metabolism and an active lifestyle.", categorySlugs: ["nutritionals"], subcategorySlugs: ["nutritional-products", "targeted-solutions", "active-lifestyle-and-wellness"], displayOrder: 11, image: "/products/elevate-9549/product.webp" },
  { name: "Fibre Tablets", slug: "fibre-tablets-8997", sku: "850", description: "A fibre supplement in tablet form to support digestive health.", categorySlugs: ["nutritionals"], subcategorySlugs: ["nutritional-products"], displayOrder: 12, image: "/products/fibre-tablets-8997/product.webp" },
  { name: "Flavonoid Complex", slug: "flavonoid-complex-flavonoid-food-supplement-281", sku: "790", description: "A flavonoid food supplement providing plant-derived compounds with antioxidant properties.", categorySlugs: ["nutritionals"], subcategorySlugs: ["nutritional-products", "targeted-solutions"], displayOrder: 13, image: "/products/flavonoid-complex-flavonoid-food-supplement-281/product.webp" },
  { name: "Formula IV Plus", slug: "formula-iv-plus-multivitamin-and-mineral-food-supplement-263", sku: "691", description: "A multivitamin and mineral food supplement providing a broad spectrum of essential nutrients.", categorySlugs: ["nutritionals"], subcategorySlugs: ["nutritional-products", "targeted-solutions", "active-lifestyle-and-wellness"], displayOrder: 14, image: "/products/formula-iv-plus-multivitamin-and-mineral-food-supplement-263/product.webp" },
  { name: "Formula IV", slug: "formula-iv-multivitamin-and-mineral-supplement-245", sku: "576", description: "A multivitamin and mineral supplement providing a comprehensive daily nutrient intake.", categorySlugs: ["nutritionals"], subcategorySlugs: ["nutritional-products", "targeted-solutions", "active-lifestyle-and-wellness"], displayOrder: 15, image: "/products/formula-iv-multivitamin-and-mineral-supplement-245/product.webp" },
  { name: "Garlic Allium Complex", slug: "garlic-allium-complex-garlic-onion-food-supplement-233", sku: "555", description: "A food supplement based on garlic and onion to support overall wellness.", categorySlugs: ["nutritionals"], subcategorySlugs: ["nutritional-products", "targeted-solutions"], displayOrder: 16, image: "/products/garlic-allium-complex-garlic-onion-food-supplement-233/product.webp" },
  { name: "Kal-Mag Plus D", slug: "kal-mag-plus-d-mineral-food-supplement-266", sku: "724", description: "A mineral food supplement combining calcium, magnesium, and vitamin D to support bone health.", categorySlugs: ["nutritionals"], subcategorySlugs: ["nutritional-products", "targeted-solutions", "for-your-bones"], displayOrder: 17, image: "/products/kal-mag-plus-d-mineral-food-supplement-266/product.webp" },
  { name: "Magnesium Complex", slug: "magnesium-complex-food-supplement-7117", sku: "805", description: "A magnesium food supplement to support muscle and nerve function.", categorySlugs: ["nutritionals"], subcategorySlugs: ["nutritional-products", "targeted-solutions", "active-lifestyle-and-wellness"], displayOrder: 18, image: "/products/magnesium-complex-food-supplement-7117/product.webp" },
  { name: "NeoLifeBar", slug: "neolifebar-fruit-nuts-snack-bar-308", sku: "950", description: "A fruit and nut snack bar providing a nutritious between-meal option.", categorySlugs: ["nutritionals", "weight-management"], subcategorySlugs: ["nutritional-products", "snacks"], displayOrder: 20, image: "/products/neolifebar-fruit-nuts-snack-bar-308/product.webp" },
  { name: "NeoLifeShake Berries n' Cream", slug: "neolifeshake-berries-n-cream-meal-replacement-protein-shake-5145", sku: "917", description: "A meal replacement protein shake in a berries and cream flavour, designed to support a calorie-controlled programme.", categorySlugs: ["nutritionals", "weight-management"], subcategorySlugs: ["nutritional-products", "protein"], displayOrder: 21, image: "/products/neolifeshake-berries-n-cream-meal-replacement-protein-shake-5145/product.webp" },
  { name: "NeoLifeShake Creamy Vanilla", slug: "neolifeshake-creamy-vanilla-meal-replacement-protein-shake-5139", sku: "915", description: "A meal replacement protein shake in a creamy vanilla flavour, designed to support a calorie-controlled programme.", categorySlugs: ["nutritionals", "weight-management"], subcategorySlugs: ["nutritional-products", "protein"], displayOrder: 22, image: "/products/neolifeshake-creamy-vanilla-meal-replacement-protein-shake-5139/product.webp" },
  { name: "NeoLifeShake Rich Chocolate", slug: "neolifeshake-rich-chocolate-meal-replacement-protein-shake-5142", sku: "916", description: "A meal replacement protein shake in a rich chocolate flavour, designed to support a calorie-controlled programme.", categorySlugs: ["nutritionals", "weight-management"], subcategorySlugs: ["nutritional-products", "protein"], displayOrder: 23, image: "/products/neolifeshake-rich-chocolate-meal-replacement-protein-shake-5142/product.webp" },
  { name: "NeoLifeTea", slug: "neolifetea-herbal-tea-blend-296", sku: "920", description: "A herbal tea blend to support a calorie-controlled programme and daily wellbeing.", categorySlugs: ["nutritionals", "weight-management"], subcategorySlugs: ["nutritional-products", "complementary-product"], displayOrder: 24, image: "/products/neolifetea-herbal-tea-blend-296/product.webp" },
  { name: "Omega-3 Plus", slug: "omega-3-plus-302", sku: "929", description: "A food supplement providing omega-3 fatty acids to support heart health.", categorySlugs: ["nutritionals"], subcategorySlugs: ["nutritional-products", "targeted-solutions", "nutrients-to-support-your-heart"], displayOrder: 25, image: "/products/omega-3-plus-302/product.webp" },
  { name: "Pro Vitality", slug: "pro-vitality-food-supplement-305", sku: "942", description: "A whole-food nutritional supplement designed to form the foundation of a daily wellness programme.", categorySlugs: ["nutritionals"], subcategorySlugs: ["nutritional-products", "core-products"], displayOrder: 26, image: "/products/pro-vitality-food-supplement-305/product.webp" },
  { name: "Resp-X", slug: "resp-x-8055", sku: "820", description: "A food supplement formulated to support respiratory wellness.", categorySlugs: ["nutritionals"], subcategorySlugs: ["nutritional-products", "targeted-solutions"], displayOrder: 27, image: "/products/resp-x-8055/product.webp" },
  { name: "Sustained Release Vitamin C", slug: "sustained-release-vitamin-c-vitamin-c-supplement-227", sku: "551", description: "A vitamin C supplement designed for sustained release to provide prolonged nutrient support.", categorySlugs: ["nutritionals"], subcategorySlugs: ["nutritional-products", "targeted-solutions"], displayOrder: 28, image: "/products/sustained-release-vitamin-c-vitamin-c-supplement-227/product.webp" },
  { name: "Tre", slug: "tre-food-supplement-liquid-nutritional-essence-272", sku: "735", description: "A liquid nutritional essence providing a concentrated source of nutrients derived from whole-food ingredients.", categorySlugs: ["nutritionals"], subcategorySlugs: ["nutritional-products", "core-products"], displayOrder: 29, image: "/products/tre-food-supplement-liquid-nutritional-essence-272/product.webp" },
  { name: "Tre-en-en", slug: "tre-en-en-food-supplement-299", sku: "927", description: "A food supplement providing a broad spectrum of nutrients to support daily vitality.", categorySlugs: ["nutritionals"], subcategorySlugs: ["nutritional-products", "targeted-solutions", "active-lifestyle-and-wellness"], displayOrder: 30, image: "/products/tre-en-en-food-supplement-299/product.webp" },
  { name: "UpBeet", slug: "upbeet-8709", sku: "840", description: "A food supplement based on beetroot to support energy and circulation.", categorySlugs: ["nutritionals"], subcategorySlugs: ["nutritional-products", "targeted-solutions", "active-lifestyle-and-wellness"], displayOrder: 31, image: "/products/upbeet-8709/product.webp" },
  { name: "Vegan D", slug: "vegan-d-vitamin-d-food-supplement-7549", sku: "865", description: "A plant-based vitamin D food supplement to support immune and bone health.", categorySlugs: ["nutritionals"], subcategorySlugs: ["nutritional-products", "targeted-solutions"], displayOrder: 32, image: "/products/vegan-d-vitamin-d-food-supplement-7549/product.webp" },
  { name: "Vita-Squares", slug: "vita-squares-childrens-food-supplement-chewable-tablets-275", sku: "740", description: "A chewable children's food supplement providing essential nutrients in a child-friendly format.", categorySlugs: ["nutritionals"], subcategorySlugs: ["nutritional-products", "targeted-solutions", "childrens-nutrition"], displayOrder: 33, image: "/products/vita-squares-childrens-food-supplement-chewable-tablets-275/product.webp" },
  { name: "Vitamin Box, Large", slug: "vitamin-box-large-7299", sku: "5001", description: "A large storage box for vitamin and supplement products.", categorySlugs: ["nutritionals"], subcategorySlugs: ["neolife-accessories"], displayOrder: 34, image: "/products/vitamin-box-large-7299/product.webp" },
  { name: "Wheat Germ Oil with Vitamin E", slug: "wheat-germ-oil-with-vitamin-e-vitamin-e-food-supplement-239", sku: "562", description: "A food supplement combining wheat germ oil with vitamin E to support overall wellness.", categorySlugs: ["nutritionals"], subcategorySlugs: ["nutritional-products", "targeted-solutions"], displayOrder: 35, image: "/products/wheat-germ-oil-with-vitamin-e-vitamin-e-food-supplement-239/product.webp" },
  { name: "NeoLife Shaker", slug: "neolife-shaker-1756", sku: "608", description: "A branded shaker accessory for preparing protein shakes and nutritional drinks.", categorySlugs: ["nutritionals", "weight-management"], subcategorySlugs: ["neolife-accessories"], displayOrder: 36, image: "/products/neolife-shaker-1756/product.webp" },
  // ---- Personal Care ----
  { name: "Aloe Vera Gel", slug: "aloe-vera-gel-194", sku: "316", description: "A soothing aloe vera gel for topical application.", categorySlugs: ["personal-care"], subcategorySlugs: ["personal-care-products"], displayOrder: 1, image: "/products/aloe-vera-gel-194/product.webp" },
  { name: "Balancing Tonic (All Skin Types)", slug: "balancing-tonic-all-skin-types-6041", sku: "360", description: "A balancing facial tonic suitable for all skin types.", categorySlugs: ["personal-care"], subcategorySlugs: ["personal-care-products", "organic-skin-care", "organic-certified"], displayOrder: 2, image: "/products/balancing-tonic-all-skin-types-6041/product.webp" },
  { name: "Cleansing Gel (Combination to Oily Skin)", slug: "cleansing-gel-combination-to-oily-skin-6047", sku: "362", description: "A cleansing gel formulated for combination to oily skin.", categorySlugs: ["personal-care"], subcategorySlugs: ["personal-care-products", "organic-skin-care", "combination-to-oily-skin"], displayOrder: 3, image: "/products/cleansing-gel-combination-to-oily-skin-6047/product.webp" },
  { name: "Cleansing Milk (Dry to Normal Skin)", slug: "cleansing-milk-dry-to-normal-skin-6044", sku: "361", description: "A gentle cleansing milk formulated for dry to normal skin.", categorySlugs: ["personal-care"], subcategorySlugs: ["personal-care-products", "organic-skin-care", "normal-to-dry-skin"], displayOrder: 4, image: "/products/cleansing-milk-dry-to-normal-skin-6044/product.webp" },
  { name: "Enriching Conditioner", slug: "enriching-conditioner-185", sku: "312", description: "A nourishing hair conditioner to support soft, manageable hair.", categorySlugs: ["personal-care"], subcategorySlugs: ["personal-care-products", "hair-care"], displayOrder: 5, image: "/products/enriching-conditioner-185/product.webp" },
  { name: "Hydrating Serum (Combination to Oily Skin)", slug: "hydrating-serum-combination-to-oily-skin-6059", sku: "366", description: "A hydrating facial serum formulated for combination to oily skin.", categorySlugs: ["personal-care"], subcategorySlugs: ["personal-care-products", "organic-skin-care", "combination-to-oily-skin"], displayOrder: 6, image: "/products/hydrating-serum-combination-to-oily-skin-6059/product.webp" },
  { name: "Insta-Lift Eye Gel (All Skin Types)", slug: "insta-lift-eye-gel-all-skin-types-6992", sku: "368", description: "A refreshing eye gel suitable for all skin types.", categorySlugs: ["personal-care"], subcategorySlugs: ["personal-care-products", "organic-skin-care", "organic-certified"], displayOrder: 7, image: "/products/insta-lift-eye-gel-all-skin-types-6992/product.webp" },
  { name: "Mild Revitalizing Shampoo", slug: "mild-revitalizing-shampoo-182", sku: "311", description: "A mild shampoo formulated to gently cleanse and revitalize hair.", categorySlugs: ["personal-care"], subcategorySlugs: ["personal-care-products", "hair-care"], displayOrder: 8, image: "/products/mild-revitalizing-shampoo-182/product.webp" },
  { name: "Moisturizing Cream (Combination to Oily Skin)", slug: "moisturizing-cream-combination-to-oily-skin-6053", sku: "364", description: "A moisturizing cream formulated for combination to oily skin.", categorySlugs: ["personal-care"], subcategorySlugs: ["personal-care-products", "organic-skin-care", "combination-to-oily-skin"], displayOrder: 9, image: "/products/moisturizing-cream-combination-to-oily-skin-6053/product.webp" },
  { name: "Moisturizing Hand & Body Lotion", slug: "moisturizing-hand-body-lotion-191", sku: "315", description: "A moisturizing lotion for hands and body.", categorySlugs: ["personal-care"], subcategorySlugs: ["personal-care-products", "body-care"], displayOrder: 10, image: "/products/moisturizing-hand-body-lotion-191/product.webp" },
  { name: "Nutriance Organic Set, Combination to Oily Skin", slug: "nutriance-organic-set-combination-to-oily-skin-6522", sku: "3690", description: "A coordinated organic skincare set formulated for combination to oily skin.", categorySlugs: ["personal-care"], subcategorySlugs: ["personal-care-products", "organic-skin-care", "combination-to-oily-skin"], displayOrder: 11, image: "/products/nutriance-organic-set-combination-to-oily-skin-6522/product.webp" },
  { name: "Nutriance Organic Set, Normal to Dry Skin", slug: "nutriance-organic-set-normal-to-dry-skin", sku: "3670", description: "A coordinated organic skincare set formulated for normal to dry skin.", categorySlugs: ["personal-care"], subcategorySlugs: ["personal-care-products", "organic-skin-care", "normal-to-dry-skin"], displayOrder: 12, image: "/products/nutriance-organic-set-normal-to-dry-skin/product.webp" },
  { name: "Refreshing Bath & Shower Gel", slug: "refreshing-bath-shower-gel-188", sku: "314", description: "A refreshing gel for use in the bath or shower.", categorySlugs: ["personal-care"], subcategorySlugs: ["personal-care-products", "body-care"], displayOrder: 13, image: "/products/refreshing-bath-shower-gel-188/product.webp" },
  { name: "Rejuvenating Rich Cream (All Skin Types)", slug: "rejuvenating-rich-cream-all-skin-types-a-rich-nourishing-cream-7332", sku: "369", description: "A rich, nourishing cream suitable for all skin types.", categorySlugs: ["personal-care"], subcategorySlugs: ["personal-care-products", "organic-skin-care", "organic-certified"], displayOrder: 14, image: "/products/rejuvenating-rich-cream-all-skin-types-a-rich-nourishing-cream-7332/product.webp" },
  { name: "Rich Revitalizing Shampoo", slug: "rich-revitalizing-shampoo-179", sku: "310", description: "A rich shampoo formulated to cleanse and revitalize hair.", categorySlugs: ["personal-care"], subcategorySlugs: ["personal-care-products", "hair-care"], displayOrder: 15, image: "/products/rich-revitalizing-shampoo-179/product.webp" },
  { name: "Ultra Hydrating Serum (Dry to Normal Skin)", slug: "ultra-hydrating-serum-dry-to-normal-skin-6062", sku: "367", description: "An ultra-hydrating facial serum formulated for dry to normal skin.", categorySlugs: ["personal-care"], subcategorySlugs: ["personal-care-products", "organic-skin-care", "normal-to-dry-skin"], displayOrder: 16, image: "/products/ultra-hydrating-serum-dry-to-normal-skin-6062/product.webp" },
  { name: "Ultra Moisturizing Cream (Dry to Normal Skin)", slug: "ultra-moisturizing-cream-dry-to-normal-skin-6056", sku: "365", description: "An ultra-moisturizing cream formulated for dry to normal skin.", categorySlugs: ["personal-care"], subcategorySlugs: ["personal-care-products", "organic-skin-care", "normal-to-dry-skin"], displayOrder: 17, image: "/products/ultra-moisturizing-cream-dry-to-normal-skin-6056/product.webp" },
  // ---- Home Care ----
  { name: "Dispenser LDC, 5 liter", slug: "dispenser-ldc-5-liter-1761", sku: "1586", description: "A 5 litre dispenser for the LDC (Light Duty Cleaner) range.", categorySlugs: ["home-care"], subcategorySlugs: ["home-care-products"], displayOrder: 1, image: "/products/dispenser-ldc-5-liter-1761/product.webp" },
  { name: "Dispenser Super 10, 10 liter", slug: "dispenser-super-10-10-liter-4566", sku: "1585", description: "A 10 litre dispenser for the Super 10 all-purpose cleaning range.", categorySlugs: ["home-care"], subcategorySlugs: ["home-care-products"], displayOrder: 2, image: "/products/dispenser-super-10-10-liter-4566/product.webp" },
  { name: "Dispenser Super 10, 5 liter", slug: "dispenser-super-10-5-liter-1760", sku: "1584", description: "A 5 litre dispenser for the Super 10 all-purpose cleaning range.", categorySlugs: ["home-care"], subcategorySlugs: ["home-care-products"], displayOrder: 3, image: "/products/dispenser-super-10-5-liter-1760/product.webp" },
  { name: "G1, Laundry Detergent", slug: "g1-laundry-detergent-176", sku: "144", description: "A concentrated laundry detergent for effective cleaning.", categorySlugs: ["home-care"], subcategorySlugs: ["home-care-products"], displayOrder: 4, image: "/products/g1-laundry-detergent-176/product.webp" },
  { name: "LDC Light Duty Cleaner, 5 liter", slug: "ldc-light-duty-cleaner-5-liter-170", sku: "25", description: "A 5 litre light duty cleaner for everyday surfaces.", categorySlugs: ["home-care"], subcategorySlugs: ["home-care-products"], displayOrder: 5, image: "/products/ldc-light-duty-cleaner-5-liter-170/product.webp" },
  { name: "LDC Light Duty Cleaner, Hand Soap, 1 litre", slug: "ldc-light-duty-cleaner-hand-soap-1-litre-167", sku: "21", description: "A 1 litre light duty cleaner formulated as a hand soap.", categorySlugs: ["home-care"], subcategorySlugs: ["home-care-products"], displayOrder: 6, image: "/products/ldc-light-duty-cleaner-hand-soap-1-litre-167/product.webp" },
  { name: "Mixing Bottle 500 ml", slug: "mixing-bottle-500-ml-1753", sku: "308", description: "A 500 ml mixing bottle for preparing cleaning solutions.", categorySlugs: ["home-care"], subcategorySlugs: ["golden-accessories"], displayOrder: 7, image: "/products/mixing-bottle-500-ml-1753/product.webp" },
  { name: "Soft, Fabric Softener", slug: "soft-fabric-softener-173", sku: "42", description: "A fabric softener to leave laundry feeling soft and fresh.", categorySlugs: ["home-care"], subcategorySlugs: ["home-care-products"], displayOrder: 8, image: "/products/soft-fabric-softener-173/product.webp" },
  { name: "Spray Bottle 500 ml", slug: "spray-bottle-500-ml-1750", sku: "303", description: "A 500 ml spray bottle for applying cleaning solutions.", categorySlugs: ["home-care"], subcategorySlugs: ["golden-accessories"], displayOrder: 9, image: "/products/spray-bottle-500-ml-1750/product.webp" },
  { name: "Super 10, All Purpose Cleaning Agent, 1 litre", slug: "super-10-all-purpose-cleaning-agent-1-litre-161", sku: "16", description: "A concentrated all-purpose cleaning agent in a 1 litre size.", categorySlugs: ["home-care"], subcategorySlugs: ["home-care-products"], displayOrder: 10, image: "/products/super-10-all-purpose-cleaning-agent-1-litre-161/product.webp" },
  { name: "Super 10, All Purpose Cleaning Agent, 10 litre", slug: "super-10-all-purpose-cleaning-agent-10-litre-1890", sku: "18", description: "A concentrated all-purpose cleaning agent in a 10 litre size.", categorySlugs: ["home-care"], subcategorySlugs: ["home-care-products"], displayOrder: 11, image: "/products/super-10-all-purpose-cleaning-agent-10-litre-1890/product.webp" },
  { name: "Super 10, All Purpose Cleaning Agent, 25 litre", slug: "super-10-all-purpose-cleaning-agent-25-litre", sku: "19", description: "A concentrated all-purpose cleaning agent in a 25 litre size.", categorySlugs: ["home-care"], subcategorySlugs: ["home-care-products"], displayOrder: 12, image: "/products/super-10-all-purpose-cleaning-agent-25-litre/product.webp" },
  { name: "Super 10, All Purpose Cleaning Agent, 5 litre", slug: "super-10-all-purpose-cleaning-agent-5-litre-164", sku: "17", description: "A concentrated all-purpose cleaning agent in a 5 litre size.", categorySlugs: ["home-care"], subcategorySlugs: ["home-care-products"], displayOrder: 13, image: "/products/super-10-all-purpose-cleaning-agent-5-litre-164/product.webp" },
];

/** Total unique products in the catalogue data. */
export const CATALOGUE_PRODUCT_COUNT = CATALOGUE_PRODUCTS.length;

/** Total unique SKUs in the catalogue data. */
export const CATALOGUE_SKU_COUNT = new Set(CATALOGUE_PRODUCTS.map((p) => p.sku)).size;

/** Total unique product slugs in the catalogue data. */
export const CATALOGUE_SLUG_COUNT = new Set(CATALOGUE_PRODUCTS.map((p) => p.slug)).size;

export function getCategoryBySlug(slug: string): CatalogueCategory | undefined {
  return CATALOGUE_CATEGORIES.find((c) => c.slug === slug);
}

export function getSubcategoryBySlug(slug: string): CatalogueSubcategory | undefined {
  return CATALOGUE_SUBCATEGORIES.find((s) => s.slug === slug);
}

export function getProductBySlug(slug: string): CatalogueProduct | undefined {
  return CATALOGUE_PRODUCTS.find((p) => p.slug === slug);
}

export function getProductBySku(sku: string): CatalogueProduct | undefined {
  return CATALOGUE_PRODUCTS.find((p) => p.sku === sku);
}

export function getSubcategoriesForCategory(categorySlug: string): CatalogueSubcategory[] {
  return CATALOGUE_SUBCATEGORIES.filter((s) => s.categorySlug === categorySlug);
}

export function getProductsForSubcategory(subcategorySlug: string): CatalogueProduct[] {
  return CATALOGUE_PRODUCTS.filter((p) => p.subcategorySlugs.includes(subcategorySlug));
}

export function getProductsForCategory(categorySlug: string): CatalogueProduct[] {
  return CATALOGUE_PRODUCTS.filter((p) => p.categorySlugs.includes(categorySlug));
}

export function searchCatalogue(query: string): CatalogueProduct[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  return CATALOGUE_PRODUCTS.filter(
    (p) =>
      p.name.toLowerCase().includes(q) ||
      p.sku.toLowerCase().includes(q) ||
      p.description.toLowerCase().includes(q),
  );
}
