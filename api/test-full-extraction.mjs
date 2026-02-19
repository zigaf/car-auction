import { chromium } from 'playwright';

/**
 * Full extraction test using the exact evaluate logic from autobid-browser.service.ts.
 * Tests against the URL provided by the user.
 * Run: node test-full-extraction.mjs
 */

const detailUrl = 'https://autobid.de/ru/element/vw-caddy-maxi-2-0-tdi-bmt-dsg-comfortline-3308170/podrobnosti';

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    locale: 'ru-RU',
    viewport: { width: 1920, height: 1080 },
  });
  const page = await context.newPage();

  console.log(`\nNavigating to: ${detailUrl}\n`);
  await page.goto(detailUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => {});
  const cookieBtn = await page.$('#onetrust-accept-btn-handler');
  if (cookieBtn) { await cookieBtn.click(); console.log('Cookie accepted'); await page.waitForTimeout(2000); }
  // Click "Continue anyway" for browser warning
  const continueBtn = await page.$('text=Продолжить в любом случае');
  if (continueBtn) { await continueBtn.click(); console.log('Browser warning dismissed'); await page.waitForTimeout(3000); }
  await page.waitForTimeout(5000);
  // Scroll page for lazy content
  await page.evaluate(async () => {
    let pos = 0;
    while (pos < document.body.scrollHeight) { window.scrollTo(0, pos); pos += 500; await new Promise(r => setTimeout(r, 200)); }
    window.scrollTo(0, 0);
  });
  await page.waitForTimeout(3000);

  const result = await page.evaluate(() => {
    const getAll = (sel) => Array.from(document.querySelectorAll(sel));

    const findSectionContainer = (keywords) => {
      // autobid.de section headers are <header class="...bg-[#EAE7E0]...">
      const headers = getAll('header');
      for (const header of headers) {
        const text = header.textContent?.trim()?.toUpperCase() || '';
        if (keywords.some(kw => text.includes(kw.toUpperCase()))) {
          const gp = header.parentElement;
          return gp?.parentElement || gp || header;
        }
      }
      return null;
    };

    // ---- TITLE ----
    let title = '';
    const docTitle = document.title || '';
    const titleClean = docTitle
      .replace(/\s*[-\u2013|]\s*autobid\.de.*$/i, '')
      .replace(/\s*[-\u2013|]\s*\u041f\u043e\u0434\u0440\u043e\u0431\u043d\u043e\u0441\u0442\u0438.*$/i, '')
      .trim();
    if (titleClean.length > 3) title = titleClean;
    if (!title) {
      const headings = document.querySelectorAll('h1, h2, h3');
      for (const h of Array.from(headings)) {
        const t = h.textContent?.trim();
        if (t && t.length > 5 && t.length < 200) { title = t; break; }
      }
    }

    // ---- SPECS ----
    const specs = {};
    getAll('table tr').forEach(row => {
      const cells = row.querySelectorAll('td, th');
      if (cells.length >= 2) {
        let label = cells[0]?.textContent?.trim();
        const value = cells[1]?.textContent?.trim();
        if (label) label = label.replace(/:+$/, '').trim();
        if (label && value && label.length < 80 && label !== value) specs[label] = value;
      }
    });
    getAll('dl').forEach(dl => {
      const dts = dl.querySelectorAll('dt');
      const dds = dl.querySelectorAll('dd');
      dts.forEach((dt, i) => {
        const label = dt.textContent?.trim();
        const value = dds[i]?.textContent?.trim();
        if (label && value) specs[label] = value;
      });
    });

    // ---- IMAGES ----
    const imageUrls = [];
    const seenBaseUrls = new Set();
    const addCdnImage = (src) => {
      if (!src.includes('cdn.autobid.de')) return;
      if (src.includes('logo') || src.includes('icon')) return;
      const baseUrl = src.replace(/_(?:xs|s|m|l)\.(jpg|jpeg|png|webp)/i, '_l.$1');
      if (!seenBaseUrls.has(baseUrl)) { seenBaseUrls.add(baseUrl); imageUrls.push(baseUrl); }
    };
    getAll('img').forEach(img => {
      addCdnImage(img.src || img.getAttribute('data-src') || '');
    });

    // ---- PRICE ----
    let price = null;
    for (const el of Array.from(document.querySelectorAll('td, span, div, p'))) {
      const t = el.textContent?.trim();
      if (t && t.includes('\u20ac') && t.length < 50 && t.length > 3 && el.children.length === 0 && /[\d.,]+\s*\u20ac/.test(t)) {
        price = t; break;
      }
    }

    // ---- EQUIPMENT ----
    const equipment = [];
    const equipContainer = findSectionContainer(['\u041a\u041e\u041c\u041f\u041b\u0415\u041a\u0422\u0410\u0426\u0418\u042f', 'AUSSTATTUNG', 'EQUIPMENT']);
    if (equipContainer) {
      equipContainer.querySelectorAll('li').forEach(li => {
        const text = li.textContent?.trim();
        if (text && text.length > 2 && text.length < 200) equipment.push(text);
      });
    }
    if (equipment.length === 0) {
      const allLi = getAll('li');
      const clusters = [];
      let currentCluster = [];
      allLi.forEach(li => {
        const text = li.textContent?.trim() || '';
        if (text.length > 2 && text.length < 200) currentCluster.push(li);
        else if (currentCluster.length > 0) { clusters.push(currentCluster); currentCluster = []; }
      });
      if (currentCluster.length > 0) clusters.push(currentCluster);
      const biggest = clusters.sort((a, b) => b.length - a.length)[0];
      if (biggest && biggest.length >= 5) biggest.forEach(li => equipment.push(li.textContent?.trim() || ''));
    }

    // ---- BODY CONDITION ----
    const bodyContainer = findSectionContainer(['КУЗОВ', 'KAROSSERIE', 'BODY']);
    const bodyCondition = [];
    if (bodyContainer) {
      bodyContainer.querySelectorAll('table').forEach(table => {
        const thead = table.querySelector('thead tr') || table.querySelector('tr:first-child');
        const headerCells = thead?.querySelectorAll('td, th');
        table.querySelectorAll('tbody tr, tr').forEach(row => {
          if (row === thead) return;
          const cells = row.querySelectorAll('td');
          if (cells.length < 1) return;
          const partName = cells[0]?.textContent?.trim();
          if (!partName || partName.length < 2 || partName.length > 100) return;
          const issues = [];
          if (headerCells && cells.length > 1) {
            for (let i = 1; i < cells.length; i++) {
              const cell = cells[i];
              const hasIndicator = cell.querySelector('svg, [class*="toggle"], [class*="bg-"]') || cell.innerHTML.includes('bg-');
              if (hasIndicator && headerCells[i]) {
                const name = headerCells[i]?.textContent?.trim();
                if (name) issues.push(name);
              }
            }
          }
          bodyCondition.push({ part: partName, issues });
        });
      });
    }

    // ---- INTERIOR ----
    const interiorContainer = findSectionContainer(['САЛОН', 'INNENRAUM', 'INTERIOR']);
    const interiorCondition = [];
    if (interiorContainer) {
      interiorContainer.querySelectorAll('table').forEach(table => {
        const thead = table.querySelector('thead tr') || table.querySelector('tr:first-child');
        const headerCells = thead?.querySelectorAll('td, th');
        table.querySelectorAll('tbody tr, tr').forEach(row => {
          if (row === thead) return;
          const cells = row.querySelectorAll('td');
          if (cells.length < 1) return;
          const partName = cells[0]?.textContent?.trim();
          if (!partName || partName.length < 2 || partName.length > 100) return;
          const issues = [];
          if (headerCells && cells.length > 1) {
            for (let i = 1; i < cells.length; i++) {
              const cell = cells[i];
              const hasIndicator = cell.querySelector('svg, [class*="toggle"]') || cell.innerHTML.includes('bg-');
              if (hasIndicator && headerCells[i]) {
                const name = headerCells[i]?.textContent?.trim();
                if (name) issues.push(name);
              }
            }
          }
          interiorCondition.push({ part: partName, issues });
        });
      });
    }

    // ---- TIRES ----
    const tires = [];
    const tiresContainer = findSectionContainer(['ШИНЫ', 'REIFEN', 'КОЛЕСНЫЕ ДИСКИ']);
    if (tiresContainer) {
      tiresContainer.querySelectorAll('table tr').forEach(row => {
        const cells = row.querySelectorAll('td');
        if (cells.length >= 2) {
          const pos = cells[0]?.textContent?.trim();
          if (pos && (pos.includes('слева') || pos.includes('справа') || pos.includes('Спереди') || pos.includes('спереди') || pos.includes('сзади') || pos.includes('links') || pos.includes('rechts'))) {
            const depth = cells[1]?.textContent?.trim() || null;
            const size = cells.length >= 3 ? cells[2]?.textContent?.trim() || null : null;
            tires.push({ position: pos, treadDepth: depth, size });
          }
        }
      });
    }

    // ---- STONE CHIPS ----
    const chipsContainer = findSectionContainer(['ВМЯТИНА ОТ КАМНЕЙ', 'STEINSCHLAG']);
    const stoneChips = [];
    if (chipsContainer) {
      chipsContainer.querySelectorAll('table').forEach(table => {
        const thead = table.querySelector('thead tr') || table.querySelector('tr:first-child');
        const headerCells = thead?.querySelectorAll('td, th');
        table.querySelectorAll('tbody tr, tr').forEach(row => {
          if (row === thead) return;
          const cells = row.querySelectorAll('td');
          if (cells.length < 1) return;
          const partName = cells[0]?.textContent?.trim();
          if (!partName || partName.length < 2 || partName.length > 100) return;
          const issues = [];
          if (headerCells && cells.length > 1) {
            for (let i = 1; i < cells.length; i++) {
              const cell = cells[i];
              const hasIndicator = cell.querySelector('svg, [class*="toggle"]') || cell.innerHTML.includes('bg-');
              if (hasIndicator && headerCells[i]) {
                const name = headerCells[i]?.textContent?.trim();
                if (name) issues.push(name);
              }
            }
          }
          stoneChips.push({ part: partName, issues });
        });
      });
    }

    // ---- ACCIDENT INFO ----
    let accidentInfo = null;
    const accidentContainer = findSectionContainer(['АВАРИЯ', 'ПРЕДШЕСТВУЮЩИЕ ПОВРЕЖДЕНИЯ', 'UNFALL']);
    if (accidentContainer) {
      const texts = [];
      accidentContainer.querySelectorAll('p, div, span, td').forEach(el => {
        if (el.children.length === 0) {
          const t = el.textContent?.trim();
          if (t && t.length > 3 && !t.toUpperCase().includes('АВАРИЯ') && !t.toUpperCase().includes('ПОВРЕЖДЕНИЯ')) texts.push(t);
        }
      });
      if (texts.length > 0) accidentInfo = texts.join('. ');
    }

    // ---- SEATS ----
    let seats = null;
    const seatsContainer = findSectionContainer(['СИДЕНИЯ', 'СИДЕНЬЯ', 'SITZE', 'SEATS']);
    if (seatsContainer) {
      const parts = [];
      seatsContainer.querySelectorAll('li').forEach(li => {
        const t = li.textContent?.trim();
        if (t) parts.push(t);
      });
      if (parts.length > 0) seats = parts.join('; ');
    }

    // ---- PARKING FEE ----
    let parkingFee = null;
    const parkingContainer = findSectionContainer(['ВЗНОС ЗА НАХОЖДЕНИЕ', 'STANDGELD']);
    if (parkingContainer) {
      const texts = [];
      parkingContainer.querySelectorAll('[class*="whitespace-pre-line"], p, div').forEach(el => {
        if (el.children.length === 0) {
          const t = el.textContent?.trim();
          if (t && t.length > 5 && !t.toUpperCase().includes('ВЗНОС')) texts.push(t);
        }
      });
      if (texts.length > 0) parkingFee = texts.join(' ');
    }

    // ---- GENERAL INFO ----
    let generalInfo = null;
    const generalContainer = findSectionContainer(['ОБЩАЯ ИНФОРМАЦИЯ', 'ALLGEMEINE']);
    if (generalContainer) {
      const texts = [];
      generalContainer.querySelectorAll('p, div, span').forEach(el => {
        if (el.children.length === 0) {
          const t = el.textContent?.trim();
          if (t && t.length > 3 && !t.toUpperCase().includes('ОБЩАЯ ИНФОРМАЦИЯ')) texts.push(t);
        }
      });
      if (texts.length > 0) generalInfo = texts.join('. ');
    }

    // ---- DESCRIPTION ----
    let description = null;
    if (equipContainer) {
      const allText = [];
      let foundList = false;
      Array.from(equipContainer.children).forEach(child => {
        if (child.tagName === 'UL' || child.querySelector('ul, li')) { foundList = true; return; }
        if (foundList) {
          const t = child.textContent?.trim();
          if (t && t.length > 10) allText.push(t);
        }
      });
      if (allText.length > 0) description = allText.join('\n');
    }

    return {
      title, specs, imageUrls, price, equipment,
      bodyCondition, interiorCondition, tires, stoneChips,
      accidentInfo, seats, parkingFee, generalInfo, description,
    };
  });

  // ---- PRINT RESULTS ----
  console.log('=== TITLE ===');
  console.log(`  "${result.title}"`);

  console.log('\n=== PRICE ===');
  console.log(`  ${result.price}`);

  console.log(`\n=== IMAGES: ${result.imageUrls.length} ===`);
  if (result.imageUrls.length > 0) {
    console.log(`  First: ${result.imageUrls[0]}`);
    console.log(`  Last:  ${result.imageUrls[result.imageUrls.length - 1]}`);
  }

  console.log(`\n=== SPECS (${Object.keys(result.specs).length}) ===`);
  Object.entries(result.specs).forEach(([k, v]) => {
    if (typeof v === 'string' && v.length < 100) console.log(`  ${k}: ${v}`);
  });

  console.log(`\n=== EQUIPMENT (${result.equipment.length}) ===`);
  result.equipment.forEach(item => console.log(`  - ${item}`));

  console.log(`\n=== BODY CONDITION (${result.bodyCondition.length}) ===`);
  result.bodyCondition.forEach(item => {
    const issues = item.issues.length > 0 ? ` [${item.issues.join(', ')}]` : '';
    console.log(`  ${item.part}${issues}`);
  });

  console.log(`\n=== INTERIOR (${result.interiorCondition.length}) ===`);
  result.interiorCondition.forEach(item => {
    const issues = item.issues.length > 0 ? ` [${item.issues.join(', ')}]` : '';
    console.log(`  ${item.part}${issues}`);
  });

  console.log(`\n=== TIRES (${result.tires.length}) ===`);
  result.tires.forEach(t => console.log(`  ${t.position}: depth=${t.treadDepth}, size=${t.size}`));

  console.log(`\n=== STONE CHIPS (${result.stoneChips.length}) ===`);
  result.stoneChips.forEach(item => {
    const issues = item.issues.length > 0 ? ` [${item.issues.join(', ')}]` : '';
    console.log(`  ${item.part}${issues}`);
  });

  console.log(`\n=== ACCIDENT INFO ===`);
  console.log(`  ${result.accidentInfo || '(none)'}`);

  console.log(`\n=== SEATS ===`);
  console.log(`  ${result.seats || '(none)'}`);

  console.log(`\n=== PARKING FEE ===`);
  console.log(`  ${result.parkingFee || '(none)'}`);

  console.log(`\n=== GENERAL INFO ===`);
  console.log(`  ${result.generalInfo || '(none)'}`);

  console.log(`\n=== DESCRIPTION ===`);
  console.log(`  ${result.description?.substring(0, 500) || '(none)'}`);

  // ---- SUMMARY ----
  console.log('\n\n=== SUMMARY ===');
  const ok = (cond, msg) => console.log(`  ${cond ? '\u2705' : '\u274c'} ${msg}`);
  ok(result.title.length > 5, `Title: "${result.title}"`);
  ok(Object.keys(result.specs).length > 10, `Specs: ${Object.keys(result.specs).length}`);
  ok(result.imageUrls.length > 10, `Images: ${result.imageUrls.length}`);
  ok(result.price, `Price: ${result.price}`);
  ok(result.equipment.length >= 5, `Equipment: ${result.equipment.length} items`);
  ok(result.bodyCondition.length > 0, `Body condition: ${result.bodyCondition.length} parts`);
  ok(result.interiorCondition.length > 0, `Interior: ${result.interiorCondition.length} parts`);
  ok(result.tires.length > 0, `Tires: ${result.tires.length} positions`);
  ok(result.stoneChips.length > 0, `Stone chips: ${result.stoneChips.length} areas`);
  ok(result.accidentInfo, `Accident info found`);
  ok(result.seats, `Seats info found`);
  ok(result.parkingFee, `Parking fee found`);

  await browser.close();
}

main().catch(console.error);
