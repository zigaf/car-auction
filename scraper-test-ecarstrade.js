const { chromium } = require('playwright');
const fs = require('fs');

(async () => {
    console.log('Starting eCarsTrade test scraper...');

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

    // Listen for API responses
    const apiData = [];
    page.on('response', async (resp) => {
        const url = resp.url();
        if (url.includes('api') && (resp.request().resourceType() === 'fetch' || resp.request().resourceType() === 'xhr')) {
            try {
                const ct = resp.headers()['content-type'] || '';
                if (ct.includes('json')) {
                    const json = await resp.json();
                    apiData.push({
                        url,
                        status: resp.status(),
                        dataLength: JSON.stringify(json).length,
                        sample: json
                    });
                }
            } catch (e) { }
        }
    });

    try {
        console.log('Navigating to login page...');
        await page.goto('https://ecarstrade.com/login', { waitUntil: 'domcontentloaded', timeout: 30000 });
        await page.waitForTimeout(3000);

        // Cookie banners
        try {
            const cookieBtn = await page.$('button:has-text("Accept"), button:has-text("Принять")');
            if (cookieBtn) await cookieBtn.click({ force: true });
        } catch (e) { }

        console.log('Filling credentials via evaluate...');

        // Fill and click via DOM to bypass visibility checks
        await page.evaluate(({ email, pass }) => {
            // Find visible inputs
            const getVisible = (selectors) => {
                const els = Array.from(document.querySelectorAll(selectors));
                return els.find(el => el.offsetWidth > 0 && el.offsetHeight > 0);
            };

            const emailInput = getVisible('input[name="login"], input[type="email"]');
            if (emailInput) {
                emailInput.value = email;
                emailInput.dispatchEvent(new Event('input', { bubbles: true }));
                emailInput.dispatchEvent(new Event('change', { bubbles: true }));
            }

            const passInput = getVisible('input[name="pass"], input[type="password"]');
            if (passInput) {
                passInput.value = pass;
                passInput.dispatchEvent(new Event('input', { bubbles: true }));
                passInput.dispatchEvent(new Event('change', { bubbles: true }));
            }

            const submitBtn = getVisible('input[type="submit"], button[type="submit"]');
            if (submitBtn) {
                submitBtn.click();
            }
        }, { email: 'zigaf321@gmail.com', pass: 'Fvgth2007@' });

        console.log('Login attempt done. Wait 8s...');
        await page.waitForTimeout(8000);

        await page.screenshot({ path: 'test-after-login.png', fullPage: true });

        console.log('Navigating to auctions...');
        await page.goto('https://ecarstrade.com/auctions/cars', { waitUntil: 'domcontentloaded' });
        await page.waitForTimeout(10000); // 10 sec to let APIs resolve

        console.log(`\nCaptured ${apiData.length} JSON API responses`);

        const vehicleApis = apiData.filter(d =>
            d.url.toLowerCase().includes('vehicle') ||
            d.url.toLowerCase().includes('auction') ||
            d.url.toLowerCase().includes('car') ||
            d.url.toLowerCase().includes('search') ||
            d.url.toLowerCase().includes('list')
        );

        console.log(`Of which ${vehicleApis.length} look relevant based on URL.`);

        if (vehicleApis.length > 0) {
            const bestApi = vehicleApis.sort((a, b) => b.dataLength - a.dataLength)[0];
            console.log('\nLargest API response URL:', bestApi.url);

            fs.writeFileSync('ecars-api-sample.json', JSON.stringify(bestApi.sample, null, 2));
            console.log('Saved full payload to ecars-api-sample.json');

            // Print sample
            if (typeof bestApi.sample === 'object') {
                let carsArray = null;
                if (Array.isArray(bestApi.sample)) {
                    carsArray = bestApi.sample;
                } else {
                    for (const key of Object.keys(bestApi.sample)) {
                        if (Array.isArray(bestApi.sample[key]) && bestApi.sample[key].length > 0) {
                            carsArray = bestApi.sample[key];
                            break;
                        }
                    }
                }

                if (carsArray && carsArray.length > 0) {
                    console.log(`Found an array of ${carsArray.length} items.`);
                    console.log('First item details keys:', Object.keys(carsArray[0]).slice(0, 15).join(', '));
                }
            }
        }
    } catch (error) {
        console.error('Test failed:', error);
    } finally {
        await browser.close();
    }
})();
