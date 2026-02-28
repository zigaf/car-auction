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

        await page.goto('https://ecarstrade.com/auctions/cars', { waitUntil: 'domcontentloaded' });
        await page.waitForTimeout(5000);

        const carsInDom = await page.evaluate(() => {
            // Find possible car cards
            const links = Array.from(document.querySelectorAll('a'));
            const carLinks = links.filter(a => a.href && (a.href.includes('/cars/') || a.href.includes('/auctions/')));

            const texts = [];
            const cards = Array.from(document.querySelectorAll('div.card, article, div[class*="vehicle"]'));

            for (let i = 0; i < Math.min(5, cards.length); i++) {
                const t = cards[i].innerText.replace(/\n/g, ' ').substring(0, 150);
                if (t.length > 20) texts.push(t);
            }
            return {
                carLinksCount: carLinks.length,
                carLinks: carLinks.map(a => a.href),
                cardsCount: cards.length,
                sampleTexts: texts
            };
        });

        console.log('\n--- DOM Analysis ---');
        console.log('Potenial Car Links:', carsInDom.carLinksCount);
        console.log('URLs:', carsInDom.carLinks.slice(0, 10)); // just look at first 10
        console.log('Cards:', carsInDom.cardsCount);
        console.log('Sample texts from cards:', carsInDom.sampleTexts);

        // Also extract raw JSON if there's any SSR state embedded in script tags (vue/react)
        const ssrState = await page.evaluate(() => {
            const scripts = Array.from(document.querySelectorAll('script'));
            for (const s of scripts) {
                if (s.innerHTML.includes('vehicles') || s.innerHTML.includes('auctions')) {
                    return true; // we found data
                }
            }
            return false;
        });
        console.log('SSR Data Found in script tags:', ssrState);

    } catch (error) {
        console.error('Test failed:', error);
    } finally {
        await browser.close();
    }
})();
