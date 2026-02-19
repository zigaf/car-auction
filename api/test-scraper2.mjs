import { chromium } from 'playwright';

const detailUrl = 'https://autobid.de/ru/element/vw-caddy-kombi-1-5-tsi-ecoprofi-3280510/podrobnosti';

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    locale: 'ru-RU',
    viewport: { width: 1920, height: 1080 },
  });
  const page = await context.newPage();

  // 1. Test search page card extraction
  console.log('=== SEARCH PAGE CARD STRUCTURE ===');
  const searchUrl = 'https://autobid.de/ru/rezultaty-poiska?e367=1&sortingType=auctionStartDate-ASCENDING&carList-category=1;2&carList-category=1;1&carList-category=1;77&carList-category=1;17&carList-category=1;33&carList-category=1;6&carList-category=1;608&carList-category=1;34&carList-category=1;3';
  await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => {});
  const cookieBtn = await page.$('#onetrust-accept-btn-handler');
  if (cookieBtn) { await cookieBtn.click(); await page.waitForTimeout(2000); }
  await page.waitForTimeout(8000);

  // Analyze first vehicle card structure
  const cardInfo = await page.evaluate(() => {
    const links = Array.from(document.querySelectorAll('a[href*="/element/"]'));
    // Group links by vehicle ID
    const vehicles = {};
    links.forEach(link => {
      const href = link.href;
      const idMatch = href.match(/[-/](\d{5,})/);
      if (!idMatch) return;
      const id = idMatch[1];
      if (!vehicles[id]) vehicles[id] = { id, links: [] };
      vehicles[id].links.push({
        href,
        text: link.textContent?.trim()?.substring(0, 100),
        parentTag: link.parentElement?.tagName,
        parentClass: link.parentElement?.className?.substring(0, 100),
      });
    });

    // Get first vehicle's full card HTML
    const firstLink = links.find(l => l.textContent?.trim()?.length > 5);
    let cardHtml = '';
    if (firstLink) {
      // Walk up to find the card container
      let el = firstLink;
      for (let i = 0; i < 10; i++) {
        if (el.parentElement && el.parentElement.querySelectorAll('a[href*="/element/"]').length <= 3) {
          el = el.parentElement;
        } else break;
      }
      cardHtml = el.outerHTML.substring(0, 3000);
    }

    return {
      vehicleCount: Object.keys(vehicles).length,
      firstVehicle: Object.values(vehicles)[0],
      cardHtml,
    };
  });

  console.log(`Unique vehicles found: ${cardInfo.vehicleCount}`);
  console.log('First vehicle links:', JSON.stringify(cardInfo.firstVehicle, null, 2));
  console.log('\nFirst card HTML (first 2000 chars):');
  console.log(cardInfo.cardHtml.substring(0, 2000));

  // 2. Test detail page
  console.log('\n\n=== DETAIL PAGE ===');
  await page.goto(detailUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => {});
  await page.waitForTimeout(8000);

  await page.screenshot({ path: '/Users/maksnalyvaiko/personal/car-auction/api/test-detail.png', fullPage: false });

  const detail = await page.evaluate(() => {
    const getText = (sel) => document.querySelector(sel)?.textContent?.trim() || null;

    // Title
    const h1 = getText('h1');

    // Find all text that looks like key:value or label/value pairs
    const allText = document.body?.innerText?.substring(0, 5000) || '';

    // Look for images
    const imgs = Array.from(document.querySelectorAll('img'))
      .filter(img => img.src.includes('cdn.autobid.de') || img.src.includes('data/cars'))
      .map(img => ({
        src: img.src,
        alt: img.alt,
        w: img.naturalWidth,
        h: img.naturalHeight,
        dataSrc: img.getAttribute('data-src'),
        parentClass: img.parentElement?.className?.substring(0, 80),
      }));

    // Find tables with spec data
    const tables = Array.from(document.querySelectorAll('table')).map(t => ({
      rows: Array.from(t.querySelectorAll('tr')).map(r => {
        const cells = Array.from(r.querySelectorAll('td, th'));
        return cells.map(c => c.textContent?.trim());
      }),
      parentClass: t.parentElement?.className?.substring(0, 80),
    }));

    // Find dl (definition lists)
    const dls = Array.from(document.querySelectorAll('dl')).map(dl => {
      const pairs = {};
      const dts = dl.querySelectorAll('dt');
      const dds = dl.querySelectorAll('dd');
      dts.forEach((dt, i) => {
        pairs[dt.textContent?.trim()] = dds[i]?.textContent?.trim();
      });
      return pairs;
    });

    // Price elements
    const priceEls = Array.from(document.querySelectorAll('*')).filter(el => {
      const t = el.textContent?.trim();
      return t && (t.includes('€') || t.includes('Стартовая') || t.includes('цена')) && t.length < 100;
    }).slice(0, 10).map(el => ({
      text: el.textContent?.trim(),
      tag: el.tagName,
      class: el.className?.substring?.(0, 80),
    }));

    return { h1, allText, imgs, tables, dls, priceEls };
  });

  console.log('Title:', detail.h1);
  console.log('\nBody text (first 3000):');
  console.log(detail.allText.substring(0, 3000));
  console.log('\nImages from CDN:');
  detail.imgs.forEach(img => console.log(`  ${img.src} alt="${img.alt}" ${img.w}x${img.h} parent="${img.parentClass}"`));
  console.log('\nTables:', JSON.stringify(detail.tables.slice(0, 3), null, 2));
  console.log('\nDefinition lists:', JSON.stringify(detail.dls.slice(0, 3), null, 2));
  console.log('\nPrice elements:', JSON.stringify(detail.priceEls, null, 2));

  await browser.close();
}

main().catch(console.error);
