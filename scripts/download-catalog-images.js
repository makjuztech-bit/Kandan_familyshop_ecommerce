import https from 'node:https';
import fs from 'node:fs';
import path from 'node:path';

const outDir = path.resolve('public/images/products');
const colDir = path.resolve('public/images/collections');
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
if (!fs.existsSync(colDir)) fs.mkdirSync(colDir, { recursive: true });

function searchWiki(query, limit = 25) {
  return new Promise((resolve) => {
    const url = 'https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrnamespace=6&gsrlimit=' + limit + '&gsrsearch=' + encodeURIComponent(query) + '&prop=imageinfo&iiprop=url|size|mime&iiurlwidth=800&format=json';
    https.get(url, { headers: { 'User-Agent': 'KandanSilkShop/1.0 (info@kandan.com)' } }, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => {
        try {
          const j = JSON.parse(d);
          const pages = Object.values(j.query?.pages || {});
          const results = pages.map(p => ({
            title: p.title,
            url: p.imageinfo?.[0]?.thumburl || p.imageinfo?.[0]?.url,
            mime: p.imageinfo?.[0]?.mime
          })).filter(x => x.url && !x.url.includes('.svg') && !x.url.includes('.tif'));
          resolve(results);
        } catch(e) {
          resolve([]);
        }
      });
    }).on('error', () => resolve([]));
  });
}

function downloadImage(targetUrl, destPath) {
  return new Promise((resolve) => {
    if (fs.existsSync(destPath) && fs.statSync(destPath).size > 10000) {
      return resolve(true);
    }
    const req = (currUrl, depth = 0) => {
      if (depth > 5) return resolve(false);
      try {
        const u = new URL(currUrl);
        const reqObj = https.get({
          protocol: u.protocol,
          hostname: u.hostname,
          path: u.pathname + u.search,
          headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) KandanShop/1.0' }
        }, res => {
          if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
            let next = res.headers.location;
            if (!next.startsWith('http')) next = new URL(next, currUrl).toString();
            return req(next, depth + 1);
          }
          if (res.statusCode !== 200) return resolve(false);
          const f = fs.createWriteStream(destPath);
          res.pipe(f);
          f.on('finish', () => {
            f.close();
            const sz = fs.existsSync(destPath) ? fs.statSync(destPath).size : 0;
            resolve(sz > 4000);
          });
          f.on('error', () => resolve(false));
        });
        reqObj.setTimeout(8000, () => {
          reqObj.destroy();
          resolve(false);
        });
        reqObj.on('error', () => resolve(false));
      } catch (err) {
        resolve(false);
      }
    };
    req(targetUrl);
  });
}

async function run() {
  console.log('Fetching image lists from Wikimedia...');
  const pool = {
    borders: await searchWiki('sari border', 30),
    pallus: await searchWiki('sari pallu', 30),
    zardozi: await searchWiki('zardozi embroidery', 30),
    kanchipuram: await searchWiki('kanchipuram sari', 30),
    banarasi: await searchWiki('banarasi sari', 30),
    softSilk: await searchWiki('silk sari textile', 30),
    cotton: await searchWiki('cotton sari handloom', 30),
    designer: await searchWiki('chaniya choli lehenga', 30),
    bridal: await searchWiki('indian bride wedding sari', 30),
    traditional: await searchWiki('handloom sari weaver', 30),
    blouse: await searchWiki('choli blouse embroidery', 30),
    dhoti: await searchWiki('dhoti veshti', 30),
    ethnic: await searchWiki('anarkali suit kurta', 30),
  };

  console.log('Pool counts:');
  for (const [k, v] of Object.entries(pool)) {
    console.log(`  ${k}: ${v.length}`);
  }

  // Collection covers
  const colMappings = [
    { file: 'kanchipuram.jpg', item: pool.kanchipuram[0] || pool.bridal[0] },
    { file: 'soft-silk.jpg', item: pool.softSilk[0] },
    { file: 'banarasi.jpg', item: pool.banarasi[0] },
    { file: 'cotton.jpg', item: pool.cotton[0] || pool.traditional[0] },
    { file: 'designer.jpg', item: pool.designer[0] },
    { file: 'bridal.jpg', item: pool.bridal[0] },
    { file: 'traditional.jpg', item: pool.traditional[0] },
    { file: 'blouse.jpg', item: pool.blouse[0] || pool.zardozi[0] },
    { file: 'dhoti.jpg', item: pool.dhoti[0] },
    { file: 'ethnic.jpg', item: pool.ethnic[0] || pool.designer[1] }
  ];

  for (const col of colMappings) {
    if (col.item?.url) {
      const dest = path.join(colDir, col.file);
      await downloadImage(col.item.url, dest);
    }
  }
  console.log('Collection covers updated.');

  const catPools = [
    { poolName: 'kanchipuram', start: 1, end: 6 },
    { poolName: 'softSilk', start: 7, end: 12 },
    { poolName: 'banarasi', start: 13, end: 18 },
    { poolName: 'cotton', start: 19, end: 24 },
    { poolName: 'designer', start: 25, end: 30 },
    { poolName: 'bridal', start: 31, end: 36 },
    { poolName: 'traditional', start: 37, end: 42 },
    { poolName: 'blouse', start: 43, end: 48 },
    { poolName: 'dhoti', start: 49, end: 54 },
    { poolName: 'ethnic', start: 55, end: 60 },
  ];

  let downloadedCount = 0;
  for (const group of catPools) {
    let list = pool[group.poolName] || [];
    if (!list.length) list = pool.traditional;
    
    for (let pNum = group.start; pNum <= group.end; pNum++) {
      const pId = 'kfs-' + String(pNum).padStart(3, '0');
      const pIdx = pNum - group.start;

      const item1 = list[pIdx % list.length] || pool.kanchipuram[pIdx % pool.kanchipuram.length];
      const item2 = list[(pIdx + 1) % list.length] || pool.bridal[pIdx % pool.bridal.length];
      const item3 = pool.borders[pIdx % pool.borders.length] || pool.zardozi[pIdx % pool.zardozi.length];
      const item4 = pool.pallus[pIdx % pool.pallus.length] || pool.zardozi[(pIdx + 1) % pool.zardozi.length];

      const candidates = [item1, item2, item3, item4];

      for (let imgIdx = 1; imgIdx <= 4; imgIdx++) {
        const filePath = path.join(outDir, `${pId}-${imgIdx}.jpg`);
        if (fs.existsSync(filePath) && fs.statSync(filePath).size > 10000) {
          continue;
        }
        const candidate = candidates[imgIdx - 1];
        if (candidate?.url) {
          const ok = await downloadImage(candidate.url, filePath);
          if (ok) downloadedCount++;
        }
      }
    }
  }

  console.log(`Success! Total downloaded: ${downloadedCount}`);
  console.log(`Total files in ${outDir}:`, fs.readdirSync(outDir).length);
}

run();
