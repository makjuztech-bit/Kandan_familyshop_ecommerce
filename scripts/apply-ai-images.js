import fs from 'node:fs';
import path from 'node:path';

const artifactsDir = 'C:\\Users\\sabar\\.gemini\\antigravity-ide\\brain\\5dfa3d7a-78c8-4199-8b80-d4978dd0d316';
const publicImagesDir = path.join(process.cwd(), 'public', 'images', 'products');

const templates = {
  'Kanchipuram Silk Sarees': 'saree_kanchipuram_1791563183397.jpg',
  'Soft Silk': 'saree_soft_silk_1791563205691.jpg',
  'Bridal Collection': 'bridal_collection_1791563228627.jpg',
  'Shirts': 'elegant_shirt_1791563263155.jpg',
  'Pants': 'elegant_pants_1791563294908.jpg',
  'Tops': 'elegant_top_1791563318322.jpg',
};

// Ensure dir exists
if (!fs.existsSync(publicImagesDir)) {
  fs.mkdirSync(publicImagesDir, { recursive: true });
}

// Read raw products
const rawProducts = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'src', 'data', 'raw-products.json'), 'utf-8'));

console.log('Copying AI images to product folders...');
let count = 0;

rawProducts.forEach(p => {
  const templateImage = templates[p.collection] || templates['Soft Silk'];
  const srcPath = path.join(artifactsDir, templateImage);
  
  if (fs.existsSync(srcPath)) {
    // Copy 3 instances for the gallery
    for (let i = 1; i <= 3; i++) {
      const destPath = path.join(publicImagesDir, `${p.id}-${i}.jpg`);
      fs.copyFileSync(srcPath, destPath);
      count++;
    }
  } else {
    console.warn(`Template not found: ${srcPath}`);
  }
});

console.log(`Successfully generated ${count} high-quality AI image mappings!`);
