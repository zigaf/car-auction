import { chromium } from 'playwright';

/**
 * Test new field extraction + image categorization from autobid detail page.
 * Run: node test-new-fields.mjs
 */

const detailUrl = 'https://autobid.de/ru/element/vw-caddy-maxi-2-0-tdi-bmt-dsg-comfortline-3308170/podrobnosti';
const vehicleId = '3308170';

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    ignoreHTTPSErrors: true,
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    locale: 'ru-RU',
    viewport: { width: 1920, height: 1080 },
  });
  const page = await context.newPage();

  console.log(`Navigating to: ${detailUrl}\n`);
  await page.goto(detailUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => {});

  // Dismiss overlays
  for (let attempt = 0; attempt < 3; attempt++) {
    const cookieBtn = await page.$('#onetrust-accept-btn-handler');
    if (cookieBtn && await cookieBtn.isVisible().catch(() => false)) {
      await cookieBtn.click(); await page.waitForTimeout(2000);
    }
    for (const text of ['Продолжить в любом случае', 'Continue anyway', 'Trotzdem fortfahren']) {
      try {
        const btn = await page.$(`text=${text}`);
        if (btn && await btn.isVisible().catch(() => false)) {
          await btn.click(); await page.waitForTimeout(3000);
        }
      } catch {}
    }
    await page.waitForTimeout(2000);
  }
  await page.waitForTimeout(5000);

  // Scroll page for lazy content
  await page.evaluate(async () => {
    let pos = 0;
    while (pos < document.body.scrollHeight) { window.scrollTo(0, pos); pos += 500; await new Promise(r => setTimeout(r, 200)); }
    window.scrollTo(0, 0);
  });
  await page.waitForTimeout(3000);

  const result = await page.evaluate((vId) => {
    const getAll = (sel) => Array.from(document.querySelectorAll(sel));
    const bodyText = document.body?.innerText || '';

    // ===== AUCTION NUMBER =====
    let auctionNumber = null;
    const auctionNrMatch = bodyText.match(/(?:Номер аукциона|Auktionsnummer)[:\s]*(\d+)/i);
    if (auctionNrMatch) auctionNumber = auctionNrMatch[1];

    // ===== AUCTION DATE =====
    let auctionEndDate = null;
    const headerDateMatch = bodyText.match(
      /(?:Номер аукциона\s*\d+\s*\|?\s*)(\d{2}\.\d{2}\.\d{4})\s*\|?\s*(?:Старт|Start)\s*(\d{2}:\d{2})\s*(?:часов\s*)?\(?(CET|CEST|MEZ|UTC)?\)?/i,
    );
    if (headerDateMatch) auctionEndDate = `${headerDateMatch[1]} ${headerDateMatch[2]} ${headerDateMatch[3] || 'CET'}`;

    // ===== LOT NUMBER =====
    let lotNumber = null;
    const lotNrMatch = bodyText.match(/(?:Номер в каталоге|Кат[\.\s]*(?:Nr|№))[:\s]*(\d+)/i);
    if (lotNrMatch) lotNumber = lotNrMatch[1];

    // ===== VAT TYPE =====
    const specs = {};
    getAll('table tr').forEach(row => {
      const cells = row.querySelectorAll('td, th');
      if (cells.length >= 2) {
        let label = cells[0]?.textContent?.trim()?.replace(/:+$/, '').trim();
        const value = cells[1]?.textContent?.trim();
        if (label && value && label.length < 80 && label !== value) specs[label] = value;
      }
    });
    const taxValue = specs['Налог'] || specs['Steuer'] || null;
    let vatType = null;
    if (taxValue) {
      vatType = taxValue.toLowerCase().includes('нетто') || taxValue.toLowerCase().includes('netto') ? 'netto' : 'brutto';
    }

    // ===== TITLE + SUMMARY =====
    let title = '';
    const docTitle = document.title || '';
    const titleClean = docTitle.replace(/\s*[-–|]\s*autobid\.de.*$/i, '').replace(/\s*[-–|]\s*Подробности.*$/i, '').trim();
    if (titleClean.length > 3) title = titleClean;

    let summaryLine = null;
    if (title) {
      const allText = bodyText.split('\n').map(l => l.trim()).filter(Boolean);
      for (let i = 0; i < allText.length; i++) {
        if (allText[i].includes(title.substring(0, 20))) {
          const next = allText[i + 1]?.trim();
          if (next && next.length > 10 && next.length < 200 &&
              (next.includes('литр') || next.includes('Liter') || next.includes('Дизель') || next.includes('Бензин') || next.includes('Автомат') || next.includes('кВт'))) {
            summaryLine = next;
          }
          break;
        }
      }
    }

    // ===== CATEGORIZED IMAGES (same logic as updated browser service) =====
    const findSectionContainer = (keywords) => {
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

    // Collect main gallery images (for the fallback)
    const imageUrls = [];
    const seenBaseUrls = new Set();
    const addCdnImage = (src) => {
      if (!src.includes('cdn.autobid.de')) return;
      if (src.includes('logo') || src.includes('icon')) return;
      if (vId && !src.includes(`/${vId}/`)) return;
      const baseUrl = src.replace(/_(?:xs|s|m|l)\.(jpg|jpeg|png|webp)/i, '_l.$1');
      if (!seenBaseUrls.has(baseUrl)) { seenBaseUrls.add(baseUrl); imageUrls.push(baseUrl); }
    };
    getAll('img').forEach(img => addCdnImage(img.src || img.getAttribute('data-src') || ''));

    // Now categorize: sections first, then gallery remainder
    const categorizedImages = [];
    const assignedUrls = new Set();

    const normalizeCdnUrl = (src) => {
      if (!src || src.startsWith('data:')) return null;
      try { src = new URL(src, window.location.href).href; } catch { return null; }
      if (src.includes('logo') || src.includes('icon')) return null;
      if (!src.includes('cdn.autobid.de')) return null;
      return src.replace(/_(?:xs|s|m|l)\.(jpg|jpeg|png|webp)/i, '_l.$1');
    };

    const collectFromSection = (keywords, category) => {
      const container = findSectionContainer(keywords);
      if (!container) return;
      container.querySelectorAll('img').forEach(img => {
        const rawSrc = img.src || img.getAttribute('data-src') || '';
        const url = normalizeCdnUrl(rawSrc);
        if (url && !assignedUrls.has(url)) {
          assignedUrls.add(url);
          categorizedImages.push({ url, category });
        }
      });
    };

    // 1) Damage first
    collectFromSection(['КУЗОВ', 'KAROSSERIE'], 'damage');
    collectFromSection(['ВМЯТИНА ОТ КАМНЕЙ', 'STEINSCHLAG'], 'damage');
    // 2) Interior
    collectFromSection(['ВИД НА ПРИБОРНУЮ ПАНЕЛЬ', 'ARMATURENBRETT'], 'interior');
    collectFromSection(['САЛОН', 'INNENRAUM'], 'damage');
    // 3) Exterior sections
    collectFromSection(['ОБЩИЕ ДОПОЛНИТЕЛЬНЫЕ ФОТОГРАФИИ'], 'exterior');
    collectFromSection(['ДЕТАЛИ', 'DETAILS'], 'exterior');
    collectFromSection(['ШИНЫ', 'REIFEN'], 'exterior');
    // 4) Remaining gallery → exterior
    imageUrls.forEach(url => {
      if (!assignedUrls.has(url)) {
        assignedUrls.add(url);
        categorizedImages.push({ url, category: 'exterior' });
      }
    });

    const counts = {};
    categorizedImages.forEach(img => { counts[img.category] = (counts[img.category] || 0) + 1; });

    return {
      title, auctionNumber, auctionEndDate, lotNumber, vatType, summaryLine,
      specsCount: Object.keys(specs).length,
      galleryTotal: imageUrls.length,
      imageCounts: counts,
      totalCategorized: categorizedImages.length,
    };
  }, vehicleId);

  console.log('=== NEW FIELDS + IMAGE CATEGORIZATION TEST ===\n');
  console.log(`  Title:          ${result.title}`);
  console.log(`  Auction Nr:     ${result.auctionNumber || '(not found)'}`);
  console.log(`  Auction Date:   ${result.auctionEndDate || '(not found)'}`);
  console.log(`  Lot Number:     ${result.lotNumber || '(not found)'}`);
  console.log(`  VAT Type:       ${result.vatType || '(not found)'}`);
  console.log(`  Summary Line:   ${result.summaryLine || '(not found)'}`);
  console.log(`  Specs:          ${result.specsCount}`);
  console.log(`  Gallery total:  ${result.galleryTotal} (all cdn images)`);
  console.log(`\n  Image categories: ${JSON.stringify(result.imageCounts)}`);
  console.log(`  Total categorized: ${result.totalCategorized}`);

  const ok = (cond, msg) => console.log(`  ${cond ? '✅' : '❌'} ${msg}`);
  console.log('\n=== VALIDATION ===');
  ok(result.auctionNumber, `Auction number: ${result.auctionNumber}`);
  ok(result.auctionEndDate, `Auction date: ${result.auctionEndDate}`);
  ok(result.lotNumber, `Lot number: ${result.lotNumber}`);
  ok(result.vatType, `VAT type: ${result.vatType}`);
  ok(result.summaryLine, `Summary line found`);
  ok((result.imageCounts.exterior || 0) > 0, `Exterior images: ${result.imageCounts.exterior || 0}`);
  ok((result.imageCounts.interior || 0) > 0, `Interior images: ${result.imageCounts.interior || 0}`);
  ok((result.imageCounts.damage || 0) > 0, `Damage images: ${result.imageCounts.damage || 0}`);

  await browser.close();
  console.log('\nDone!');
}

main().catch(console.error);
