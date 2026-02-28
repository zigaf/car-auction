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
        await page.waitForTimeout(5000); // 5 sec to let JS render

        // Dump the body HTML to a file so we can inspect it
        const html = await page.content();
        fs.writeFileSync('ecars-login.html', html);

        // Check if there are inputs
        const inputs = await page.evaluate(() => {
            return Array.from(document.querySelectorAll('input')).map(i => ({
                id: i.id,
                name: i.name,
                type: i.type,
                class: i.className,
                placeholder: i.placeholder
            }));
        });
        console.log('Inputs found:', inputs);

    } catch (error) {
        console.error('Test failed:', error);
    } finally {
        await browser.close();
    }
})();
