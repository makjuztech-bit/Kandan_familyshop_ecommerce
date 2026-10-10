import fs from 'fs';
import path from 'path';

const replaceMap = [
  { regex: /silk sarees/gi, replacement: 'ethnic wear' },
  { regex: /silk saree/gi, replacement: 'textile product' },
  { regex: /sarees/gi, replacement: 'ethnic wear' },
  { regex: /saree/gi, replacement: 'textile product' }
];

function processFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  let newContent = content;
  
  for (const { regex, replacement } of replaceMap) {
    newContent = newContent.replace(regex, (match) => {
      // Preserve casing as best as possible
      if (match === match.toUpperCase()) return replacement.toUpperCase();
      if (match[0] === match[0].toUpperCase()) {
        return replacement.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
      }
      return replacement;
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
  'src/data/raw-products.json',
  'scripts/generate-products-data.js',
  'supabase_schema.sql'
];

filesToUpdate.forEach(file => {
  const fullPath = path.resolve(process.cwd(), file);
  if (fs.existsSync(fullPath)) {
    processFile(fullPath);
  } else {
    console.warn(`File not found: ${fullPath}`);
  }
});
