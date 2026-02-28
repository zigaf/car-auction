const { chromium } = require('playwright');
const fs = require('fs');

(async () => {
    const browser = await chromium.launch({
        headless: true,
        args: ['--disable-blink-features=AutomationControlled']
    });

    const context = await browser.newContext({
        ignoreHTTPSErrors: true,
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        viewport: { width: 1920, height: 1080 }
    });

    const page = await context.newPage();

    try {
        await page.goto('https://ecarstrade.com/login', { waitUntil: 'domcontentloaded', timeout: 30000 });
        await page.waitForTimeout(3000);

        // Fill and submit
        await page.evaluate(({ email, pass }) => {
            const getVisible = (selectors) => {
                const els = Array.from(document.querySelectorAll(selectors));
                return els.find(el => el.offsetWidth > 0 && el.offsetHeight > 0);
            };
            const emailInput = getVisible('input[name="login"], input[type="email"]');
            if (emailInput) { emailInput.value = email; emailInput.dispatchEvent(new Event('input', { bubbles: true })); }
            const passInput = getVisible('input[name="pass"], input[type="password"]');
            if (passInput) { passInput.value = pass; passInput.dispatchEvent(new Event('input', { bubbles: true })); }
            const submitBtn = getVisible('input[type="submit"], button[type="submit"]');
            if (submitBtn) submitBtn.click();
        }, { email: 'zigaf321@gmail.com', pass: 'Fvgth2007@' });

        await page.waitForTimeout(5000);

        // Go to specific car URL
        console.log('Navigating to BMW X5...');
        await page.goto('https://ru.ecarstrade.com/cars/6380489', { waitUntil: 'domcontentloaded' });
        await page.waitForTimeout(5000);

        const carData = await page.evaluate(() => {
            const h1 = document.querySelector('h1')?.innerText?.trim();

            // Extract JSON-LD
            let jsonLd = null;
            const scriptElements = document.querySelectorAll('script[type="application/ld+json"]');
            scriptElements.forEach(s => {
                try {
                    const parsed = JSON.parse(s.innerHTML);
                    if (parsed['@type'] === 'Car' || parsed['@type'] === 'Product') {
                        jsonLd = parsed;
                    }
                } catch (e) { }
            });

            // Extract table/grid specs
            // Based on screenshot, "Профиль автомобиля" has a grid of items
            const specs = {};
            // Look for container with label and value
            const specItems = Array.from(document.querySelectorAll('.item_description_item, .spec-item, li, tr'));
            specItems.forEach(item => {
                const parts = item.innerText.split('\n').map(s => s.trim()).filter(s => s);
                // Attempt to grab key/value pairs
                if (parts.length >= 2) {
                    specs[parts[0]] = parts.slice(1).join(' ');
                } else if (item.children.length === 2) {
                    specs[item.children[0].innerText.trim()] = item.children[1].innerText.trim();
                } else if (parts.length === 1 && parts[0].includes(':')) {
                    const [k, v] = parts[0].split(':');
                    specs[k.trim()] = v.trim();
                }
            });

            // Let's also grab exact text of all `dd` and `dt`
            const dtElems = Array.from(document.querySelectorAll('dt')).map(e => e.innerText.trim());
            const ddElems = Array.from(document.querySelectorAll('dd')).map(e => e.innerText.trim());

            // Image extraction strategy
            // 1. srcset in pictures
            const pswpSources = Array.from(document.querySelectorAll('picture[data-pswp-srcset]'));
            let images = pswpSources.map(p => {
                const srcSet = p.getAttribute('data-pswp-srcset') || '';
                // The largest image usually ends with " 3x" or " 4x"
                const parts = srcSet.split(',').map(s => s.trim());
                if (parts.length > 0) {
                    let best = parts[parts.length - 1]; // get the highest resolution
                    best = best.split(' ')[0]; // remove the " 3x" part
                    if (best && best.startsWith('//')) best = 'https:' + best;
                    return best;
                }
                return null;
            }).filter(Boolean);

            if (images.length === 0) {
                // Try getting any image that looks like a car photo
                images = Array.from(document.querySelectorAll('img'))
                    .map(img => img.src || img.getAttribute('data-src'))
                    .filter(src => src && (src.includes('carsphotos') || src.includes('vehicles')))
                    .map(src => src.replace('/thumbnails', '')); // Try to get full resolution
            }

            // Clean up to remove duplicates
            images = [...new Set(images)];

            // Try to find the price
            const priceEl = document.querySelector('.price, [class*="price"], .amount, [class*="amount"]');
            const priceText = priceEl ? priceEl.innerText : null;

            // Let's look for the main content container specifically
            const carProfileSection = document.querySelector('.car-profile, .specs, .details, #specifications')?.innerText;

            return {
                title: h1,
                jsonLd,
                dt: dtElems,
                dd: ddElems,
                images: images.slice(0, 10), // Just top 10
                price: priceText,
                carProfileSection
            };
        });

        console.log('\n--- Car Data ---');
        console.log(JSON.stringify(carData, null, 2));

    } catch (error) {
        console.error('Test failed:', error);
    } finally {
        await browser.close();
    }
})();
