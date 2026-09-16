/**
 * Composes four category images from actual NEOLIFE product images.
 * Each image contains 3-5 real catalogue products belonging to that category.
 * Products are arranged with clean backgrounds, subtle shadows, and consistent lighting.
 */
const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const productsDir = path.join(__dirname, '../public/products');
const categoriesDir = path.join(__dirname, '../public/categories');

const BG_COLOR = 'rgb(248, 246, 240)'; // warm cream #F8F6F0

const CANVAS_WIDTH = 1200;
const CANVAS_HEIGHT = 800;
const PRODUCT_DISPLAY = 260; // product image size (without shadow)
const SHADOW_BLUR = 8;
const SHADOW_OFFSET_X = 0;
const SHADOW_OFFSET_Y = 4;
const SHADOW_OPACITY = 0.35;

const CATEGORY_COMPOSITIONS = {
  'nutritionals': {
    slugs: [
      'formula-iv-multivitamin-and-mineral-supplement-245',
      'tre-en-en-food-supplement-299',
      'omega-3-plus-302',
      'coq10-food-supplement-5627',
      'kal-mag-plus-d-mineral-food-supplement-266',
    ],
    layout: 'arc',
  },
  'weight-management': {
    slugs: [
      'neolifeshake-rich-chocolate-meal-replacement-protein-shake-5142',
      'neolifeshake-creamy-vanilla-meal-replacement-protein-shake-5139',
      'neolifebar-fruit-nuts-snack-bar-308',
      'neolifetea-herbal-tea-blend-296',
    ],
    layout: 'arc',
  },
  'personal-care': {
    slugs: [
      'mild-revitalizing-shampoo-182',
      'enriching-conditioner-185',
      'rejuvenating-rich-cream-all-skin-types-a-rich-nourishing-cream-7332',
      'ultra-moisturizing-cream-dry-to-normal-skin-6056',
      'aloe-vera-gel-194',
    ],
    layout: 'arc',
  },
  'home-care': {
    slugs: [
      'g1-laundry-detergent-176',
      'super-10-all-purpose-cleaning-agent-5-litre-164',
      'ldc-light-duty-cleaner-hand-soap-1-litre-167',
      'soft-fabric-softener-173',
    ],
    layout: 'grid',
  },
};

const CANVAS_WIDTH_LOCAL = CANVAS_WIDTH;
const CANVAS_HEIGHT_LOCAL = CANVAS_HEIGHT;

async function getProductImage(slug) {
  const filePath = path.join(productsDir, slug, 'product.webp');
  if (!fs.existsSync(filePath)) {
    throw new Error(`Product image not found: ${filePath}`);
  }
  return sharp(filePath)
    .resize(PRODUCT_DISPLAY, PRODUCT_DISPLAY, { fit: 'contain' })
    .ensureAlpha()
    .png()
    .toBuffer();
}

async function createShadow(productBuffer) {
  const { data, info } = await sharp(productBuffer).raw().toBuffer({ resolveWithObject: true });

  const shadowData = Buffer.alloc(data.length);
  for (let i = 0; i < data.length; i += 4) {
    shadowData[i] = 0;
    shadowData[i + 1] = 0;
    shadowData[i + 2] = 0;
    shadowData[i + 3] = Math.round(data[i + 3] * SHADOW_OPACITY);
  }

  const padded = PRODUCT_DISPLAY + SHADOW_BLUR * 2;
  const shadowCanvas = await sharp({
    create: {
      width: padded,
      height: padded,
      channels: 4,
      background: 'transparent',
    },
  })
    .composite([{
      input: shadowData,
      raw: { width: info.width, height: info.height, channels: 4 },
      top: SHADOW_BLUR,
      left: SHADOW_BLUR,
      blend: 'over',
    }])
    .blur(SHADOW_BLUR)
    .png()
    .toBuffer();

  return {
    buffer: shadowCanvas,
    width: padded,
    height: padded,
    offsetXPx: SHADOW_BLUR + SHADOW_OFFSET_X,
    offsetYPx: SHADOW_BLUR + SHADOW_OFFSET_Y,
  };
}

async function createShadowedProduct(slug) {
  const productBuffer = await getProductImage(slug);
  const shadow = await createShadow(productBuffer);

  const padded = PRODUCT_DISPLAY + SHADOW_BLUR * 2;
  const final = await sharp({
    create: {
      width: padded,
      height: padded,
      channels: 4,
      background: 'transparent',
    },
  })
    .composite([
      {
        input: shadow.buffer,
        top: 0,
        left: 0,
        blend: 'over',
      },
      {
        input: productBuffer,
        top: SHADOW_BLUR,
        left: SHADOW_BLUR,
        blend: 'over',
      },
    ])
    .png()
    .toBuffer();

  return { buffer: final, width: padded, height: padded };
}

function getArcLayout(count) {
  const placements = [];
  const centerX = CANVAS_WIDTH_LOCAL / 2;
  const centerY = CANVAS_HEIGHT_LOCAL / 2 + 20;
  const radiusX = 360;
  const radiusY = 220;

  if (count === 3) {
    placements.push({ x: centerX - radiusX * 0.6, y: centerY - radiusY * 0.4 });
    placements.push({ x: centerX + radiusX * 0.6, y: centerY - radiusY * 0.4 });
    placements.push({ x: centerX, y: centerY + radiusY * 0.6 });
  } else if (count === 4) {
    placements.push({ x: centerX - radiusX * 0.55, y: centerY - radiusY * 0.3 });
    placements.push({ x: centerX + radiusX * 0.55, y: centerY - radiusY * 0.3 });
    placements.push({ x: centerX - radiusX * 0.55, y: centerY + radiusY * 0.5 });
    placements.push({ x: centerX + radiusX * 0.55, y: centerY + radiusY * 0.5 });
  } else if (count === 5) {
    placements.push({ x: centerX - radiusX * 0.7, y: centerY - radiusY * 0.2 });
    placements.push({ x: centerX + radiusX * 0.7, y: centerY - radiusY * 0.2 });
    placements.push({ x: centerX - radiusX * 0.4, y: centerY + radiusY * 0.4 });
    placements.push({ x: centerX + radiusX * 0.4, y: centerY + radiusY * 0.4 });
    placements.push({ x: centerX, y: centerY + radiusY * 0.9 });
  }
  return placements;
}

function getGridLayout(count) {
  const placements = [];
  const rowY = CANVAS_HEIGHT_LOCAL / 2 - 15;

  if (count === 3) {
    const spacing = CANVAS_WIDTH_LOCAL / (count + 1);
    placements.push({ x: spacing, y: rowY });
    placements.push({ x: spacing * 2, y: rowY });
    placements.push({ x: spacing * 3, y: rowY });
  } else if (count === 4) {
    const spacing = CANVAS_WIDTH_LOCAL / (count + 1);
    placements.push({ x: spacing, y: rowY });
    placements.push({ x: spacing * 2, y: rowY });
    placements.push({ x: spacing * 3, y: rowY });
    placements.push({ x: spacing * 4, y: rowY });
  }
  return placements;
}

async function createCategoryImage(categorySlug, composition) {
  const { slugs, layout } = composition;
  const count = slugs.length;

  const productBuffers = [];
  for (const slug of slugs) {
    const product = await createShadowedProduct(slug);
    productBuffers.push(product);
  }

  let placements;
  if (layout === 'arc') {
    placements = getArcLayout(count);
  } else {
    placements = getGridLayout(count);
  }

  const composites = [];
  for (let i = 0; i < productBuffers.length; i++) {
    const prod = productBuffers[i];
    const placement = placements[i];
    const x = Math.round(placement.x - prod.width / 2);
    const y = Math.round(placement.y - prod.height / 2);
    composites.push({
      input: prod.buffer,
      top: Math.max(0, y),
      left: Math.max(0, x),
      blend: 'over',
    });
  }

  const outputPath = path.join(categoriesDir, `${categorySlug}.webp`);
  await sharp({
    create: {
      width: CANVAS_WIDTH_LOCAL,
      height: CANVAS_HEIGHT_LOCAL,
      channels: 4,
      background: BG_COLOR,
    },
  })
    .composite(composites)
    .webp({ quality: 90 })
    .toFile(outputPath);

  console.log(`Created ${categorySlug}.webp (${CANVAS_WIDTH_LOCAL}x${CANVAS_HEIGHT_LOCAL}) with ${count} products:`, slugs.join(', '));
  return outputPath;
}

async function main() {
  if (!fs.existsSync(categoriesDir)) {
    fs.mkdirSync(categoriesDir, { recursive: true });
  }

  for (const [categorySlug, composition] of Object.entries(CATEGORY_COMPOSITIONS)) {
    await createCategoryImage(categorySlug, composition);
  }

  console.log('\nAll category images created successfully.');
}

main().catch(console.error);
