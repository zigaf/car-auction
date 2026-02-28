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

        // Check if we have an error message on the login form
        const loginError = await page.evaluate(() => {
            const errAlert = document.querySelector('.alert-danger, .error-message, [class*="error"]');
            return errAlert ? errAlert.innerText : null;
        });
        console.log('Login Error Message (if any):', loginError);

        // Go to specific car URL
        console.log('Navigating to specific car...');
        await page.goto('https://ecarstrade.com/cars/6921528', { waitUntil: 'domcontentloaded' });
        await page.waitForTimeout(5000);

        const carData = await page.evaluate(() => {
            const h1 = document.querySelector('h1')?.innerText?.trim();
            // Try to find images in the slider
            const imgs = Array.from(document.querySelectorAll('img'))
                .map(img => img.src)
                .filter(src => src.includes('http') && !src.includes('logo') && !src.includes('icon'));

            // Try to find the price
            const priceEl = document.querySelector('.price, [class*="price"], .amount, [class*="amount"]');
            const priceText = priceEl ? priceEl.innerText : null;

            // Try to find specs/details
            const details = {};
            const dtElems = Array.from(document.querySelectorAll('dt, .label, [class*="label"]'));
            const ddElems = Array.from(document.querySelectorAll('dd, .value, [class*="value"]'));

            // Alternatively, they might use flex rows or lists
            const listItems = Array.from(document.querySelectorAll('li, .list-item'));
            const listTexts = listItems.map(li => li.innerText.trim()).filter(t => t.length > 0 && t.length < 100);

            return {
                title: h1,
                images: imgs.slice(0, 5), // Just top 5
                price: priceText,
                listTexts: listTexts.slice(0, 15),
            };
        });

        console.log('\n--- Car Data ---');
        console.log(JSON.stringify(carData, null, 2));

        const html = await page.content();
        fs.writeFileSync('ecars-car.html', html);

    } catch (error) {
        console.error('Test failed:', error);
    } finally {
        await browser.close();
    }
})();
