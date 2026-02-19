import { chromium } from 'playwright';

/**
 * Inspect autobid detail page — take screenshots and dump all text.
 * Run: node test-detail-inspect.mjs
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

  console.log(`Navigating to: ${detailUrl}\n`);
  await page.goto(detailUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => {});

  // Dismiss overlays
  const cookieBtn = await page.$('#onetrust-accept-btn-handler');
  if (cookieBtn) { await cookieBtn.click(); console.log('Cookie accepted'); await page.waitForTimeout(2000); }
  const continueBtn = await page.$('text=Продолжить в любом случае');
  if (continueBtn) { await continueBtn.click(); console.log('Browser warning dismissed'); await page.waitForTimeout(3000); }

  await page.waitForTimeout(5000);

  // Screenshot top of page
  await page.screenshot({ path: 'detail-top.png', fullPage: false });
  console.log('Saved: detail-top.png');

  // Scroll down and take full page screenshot
  await page.evaluate(async () => {
    let pos = 0;
    while (pos < document.body.scrollHeight) { window.scrollTo(0, pos); pos += 500; await new Promise(r => setTimeout(r, 200)); }
    window.scrollTo(0, 0);
  });
  await page.waitForTimeout(3000);

  await page.screenshot({ path: 'detail-full.png', fullPage: true });
  console.log('Saved: detail-full.png');

  // Dump ALL text content from the page, section by section
  const pageData = await page.evaluate(() => {
    const getAll = (sel) => Array.from(document.querySelectorAll(sel));

    // Get full body text
    const fullText = document.body?.innerText || '';

    // Find all headers (section titles)
    const headers = getAll('header');
    const sectionTitles = headers.map(h => h.textContent?.trim()).filter(Boolean);

    // Find all table data
    const tables = [];
    getAll('table').forEach((table, idx) => {
      const rows = [];
      table.querySelectorAll('tr').forEach(row => {
        const cells = Array.from(row.querySelectorAll('td, th')).map(c => c.textContent?.trim());
        if (cells.some(c => c && c.length > 0)) rows.push(cells);
      });
      if (rows.length > 0) tables.push({ index: idx, rows });
    });

    // Look for specific patterns we need
    const patterns = {
      // Кат.Nr patterns
      katNr: fullText.match(/Кат[\.\s]*(?:Nr|№|номер)[:\s]*(\d+)/i)?.[1] || null,
      catNr: fullText.match(/Cat[\.\s]*(?:Nr|No)[:\s]*(\d+)/i)?.[1] || null,
      // Auction number
      auctionNr: fullText.match(/(?:Номер аукциона|Auktionsnummer|Auction\s*(?:number|nr))[:\s]*(\d+)/i)?.[1] || null,
      // VAT type
      vatType: fullText.match(/(нетто|брутто|netto|brutto)/i)?.[1] || null,
      // Auction end date
      auctionEnd: fullText.match(/(?:Аукцион|Окончание|Auction|Ende|Endet|Срок)[:\s]*([\w\s\d.,:-]+(?:CET|CEST|UTC|MEZ))/i)?.[1] || null,
      auctionEndAlt: fullText.match(/D-\d+\s*(\d{2}\.\d{2}\.\d{4}\s+\d{2}:\d{2})/)?.[1] || null,
      // Grade patterns
      cosmeticGrade: fullText.match(/(?:Косметическ|Cosmetic|Optisch|Zustand)[:\s]*([\d.]+|[A-Z])/i)?.[1] || null,
      mechanicalGrade: fullText.match(/(?:Механическ|Mechanical|Technisch)[:\s]*([\d.]+|[A-Z])/i)?.[1] || null,
      // Sale info
      saleLocation: fullText.match(/(?:Место\s*(?:проведения|продажи)|Verkaufsort|Sale\s*location)[:\s]*([^\n]+)/i)?.[1] || null,
      saleName: fullText.match(/(?:Название\s*аукциона|Auktionsname|Sale\s*name)[:\s]*([^\n]+)/i)?.[1] || null,
    };

    // Dump ALL visible text blocks that might contain our data
    const rightSidebar = [];
    // Look for elements containing auction/lot metadata (typically right side panel)
    getAll('div, span, p, td').forEach(el => {
      const t = el.textContent?.trim() || '';
      if (t.length > 3 && t.length < 200 && el.children.length <= 2) {
        if (
          t.includes('Кат') || t.includes('Cat') ||
          t.includes('аукцион') || t.includes('Auktion') || t.includes('Auction') ||
          t.includes('нетто') || t.includes('брутто') || t.includes('netto') || t.includes('brutto') ||
          t.includes('Номер') || t.includes('Nummer') || t.includes('Number') ||
          t.includes('D-') ||
          t.includes('CET') || t.includes('часов') ||
          t.includes('Срок') || t.includes('Ende') ||
          t.includes('Место') || t.includes('Standort') ||
          t.includes('оценк') || t.includes('Grad') || t.includes('Grade') ||
          t.includes('€')
        ) {
          rightSidebar.push(t);
        }
      }
    });

    return { fullText, sectionTitles, tables, patterns, rightSidebar };
  });

  console.log('\n========== SECTION TITLES ==========');
  pageData.sectionTitles.forEach(t => console.log(`  [SECTION] ${t}`));

  console.log('\n========== PATTERN MATCHES ==========');
  Object.entries(pageData.patterns).forEach(([key, val]) => {
    console.log(`  ${key}: ${val || '(not found)'}`);
  });

  console.log('\n========== RELEVANT TEXT BLOCKS ==========');
  // Deduplicate
  const unique = [...new Set(pageData.rightSidebar)];
  unique.forEach(t => console.log(`  > ${t}`));

  console.log('\n========== ALL TABLES ==========');
  pageData.tables.forEach(table => {
    console.log(`\n  --- Table #${table.index} (${table.rows.length} rows) ---`);
    table.rows.forEach(row => console.log(`    ${row.join(' | ')}`));
  });

  console.log('\n========== FULL PAGE TEXT (first 5000 chars) ==========');
  console.log(pageData.fullText.substring(0, 5000));

  await browser.close();
  console.log('\nDone!');
}

main().catch(console.error);
