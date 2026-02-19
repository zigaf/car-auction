const https = require('https');
const fs = require('fs');
const path = require('path');

const TOKEN = 'pk_Vi55Q2apTvK73ITtWI81zA';
const SIZE = 64;
const OUTPUT_DIR = path.join(__dirname, '../public/brand-icons');

const brandDomains = {
  'audi': 'audi.com',
  'bmw': 'bmw.com',
  'mercedes-benz': 'mercedes-benz.com',
  'mercedes-amg': 'mercedes-amg.com',
  'volkswagen': 'volkswagen.com',
  'vw': 'volkswagen.com',
  'volvo': 'volvo.com',
  'toyota': 'toyota.com',
  'ford': 'ford.com',
  'nissan': 'nissan-global.com',
  'hyundai': 'hyundai.com',
  'kia': 'kia.com',
  'peugeot': 'peugeot.com',
  'renault': 'renault.com',
  'citroen': 'citroen.com',
  'opel': 'opel.com',
  'skoda': 'skoda-auto.com',
  'seat': 'seat.com',
  'cupra': 'cupraofficial.com',
  'dacia': 'dacia.com',
  'mini': 'mini.com',
  'smart': 'smart.com',
  'mitsubishi': 'mitsubishimotors.com',
  'mazda': 'mazda.com',
  'honda': 'honda.com',
  'lexus': 'lexus.com',
  'porsche': 'porsche.com',
  'land-rover': 'landrover.com',
  'jaguar': 'jaguar.com',
  'fiat': 'fiat.com',
  'alfa-romeo': 'alfaromeo.com',
  'jeep': 'jeep.com',
  'chevrolet': 'chevrolet.com',
  'tesla': 'tesla.com',
};

// Deduplicate by domain so we don't download the same file twice (e.g. vw = volkswagen)
const domainToBrands = {};
for (const [brand, domain] of Object.entries(brandDomains)) {
  if (!domainToBrands[domain]) domainToBrands[domain] = [];
  domainToBrands[domain].push(brand);
}

function download(url, dest) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    https.get(url, (res) => {
      if (res.statusCode !== 200) {
        file.close();
        fs.unlink(dest, () => {});
        return reject(new Error(`HTTP ${res.statusCode}`));
      }
      res.pipe(file);
      file.on('finish', () => file.close(resolve));
    }).on('error', (err) => {
      file.close();
      fs.unlink(dest, () => {});
      reject(err);
    });
  });
}

async function run() {
  if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  const entries = Object.entries(domainToBrands);
  for (const [domain, brands] of entries) {
    const url = `https://img.logo.dev/${domain}?token=${TOKEN}&size=${SIZE}&format=png`;
    // Primary filename = first brand in list
    const primaryBrand = brands[0];
    const dest = path.join(OUTPUT_DIR, `${primaryBrand}.png`);

    process.stdout.write(`Downloading ${primaryBrand} (${domain})... `);
    try {
      await download(url, dest);
      // Create copies for aliases (e.g. vw → volkswagen.png)
      for (const alias of brands.slice(1)) {
        fs.copyFileSync(dest, path.join(OUTPUT_DIR, `${alias}.png`));
      }
      console.log('OK');
    } catch (e) {
      console.log(`FAILED: ${e.message}`);
    }

    // Small delay to be polite to the API
    await new Promise(r => setTimeout(r, 200));
  }

  console.log('\nDone. Files saved to:', OUTPUT_DIR);
}

run();
