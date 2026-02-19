import { chromium } from 'playwright';

/**
 * Take multiple screenshots scrolling down the autobid detail page
 * to see all photo sections (dashboard, details, body, interior, etc.)
 * Run: node test-scroll-screenshots.mjs
 */

const detailUrl = 'https://autobid.de/ru/element/vw-caddy-maxi-2-0-tdi-bmt-dsg-comfortline-3308170/podrobnosti';

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
      await cookieBtn.click();
      console.log('Cookie accepted');
      await page.waitForTimeout(2000);
    }
    for (const text of ['Продолжить в любом случае', 'Continue anyway', 'Trotzdem fortfahren']) {
      try {
        const btn = await page.$(`text=${text}`);
        if (btn && await btn.isVisible().catch(() => false)) {
          await btn.click();
          console.log(`Browser warning dismissed: "${text}"`);
          await page.waitForTimeout(3000);
        }
      } catch {}
    }
    await page.waitForTimeout(2000);
  }

  await page.waitForTimeout(5000);

  // Scroll entire page to trigger lazy content
  await page.evaluate(async () => {
    let pos = 0;
    while (pos < document.body.scrollHeight) {
      window.scrollTo(0, pos);
      pos += 500;
      await new Promise(r => setTimeout(r, 200));
    }
    window.scrollTo(0, 0);
  });
  await page.waitForTimeout(3000);

  // Get page height
  const pageHeight = await page.evaluate(() => document.body.scrollHeight);
  console.log(`Page height: ${pageHeight}px`);

  // Take screenshots at different scroll positions
  const viewportHeight = 1080;
  const positions = [];
  for (let y = 0; y < pageHeight; y += viewportHeight) {
    positions.push(y);
  }

  for (let i = 0; i < positions.length; i++) {
    await page.evaluate((y) => window.scrollTo(0, y), positions[i]);
    await page.waitForTimeout(500);
    const filename = `detail-scroll-${i}.png`;
    await page.screenshot({ path: filename, fullPage: false });
    console.log(`Saved: ${filename} (y=${positions[i]})`);
  }

  // Also dump section headers with their Y positions
  const sections = await page.evaluate(() => {
    const headers = Array.from(document.querySelectorAll('header'));
    return headers.map(h => {
      const rect = h.getBoundingClientRect();
      const scrollY = window.scrollY || 0;
      return {
        text: h.textContent?.trim()?.substring(0, 80),
        y: Math.round(rect.top + scrollY),
      };
    }).filter(s => s.text && s.text.length > 2);
  });

  console.log('\n=== SECTION POSITIONS ===');
  sections.forEach(s => console.log(`  y=${s.y}: ${s.text}`));

  // Count images in each section
  const imageCounts = await page.evaluate(() => {
    const getAll = (sel) => Array.from(document.querySelectorAll(sel));
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

    const sectionNames = [
      ['ВИД НА ПРИБОРНУЮ ПАНЕЛЬ', 'ARMATURENBRETT'],
      ['ОБЩИЕ ДОПОЛНИТЕЛЬНЫЕ ФОТОГРАФИИ'],
      ['ДЕТАЛИ', 'DETAILS'],
      ['КУЗОВ', 'KAROSSERIE'],
      ['САЛОН', 'INNENRAUM'],
      ['ВМЯТИНА ОТ КАМНЕЙ', 'STEINSCHLAG'],
      ['ШИНЫ', 'REIFEN'],
    ];

    const results = {};
    for (const keywords of sectionNames) {
      const container = findSectionContainer(keywords);
      if (!container) {
        results[keywords[0]] = { found: false, imgCount: 0 };
        continue;
      }
      const imgs = container.querySelectorAll('img');
      const cdnImgs = Array.from(imgs).filter(img => {
        const src = img.src || '';
        return src.includes('cdn.autobid.de') && !src.includes('logo') && !src.includes('icon');
      });
      results[keywords[0]] = {
        found: true,
        imgCount: imgs.length,
        cdnImgCount: cdnImgs.length,
        sampleSrc: cdnImgs.length > 0 ? cdnImgs[0].src.substring(0, 100) : null,
      };
    }
    return results;
  });

  console.log('\n=== IMAGE COUNTS PER SECTION ===');
  Object.entries(imageCounts).forEach(([section, data]) => {
    const d = data;
    if (!d.found) {
      console.log(`  ❌ ${section}: NOT FOUND`);
    } else {
      console.log(`  ✅ ${section}: ${d.cdnImgCount} cdn images (${d.imgCount} total)`);
      if (d.sampleSrc) console.log(`     Sample: ${d.sampleSrc}`);
    }
  });

  await browser.close();
  console.log('\nDone!');
}

main().catch(console.error);
