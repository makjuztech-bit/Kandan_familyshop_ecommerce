import fs from 'fs';
import path from 'path';

const replaceMap = [
  { regex: /\bsilk\b/gi, replacement: 'Textile' },
  { regex: /\bsilks\b/gi, replacement: 'Textiles' }
];

function processFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  let newContent = content;
  
  for (const { regex, replacement } of replaceMap) {
    newContent = newContent.replace(regex, (match) => {
      if (match === match.toUpperCase()) return replacement.toUpperCase();
      if (match[0] === match[0].toUpperCase()) return replacement;
      return replacement.toLowerCase();
    });
  }
  
  if (content !== newContent) {
    fs.writeFileSync(filePath, newContent, 'utf8');
    console.log(`Updated ${filePath}`);
  }
}

const filesToUpdate = [
  'src/pages/Info.jsx',
  'src/pages/Home.jsx',
  'src/pages/Product.jsx',
  'src/pages/Auth.jsx',
  'src/data/raw-products.json',
  'scripts/generate-products-data.js',
  'supabase_schema.sql',
  'src/config/shop.js'
];

filesToUpdate.forEach(file => {
  const fullPath = path.resolve(process.cwd(), file);
  if (fs.existsSync(fullPath)) {
    processFile(fullPath);
  }
});
