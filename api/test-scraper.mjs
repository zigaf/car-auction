import { chromium } from 'playwright';

const url = 'https://autobid.de/ru/rezultaty-poiska?e367=1&sortingType=auctionStartDate-ASCENDING&carList-category=1;2&carList-category=1;1&carList-category=1;77&carList-category=1;17&carList-category=1;33&carList-category=1;6&carList-category=1;608&carList-category=1;34&carList-category=1;3';

async function main() {
  console.log('Launching browser...');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    locale: 'ru-RU',
    viewport: { width: 1920, height: 1080 },
  });
  const page = await context.newPage();

  console.log('Navigating to search page...');
  const resp = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
  console.log(`Status: ${resp?.status()}`);

  console.log('Waiting for networkidle...');
  await page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => console.log('networkidle timeout'));

  // Cookie consent
  const cookieBtn = await page.$('#onetrust-accept-btn-handler');
  if (cookieBtn) {
    await cookieBtn.click();
    console.log('Cookie consent accepted');
    await page.waitForTimeout(2000);
  }

  console.log('Waiting 10s for SPA render...');
  await page.waitForTimeout(10000);

  // Dump page info
  const info = await page.evaluate(() => {
    const body = document.body;
    const allLinks = Array.from(document.querySelectorAll('a')).map(a => ({
      href: a.href,
      text: a.textContent?.trim()?.substring(0, 80)
    }));
    const elementLinks = allLinks.filter(l => l.href.includes('/element/'));
    const allImages = Array.from(document.querySelectorAll('img')).map(img => ({
      src: img.src?.substring(0, 120),
      alt: img.alt?.substring(0, 60),
      w: img.naturalWidth, h: img.naturalHeight
    }));

    // Dump some divs structure
    const bodyChildren = Array.from(body?.children || []).map(el => ({
      tag: el.tagName,
      id: el.id,
      classes: el.className?.substring?.(0, 100) || '',
      childCount: el.children.length,
      textPreview: el.textContent?.trim()?.substring(0, 200)
    }));

    return {
      title: document.title,
      bodyText: body?.innerText?.substring(0, 3000) || '(empty)',
      linkCount: allLinks.length,
      elementLinkCount: elementLinks.length,
      elementLinks: elementLinks.slice(0, 10),
      imageCount: allImages.length,
      images: allImages.slice(0, 10),
      bodyChildren: bodyChildren.slice(0, 10),
      html: document.documentElement.outerHTML.substring(0, 2000),
    };
  });

  console.log('\n=== PAGE TITLE ===');
  console.log(info.title);

  console.log('\n=== BODY TEXT (first 2000) ===');
  console.log(info.bodyText.substring(0, 2000));

  console.log('\n=== LINKS ===');
  console.log(`Total links: ${info.linkCount}, Element links: ${info.elementLinkCount}`);
  if (info.elementLinks.length > 0) {
    console.log('Element links:');
    info.elementLinks.forEach(l => console.log(`  ${l.href} -> ${l.text}`));
  }

  console.log('\n=== IMAGES ===');
  console.log(`Total images: ${info.imageCount}`);
  info.images.forEach(img => console.log(`  ${img.src} (${img.w}x${img.h}) alt="${img.alt}"`));

  console.log('\n=== BODY STRUCTURE ===');
  info.bodyChildren.forEach(c => console.log(`  <${c.tag} id="${c.id}" class="${c.classes}"> children=${c.childCount}`));

  console.log('\n=== HTML HEAD (first 2000) ===');
  console.log(info.html.substring(0, 2000));

  // Save screenshot
  await page.screenshot({ path: '/Users/maksnalyvaiko/personal/car-auction/api/test-screenshot.png', fullPage: false });
  console.log('\nScreenshot saved to test-screenshot.png');

  await browser.close();
}

main().catch(console.error);
