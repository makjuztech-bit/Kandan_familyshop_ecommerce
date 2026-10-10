import fs from 'node:fs';

const report = [];
let complete = 0;
for (let i = 1; i <= 60; i++) {
  const id = 'kfs-' + String(i).padStart(3, '0');
  const imgs = [];
  for (let j = 1; j <= 4; j++) {
    const f = `public/images/products/${id}-${j}.jpg`;
    if (fs.existsSync(f) && fs.statSync(f).size > 1000) {
      imgs.push(f);
    }
  }
  if (imgs.length >= 3) complete++;
  else report.push({ id, count: imgs.length, found: imgs });
}
console.log('Products with >=3 images:', complete, '/ 60');
if (report.length > 0) console.log('Products needing more images:', report);
