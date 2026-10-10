import fs from 'node:fs';
import path from 'node:path';

const outDir = path.resolve('public/images/products');

// Collect all valid images by category group
// Category ranges:
// 1..6: Kanchipuram
// 7..12: Soft Silk
// 13..18: Banarasi
// 19..24: Cotton
// 25..30: Designer
// 31..36: Bridal
// 37..42: Traditional
// 43..48: Blouse
// 49..54: Dhoti
// 55..60: Ethnic

function getValidImagesForRange(start, end) {
  const list = [];
  for (let i = start; i <= end; i++) {
    const id = 'kfs-' + String(i).padStart(3, '0');
    for (let j = 1; j <= 4; j++) {
      const f = path.join(outDir, `${id}-${j}.jpg`);
      if (fs.existsSync(f) && fs.statSync(f).size > 5000) {
        list.push(f);
      }
    }
  }
  return list;
}

const groups = [
  { start: 1, end: 6 },
  { start: 7, end: 12 },
  { start: 13, end: 18 },
  { start: 19, end: 24 },
  { start: 25, end: 30 },
  { start: 31, end: 36 },
  { start: 37, end: 42 },
  { start: 43, end: 48 },
  { start: 49, end: 54 },
  { start: 55, end: 60 },
];

for (const g of groups) {
  const pool = getValidImagesForRange(g.start, g.end);
  if (!pool.length) continue;
  
  for (let pNum = g.start; pNum <= g.end; pNum++) {
    const id = 'kfs-' + String(pNum).padStart(3, '0');
    for (let slot = 1; slot <= 4; slot++) {
      const f = path.join(outDir, `${id}-${slot}.jpg`);
      if (!fs.existsSync(f) || fs.statSync(f).size < 3000) {
        // Pick an image from the pool that isn't this exact file
        const source = pool[(pNum * 3 + slot) % pool.length];
        if (source && fs.existsSync(source)) {
          fs.copyFileSync(source, f);
        }
      }
    }
  }
}

console.log('Fill complete.');
