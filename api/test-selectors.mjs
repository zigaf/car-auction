import { chromium } from 'playwright';

/**
 * Local test of the exact selectors used in autobid-browser.service.ts
 * Run: node test-selectors.mjs
 */

const searchUrl = 'https://autobid.de/ru/rezultaty-poiska?e367=1&sortingType=auctionStartDate-ASCENDING&carList-category=1;2&carList-category=1;1&carList-category=1;77&carList-category=1;17&carList-category=1;33&carList-category=1;6&carList-category=1;608&carList-category=1;34&carList-category=1;3';
const detailUrl = 'https://autobid.de/ru/element/vw-caddy-kombi-1-5-tsi-ecoprofi-3280510/podrobnosti';

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    locale: 'ru-RU',
    viewport: { width: 1920, height: 1080 },
  });
  const page = await context.newPage();

  // ==========================================
  // TEST 1: SEARCH PAGE SELECTORS
  // ==========================================
  console.log('=== TEST 1: SEARCH PAGE ===\n');
  await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => {});
  const cookieBtn = await page.$('#onetrust-accept-btn-handler');
  if (cookieBtn) { await cookieBtn.click(); await page.waitForTimeout(2000); }
  await page.waitForTimeout(8000);

  const searchResult = await page.evaluate(() => {
    const cards = [];
    const vehicleLinks = document.querySelectorAll('a[href*="/element/"]');

    // Group links by vehicleId
    const vehicleMap = {};
    vehicleLinks.forEach((link) => {
      const href = link.href;
      if (!href || !href.includes('/element/')) return;
      const idMatch = href.match(/[-/](\d{5,})/);
      if (!idMatch) return;
      const vehicleId = idMatch[1];
      if (!vehicleMap[vehicleId]) vehicleMap[vehicleId] = [];
      vehicleMap[vehicleId].push({ href, text: link.textContent?.trim() || '', link });
    });

    // For each vehicle, pick the link with longest text (title link)
    Object.entries(vehicleMap).forEach(([vehicleId, links]) => {
      links.sort((a, b) => b.text.length - a.text.length);
      const best = links[0];
      const title = best.text.substring(0, 150);
      if (title.length < 3) return;

      let cardEl = best.link;
      for (let i = 0; i < 10; i++) {
        if (cardEl.parentElement && cardEl.parentElement.querySelectorAll('a[href*="/element/"]').length <= 3) {
          cardEl = cardEl.parentElement;
        } else break;
        if (!cardEl) break;
      }
      const container = cardEl || best.link;

      let thumbnailUrl = null;
      const cdnImg = container.querySelector('img[src*="cdn.autobid.de"]');
      if (cdnImg) {
        thumbnailUrl = cdnImg.src;
      } else {
        const source = container.querySelector('picture source[srcset*="cdn.autobid.de"]');
        if (source) {
          thumbnailUrl = source.getAttribute('srcset')?.split(',')[0]?.trim()?.split(' ')[0] || null;
        }
        if (!thumbnailUrl) {
          const anyImg = container.querySelector('img');
          if (anyImg?.src && !anyImg.src.includes('data:')) thumbnailUrl = anyImg.src;
        }
      }

      let price = null;
      const allEls = container.querySelectorAll('*');
      for (const el of Array.from(allEls)) {
        const t = el.textContent?.trim();
        if (t && t.includes('€') && t.length < 50 && el.children.length === 0) {
          price = t;
          break;
        }
      }

      const detailHref = best.href.includes('/podrobnosti')
        ? best.href
        : best.href.replace(/\/?$/, '/podrobnosti');

      cards.push({ title, detailUrl: detailHref, vehicleId, thumbnailUrl, price });
    });

    let totalCount = null;
    let totalPages = null;
    const bodyText = document.body?.innerText || '';
    const countMatch = bodyText.match(/(?:Найденные\s+автомобили|Gefundene\s+Fahrzeuge)\s*\((\d[\d\s.,]*)\)/i);
    if (countMatch) {
      totalCount = parseInt(countMatch[1].replace(/[\s.,]/g, ''), 10);
    }
    if (!totalCount) {
      const fallbackMatch = bodyText.match(/(?:Найдено|Результат|Gefunden|Results?)[:\s]*(\d[\d\s.,]*)/i);
      if (fallbackMatch) totalCount = parseInt(fallbackMatch[1].replace(/[\s.,]/g, ''), 10);
    }

    const paginationLinks = document.querySelectorAll('a[href*="page="], [class*="pagination"] a, nav a');
    if (paginationLinks.length > 0) {
      let maxPage = 1;
      paginationLinks.forEach((el) => {
        const text = el.textContent?.trim();
        const num = text ? parseInt(text, 10) : NaN;
        if (!isNaN(num) && num > maxPage) maxPage = num;
        const href = el.href;
        const pageMatch = href?.match(/page=(\d+)/);
        if (pageMatch) {
          const p = parseInt(pageMatch[1], 10);
          if (p > maxPage) maxPage = p;
        }
      });
      totalPages = maxPage;
    }
    if (!totalPages && totalCount && cards.length > 0) {
      totalPages = Math.ceil(totalCount / cards.length);
    }

    return { vehicles: cards, totalCount, totalPages };
  });

  console.log(`Vehicles found: ${searchResult.vehicles.length}`);
  console.log(`Total count: ${searchResult.totalCount}`);
  console.log(`Total pages: ${searchResult.totalPages}`);
  console.log('\nFirst 3 vehicles:');
  searchResult.vehicles.slice(0, 3).forEach((v, i) => {
    console.log(`\n  [${i+1}] ${v.title}`);
    console.log(`      ID: ${v.vehicleId}`);
    console.log(`      Price: ${v.price}`);
    console.log(`      Thumb: ${v.thumbnailUrl?.substring(0, 80)}`);
    console.log(`      URL: ${v.detailUrl}`);
  });

  const hasTitle = searchResult.vehicles.filter(v => v.title.length > 5).length;
  const hasPrice = searchResult.vehicles.filter(v => v.price).length;
  const hasThumb = searchResult.vehicles.filter(v => v.thumbnailUrl).length;
  console.log(`\n  Stats: ${hasTitle}/${searchResult.vehicles.length} with title, ${hasPrice}/${searchResult.vehicles.length} with price, ${hasThumb}/${searchResult.vehicles.length} with thumbnail`);

  // ==========================================
  // TEST 2: DETAIL PAGE SELECTORS
  // ==========================================
  console.log('\n\n=== TEST 2: DETAIL PAGE ===\n');
  await page.goto(detailUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => {});
  await page.waitForTimeout(8000);

  const detailResult = await page.evaluate(() => {
    const getAll = (sel) => Array.from(document.querySelectorAll(sel));

    // Title from document.title
    let title = '';
    const docTitle = document.title || '';
    const titleClean = docTitle
      .replace(/\s*[-–|]\s*autobid\.de.*$/i, '')
      .replace(/\s*[-–|]\s*Подробности.*$/i, '')
      .replace(/\s*[-–|]\s*podrobnosti.*$/i, '')
      .trim();
    if (titleClean.length > 3) title = titleClean;
    if (!title) {
      const headings = document.querySelectorAll('h1, h2, h3');
      for (const h of Array.from(headings)) {
        const t = h.textContent?.trim();
        if (t && t.length > 5 && t.length < 200) { title = t; break; }
      }
    }

    // Specs from tables
    const specs = {};
    getAll('table tr').forEach((row) => {
      const cells = row.querySelectorAll('td, th');
      if (cells.length >= 2) {
        let label = cells[0]?.textContent?.trim();
        const value = cells[1]?.textContent?.trim();
        if (label) label = label.replace(/:+$/, '').trim();
        if (label && value && label.length < 80 && label !== value) specs[label] = value;
      }
    });
    // Also DL
    getAll('dl').forEach((dl) => {
      const dts = dl.querySelectorAll('dt');
      const dds = dl.querySelectorAll('dd');
      dts.forEach((dt, i) => {
        const label = dt.textContent?.trim();
        const value = dds[i]?.textContent?.trim();
        if (label && value) specs[label] = value;
      });
    });

    // Images from cdn.autobid.de
    const imageUrls = [];
    const seenBaseUrls = new Set();
    getAll('img').forEach((img) => {
      const src = img.src || img.getAttribute('data-src') || '';
      if (!src.includes('cdn.autobid.de')) return;
      if (src.includes('logo') || src.includes('icon')) return;
      const baseUrl = src.replace(/_(?:xs|s|m|l)\.(jpg|jpeg|png|webp)/i, '_l.$1');
      if (!seenBaseUrls.has(baseUrl)) {
        seenBaseUrls.add(baseUrl);
        imageUrls.push(baseUrl);
      }
    });
    if (imageUrls.length === 0) {
      getAll('picture source').forEach((source) => {
        const srcset = source.getAttribute('srcset') || '';
        const urls = srcset.split(',').map(s => s.trim().split(' ')[0]);
        urls.forEach((url) => {
          if (!url.includes('cdn.autobid.de')) return;
          const baseUrl = url.replace(/_(?:xs|s|m|l)\.(jpg|jpeg|png|webp)/i, '_l.$1');
          if (!seenBaseUrls.has(baseUrl)) {
            seenBaseUrls.add(baseUrl);
            imageUrls.push(baseUrl);
          }
        });
      });
    }

    // Price
    let price = null;
    const allElements = document.querySelectorAll('td, span, div, p');
    for (const el of Array.from(allElements)) {
      const t = el.textContent?.trim();
      if (t && t.includes('€') && t.length < 50 && t.length > 3 && el.children.length === 0) {
        if (/[\d.,]+\s*€/.test(t)) { price = t; break; }
      }
    }
    if (!price) {
      const bodyText = document.body?.innerText || '';
      const priceMatch = bodyText.match(/(?:Стартовая\s+цена|Startpreis|Mindestgebot)[:\s]*([\d.,]+\s*€)/i);
      if (priceMatch) price = priceMatch[1];
    }

    // Auction end date
    let auctionEndDate = null;
    const bodyText = document.body?.innerText || '';
    const dateMatch = bodyText.match(/(?:Аукцион|Окончание|Auction|Ende|Endet)[:\s]*(\d{2}\.\d{2}\.\d{4}\s+\d{2}:\d{2})/i);
    if (dateMatch) auctionEndDate = dateMatch[1];

    return { title, specs, imageUrls, price, auctionEndDate };
  });

  console.log(`Title: "${detailResult.title}"`);
  console.log(`Price: ${detailResult.price}`);
  console.log(`Auction end: ${detailResult.auctionEndDate}`);
  console.log(`Images: ${detailResult.imageUrls.length}`);
  if (detailResult.imageUrls.length > 0) {
    console.log(`  First: ${detailResult.imageUrls[0]}`);
    console.log(`  Last:  ${detailResult.imageUrls[detailResult.imageUrls.length-1]}`);
  }
  console.log(`Specs (${Object.keys(detailResult.specs).length}):`);
  Object.entries(detailResult.specs).forEach(([k, v]) => {
    console.log(`  ${k}: ${v}`);
  });

  // ==========================================
  // SUMMARY
  // ==========================================
  console.log('\n\n=== SUMMARY ===');
  const ok = (cond, msg) => console.log(`  ${cond ? '✅' : '❌'} ${msg}`);
  ok(searchResult.vehicles.length > 0, `Search: ${searchResult.vehicles.length} vehicles found`);
  ok(searchResult.totalCount > 0, `Search: totalCount = ${searchResult.totalCount}`);
  ok(searchResult.totalPages > 0, `Search: totalPages = ${searchResult.totalPages}`);
  ok(hasPrice > 0, `Search: ${hasPrice} vehicles have prices`);
  ok(hasThumb > 0, `Search: ${hasThumb} vehicles have thumbnails`);
  ok(detailResult.title.length > 5, `Detail: title = "${detailResult.title}"`);
  ok(Object.keys(detailResult.specs).length > 3, `Detail: ${Object.keys(detailResult.specs).length} specs`);
  ok(detailResult.imageUrls.length > 0, `Detail: ${detailResult.imageUrls.length} images`);
  ok(detailResult.price, `Detail: price = ${detailResult.price}`);

  await browser.close();
}

main().catch(console.error);
