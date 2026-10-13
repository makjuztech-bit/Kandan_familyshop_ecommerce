import { getAllProducts } from '../server/products.js';
import { DatabaseSync } from 'node:sqlite';
import { resolve } from 'node:path';

const expected = [
  { name: 'SOFT SILK-P', price: 1200 },
  { name: 'DABI', price: 1500 },
  { name: 'SOFT SILKS-AP', price: 1600 },
  { name: 'FANCY BUTTA-P', price: 1600 },
  { name: 'IVORY EMBOSE-AP', price: 1200 },
  { name: 'RICH FEEL-STSM', price: 500 },
  { name: 'KUBERA PATTU-P', price: 1020 },
  { name: 'PLAIN PATTU-KV', price: 630 },
  { name: 'TARKI LESS-STSM', price: 450 },
  { name: 'JHALAR LESS-STSM', price: 400 },
  { name: 'SHIRT-KV', price: 500 },
  { name: '80 EMBOSE-AP', price: 600 },
  { name: 'SOFT SILKS-KV', price: 1500 },
  { name: 'MANDAKINI-STSM', price: 500 },
  { name: 'HEAVY RENIYAL-STSM', price: 460 },
  { name: 'CHIKU LESS-STSM', price: 395 },
  { name: 'BUTTA EMBOSS', price: 1500 },
  { name: 'SHRI MAN-STSM', price: 495 },
  { name: 'PLAIN PATTU P', price: 630 },
  { name: 'SEAROCK-STSM', price: 520 },
  { name: 'PICK & PICK ALL JAGUARD-AP', price: 2050 },
  { name: 'KUBERA PATTU-KV', price: 1020 },
  { name: 'KANCHI KARI-STSM', price: 625 },
  { name: 'BLR FANCY SAREE', price: 1400 },
  { name: 'MOSS MILANO-STSM', price: 650 },
  { name: 'ALL SELF (half)-AP', price: 800 },
  { name: 'KHUBLI-STSM', price: 225 }
];

const dbProducts = getAllProducts();
console.log('--- DATABASE PRODUCTS VERIFICATION ---');
console.log('Total products in database:', dbProducts.length);
if (dbProducts.length !== 27) {
  console.error('ERROR: Expected exactly 27 products, found', dbProducts.length);
  process.exit(1);
}

let mismatch = 0;
expected.forEach((exp, idx) => {
  const act = dbProducts[idx];
  if (!act) {
    console.error('Missing product at index', idx, exp.name);
    mismatch++;
    return;
  }
  const nameMatch = act.name === exp.name;
  const priceMatch = Number(act.price) === exp.price;
  if (!nameMatch || !priceMatch) {
    console.error(`MISMATCH at index ${idx + 1}: found "${act.name}" @ ₹${act.price}, expected "${exp.name}" @ ₹${exp.price}`);
    mismatch++;
  } else {
    console.log(`✓ [${idx + 1}] ${act.name} — ₹${act.price.toLocaleString('en-IN')}`);
  }
});

if (mismatch === 0) {
  console.log('\n>>> SUCCESS: ALL 27 PRODUCTS MATCH USER LIST EXACTLY! <<<');
} else {
  console.error(`\n>>> FAILURE: ${mismatch} mismatches found.`);
  process.exit(1);
}

// Verify that other SQLite tables (orders, reviews, loyalty, etc.) remain intact
const db = new DatabaseSync(resolve('server/data/reviews.sqlite'));
const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
console.log('\n--- PRESERVED DATABASE TABLES ---');
tables.forEach(t => {
  try {
    const count = db.prepare(`SELECT count(*) as c FROM "${t.name}"`).get();
    console.log(`Table: ${t.name} (Rows: ${count.c})`);
  } catch {
    console.log(`Table: ${t.name}`);
  }
});
