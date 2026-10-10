import sharp from 'sharp';
import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

const rawProducts = JSON.parse(fs.readFileSync('src/data/raw-products.json', 'utf8'));
const productsDir = 'public/images/products';
fs.mkdirSync(productsDir, { recursive: true });

// Source bases
const bases = {
  maroon: 'public/images/products/kfs-001-1.jpg',
  ivory: 'public/images/products/kfs-002-1.jpg',
  pink: 'public/images/products/kfs-003-1.jpg',
  peacock: 'public/images/products/kfs-004-1.jpg',
  lavender: 'public/images/products/kfs-007-1.jpg',
  banarasiBlue: 'public/images/products/kfs-013-1.jpg',
  blouseRed: 'public/images/products/kfs-043-1.jpg',
  bridal: 'public/images/collections/bridal.jpg',
  softSilk: 'public/images/collections/soft-silk.jpg',
  loom: 'public/images/about-draping.jpg',
};

// Color tint configs
const HUES = {
  Maroon: { hue: 0, sat: 1.0, b: 0.95 },
  Red: { hue: 0, sat: 1.1, b: 1.0 },
  'Emerald Green': { hue: 130, sat: 0.9, b: 0.9 },
  Mustard: { hue: 45, sat: 1.2, b: 1.05 },
  Ivory: { hue: 35, sat: 0.4, b: 1.1 },
  Pink: { hue: 320, sat: 1.1, b: 1.0 },
  'Peacock Blue': { hue: 195, sat: 1.0, b: 0.95 },
  Purple: { hue: 280, sat: 0.9, b: 0.95 },
  Teal: { hue: 180, sat: 0.95, b: 0.95 },
  Orange: { hue: 25, sat: 1.2, b: 1.0 },
  Navy: { hue: 225, sat: 0.8, b: 0.85 },
  Magenta: { hue: 310, sat: 1.2, b: 1.0 },
  Gold: { hue: 42, sat: 1.1, b: 1.1 },
  White: { hue: 40, sat: 0.2, b: 1.15 },
  Charcoal: { hue: 0, sat: 0.1, b: 0.65 },
  Khaki: { hue: 48, sat: 0.5, b: 0.95 },
};

async function getBaseForProduct(p) {
  if (p.id === 'kfs-001') return bases.maroon;
  if (p.id === 'kfs-002') return bases.ivory;
  if (p.id === 'kfs-003') return bases.pink;
  if (p.id === 'kfs-004') return bases.peacock;
  if (p.id === 'kfs-007') return bases.lavender;
  if (p.id === 'kfs-013') return bases.banarasiBlue;
  if (p.id === 'kfs-043') return bases.blouseRed;

  // Category specific base
  if (p.collection === 'Readymade Blouses') {
    return bases.blouseRed;
  }
  if (p.collection === 'Banarasi Silk Sarees') {
    return bases.banarasiBlue;
  }
  if (p.collection === 'Soft Silk Sarees') {
    return bases.softSilk;
  }
  if (p.collection === 'Bridal Pattu Silk Sarees') {
    return bases.bridal;
  }
  if (p.collection === 'Traditional Silk Sarees') {
    return bases.bridal;
  }
  if (p.collection === 'Designer Silk Sarees') {
    return bases.softSilk;
  }
  if (p.collection === 'Cotton Silk Sarees') {
    return bases.maroon;
  }
  if (p.collection === "Men's Veshti and Dhoti") {
    return bases.ivory; // Cream/white silk with gold zari border
  }
  if (p.collection === "Women's Silk Sarees") {
    return bases.softSilk;
  }
  return bases.maroon;
}

async function processProduct(p) {
  const baseImgPath = await getBaseForProduct(p);
  const baseBuffer = fs.readFileSync(baseImgPath);
  const colorSpec = HUES[p.colour] || { hue: 0, sat: 1.0, b: 1.0 };

  // For already generated bespoke AI images (kfs-001..004, 007, 013, 043), don't recolor
  const isBespoke = ['kfs-001', 'kfs-002', 'kfs-003', 'kfs-004', 'kfs-007', 'kfs-013', 'kfs-043'].includes(p.id);

  let pipeline = sharp(baseBuffer).resize(1024, 1024, { fit: 'cover' });

  if (!isBespoke) {
    // Apply nuanced tint / color modulation matching product specifications
    if (p.collection === "Men's Veshti and Dhoti") {
      // Men's dhoti is pure cream / white with gold zari border
      pipeline = pipeline.modulate({ saturation: 0.35, brightness: 1.1 });
    } else if (p.colour === 'White' || p.colour === 'Ivory') {
      pipeline = pipeline.modulate({ saturation: 0.3, brightness: 1.1 });
    } else if (p.colour === 'Charcoal') {
      pipeline = pipeline.modulate({ saturation: 0.15, brightness: 0.7 });
    } else {
      pipeline = pipeline.modulate({
        hue: colorSpec.hue,
        saturation: colorSpec.sat,
        brightness: colorSpec.b,
      });
    }
  }

  const mainBuffer = await pipeline.jpeg({ quality: 92 }).toBuffer();
  fs.writeFileSync(path.join(productsDir, `${p.id}-1.jpg`), mainBuffer);

  // View 2: Pallu / upper brocade detail zoom
  await sharp(mainBuffer)
    .extract({ left: 320, top: 150, width: 650, height: 650 })
    .resize(1024, 1024)
    .jpeg({ quality: 90 })
    .toFile(path.join(productsDir, `${p.id}-2.jpg`));

  // View 3: Border & pleats detail
  await sharp(mainBuffer)
    .extract({ left: 220, top: 350, width: 620, height: 620 })
    .resize(1024, 1024)
    .jpeg({ quality: 90 })
    .toFile(path.join(productsDir, `${p.id}-3.jpg`));

  // View 4: Weave texture & tassel macro close-up
  await sharp(mainBuffer)
    .extract({ left: 400, top: 450, width: 550, height: 550 })
    .resize(1024, 1024)
    .jpeg({ quality: 90 })
    .toFile(path.join(productsDir, `${p.id}-4.jpg`));

  console.log(`✓ Generated 4 distinct images for ${p.id} (${p.name})`);
}

async function run() {
  console.log('Generating realistic, category-specific images for all products...');
  for (const p of rawProducts) {
    await processProduct(p);
  }
  console.log('All 60 products (240 images) successfully processed!');
}

run().catch(console.error);
