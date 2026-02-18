const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

(async () => {
  const browser = await chromium.launch({
    headless: true,
    proxy: {
      server: 'https://unblock.oxylabs.io:60000',
      username: 'zigaf991_6IcLn',
      password: '1l00VE+PerDVn'
    },
    args: ['--disable-blink-features=AutomationControlled']
  });

  const context = await browser.newContext({
    ignoreHTTPSErrors: true,
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    locale: 'en-US',
    viewport: { width: 1920, height: 1080 }
  });

  const page = await context.newPage();
  const outputDir = path.join(__dirname, 'test-photos');
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir);

  // Capture ALL responses from lot page
  const lotApiCalls = [];
  page.on('response', async (resp) => {
    const url = resp.url();
    const ct = resp.headers()['content-type'] || '';
    if (ct.includes('json') && (url.includes('lot') || url.includes('Lot') || url.includes('image') || url.includes('presale') || url.includes('api'))) {
      try {
        const body = await resp.text();
        lotApiCalls.push({ url, status: resp.status(), body: body.substring(0, 5000) });
      } catch(e) {}
    }
  });

  try {
    console.log('Establishing session...');
    await page.goto('https://be.bca-europe.com/Search', { waitUntil: 'domcontentloaded', timeout: 90000 });
    await page.waitForTimeout(8000);

    // Get first vehicle data
    const vehicle = await page.evaluate(async () => {
      const resp = await fetch('/buyer/facetedsearch/GetViewModel?cultureCode=en', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
        body: '{}'
      });
      const json = await resp.json();
      const v = json.VehicleResults[0];
      return {
        make: v.Make, model: v.Model, vin: v.VIN,
        imageUrl: v.ImageUrl, imageKey: v.Imagekey,
        lotId: v.LotId, viewLotUrl: v.ViewLotUrl,
        viewLotLink: v.ViewLotLink  // base64 encoded presale API URL
      };
    });
    console.log('Vehicle:', vehicle.make, vehicle.model, '| VIN:', vehicle.vin);

    // Decode the ViewLotLink (base64)
    const presaleUrl = Buffer.from(vehicle.viewLotLink, 'base64').toString('utf-8');
    console.log('Presale API URL (decoded):', presaleUrl);

    // Try the presale API directly
    console.log('\n=== TRYING PRESALE API ===');
    const presaleResult = await page.evaluate(async (url) => {
      try {
        const resp = await fetch(url, {
          headers: { 'Accept': 'application/json', 'X-Requested-With': 'XMLHttpRequest' }
        });
        const text = await resp.text();
        return { status: resp.status, length: text.length, body: text.substring(0, 8000) };
      } catch(e) {
        return { error: e.message };
      }
    }, presaleUrl);
    console.log('Status:', presaleResult.status, 'Length:', presaleResult.length);
    if (presaleResult.body) {
      try {
        const json = JSON.parse(presaleResult.body);
        console.log('Keys:', Object.keys(json));
        // Look for image-related fields
        const imageFields = Object.keys(json).filter(k =>
          k.toLowerCase().includes('image') || k.toLowerCase().includes('photo') ||
          k.toLowerCase().includes('media') || k.toLowerCase().includes('gallery')
        );
        console.log('Image-related fields:', imageFields);
        imageFields.forEach(f => {
          const val = json[f];
          if (Array.isArray(val)) {
            console.log('  ' + f + ': Array[' + val.length + ']');
            if (val.length > 0) console.log('    Sample:', JSON.stringify(val[0]).substring(0, 500));
          } else {
            console.log('  ' + f + ':', JSON.stringify(val).substring(0, 500));
          }
        });
      } catch(e) {
        console.log('Raw:', presaleResult.body.substring(0, 3000));
      }
    }

    // Now load the lot page with longer wait
    console.log('\n=== LOADING LOT PAGE (longer wait) ===');
    await page.goto(vehicle.viewLotUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(20000);  // wait 20s for full render

    // Try multiple selectors for images
    const images = await page.evaluate(() => {
      const results = { bcaImages: [], allImages: [], dataAttrs: [] };

      // Standard img tags
      document.querySelectorAll('img').forEach(img => {
        const src = img.src || img.dataset?.src || img.getAttribute('data-lazy') || '';
        if (src.includes('bcaimage') || src.includes('VehicleImage')) {
          results.bcaImages.push(src);
        }
      });

      // Check for data attributes with image URLs
      document.querySelectorAll('[data-image], [data-src], [data-photo], [data-url]').forEach(el => {
        const val = el.dataset.image || el.dataset.src || el.dataset.photo || el.dataset.url || '';
        if (val.includes('bcaimage') || val.includes('docId')) {
          results.dataAttrs.push(val);
        }
      });

      // Look in page source for docId patterns
      const html = document.documentElement.innerHTML;
      const docIdMatches = html.match(/docId[=:]["']?(\d+)/g) || [];
      results.docIdsInHtml = [...new Set(docIdMatches)];

      // Look for any JSON with images embedded in script tags
      document.querySelectorAll('script').forEach(s => {
        const text = s.textContent;
        if (text.includes('docId') || text.includes('galleryImages') || text.includes('VehicleImage')) {
          // Extract docIds from script content
          const matches = text.match(/docId[=:]["']?(\d+)/g) || [];
          matches.forEach(m => results.docIdsInHtml.push(m));
        }
      });

      results.docIdsInHtml = [...new Set(results.docIdsInHtml)];
      return results;
    });

    console.log('BCA images found:', images.bcaImages.length);
    images.bcaImages.forEach(u => console.log('  ', u.substring(0, 120)));
    console.log('Data attributes:', images.dataAttrs.length);
    console.log('DocIds in HTML:', images.docIdsInHtml.length);
    images.docIdsInHtml.forEach(d => console.log('  ', d));

    // Download gallery photos if found
    const docIds = [...new Set(images.docIdsInHtml.map(d => d.match(/\d+/)?.[0]).filter(Boolean))];
    if (docIds.length > 0) {
      console.log('\n=== DOWNLOADING GALLERY (' + docIds.length + ' photos) ===');
      for (let i = 0; i < docIds.length; i++) {
        const docId = docIds[i];
        const url = 'https://www1.bcaimage.com/GetDoc.aspx?DocType=VehicleImage&docId=' + docId;
        const fileName = vehicle.vin + '_gallery_' + (i + 1) + '.jpg';
        const filePath = path.join(outputDir, fileName);
        try {
          const imgPage = await context.newPage();
          const response = await imgPage.goto(url, { waitUntil: 'load', timeout: 30000 });
          if (response && response.ok()) {
            const buffer = await response.body();
            fs.writeFileSync(filePath, buffer);
            console.log('  [OK] ' + fileName + ' | ' + (buffer.length / 1024).toFixed(1) + ' KB');
          } else {
            console.log('  [FAIL] ' + fileName + ' | ' + (response ? response.status() : 'no response'));
          }
          await imgPage.close();
        } catch(e) {
          console.log('  [ERROR] ' + fileName + ' | ' + e.message.substring(0, 60));
        }
      }
    }

    // Print all lot API calls captured
    if (lotApiCalls.length > 0) {
      console.log('\n=== LOT PAGE API CALLS ===');
      lotApiCalls.forEach(c => {
        console.log('[' + c.status + '] ' + c.url.substring(0, 100));
        console.log('  ', c.body.substring(0, 300));
      });
    }

    // Final file listing
    console.log('\n=== ALL DOWNLOADED FILES ===');
    const files = fs.readdirSync(outputDir);
    let totalSize = 0;
    files.forEach(f => {
      const stat = fs.statSync(path.join(outputDir, f));
      totalSize += stat.size;
      console.log('  ' + f + ' (' + (stat.size / 1024).toFixed(1) + ' KB)');
    });
    console.log('\nTotal:', files.length, 'files |', (totalSize / 1024).toFixed(1), 'KB');

  } catch(e) {
    console.error('Error:', e.message);
  }

  await browser.close();
  console.log('\nDone.');
})();
