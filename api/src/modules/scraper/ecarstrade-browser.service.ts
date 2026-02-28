import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { AutobidVehicleDetail } from './interfaces/autobid-vehicle.interface';

@Injectable()
export class EcarsTradeBrowserService implements OnModuleDestroy {
    private browser: any = null;
    private context: any = null;
    private page: any = null;
    private readonly logger = new Logger(EcarsTradeBrowserService.name);
    private readonly sessionPath = path.join(process.cwd(), 'ecarstrade-session.json');
    private logEmitter: (msg: string) => void = () => { };

    setLogEmitter(emitter: (msg: string) => void) {
        this.logEmitter = emitter;
    }

    private log(message: string) {
        this.logger.log(message);
        this.logEmitter(`[eCarsTrade] ${message}`);
    }

    private async getPlaywright() {
        try {
            return await import('playwright');
        } catch {
            throw new Error('Playwright is not installed. Run: npm install playwright');
        }
    }

    async initialize(): Promise<void> {
        const { chromium } = await this.getPlaywright();

        this.log('Launching browser for eCarsTrade...');
        this.browser = await chromium.launch({
            headless: true,
            args: [
                '--disable-blink-features=AutomationControlled',
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-gpu',
            ]
        });

        // Check if we have an existing session
        let storageState = undefined;
        if (fs.existsSync(this.sessionPath)) {
            this.log('Found existing session. Attempting to restore...');
            storageState = this.sessionPath;
        }

        this.context = await this.browser.newContext({
            ignoreHTTPSErrors: true,
            userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
            locale: 'en-US',
            viewport: { width: 1920, height: 1080 },
            storageState
        });

        this.page = await this.context.newPage();

        // Ensure we are logged in
        await this.ensureLogin();
    }

    private async ensureLogin(): Promise<void> {
        this.log('Verifying login status...');
        await this.page.goto('https://ecarstrade.com/auctions/cars', { waitUntil: 'domcontentloaded', timeout: 30000 });

        // Check if we got redirected to login
        if (this.page.url().includes('login')) {
            this.log('Not logged in. Performing login...');
            await this.performLogin();
        } else {
            // Check for elements that verify we are authenticated (e.g. My Account link)
            const isLoggedIn = await this.page.evaluate(() => {
                return document.documentElement.innerHTML.includes('logout') ||
                    document.documentElement.innerHTML.includes('/cabinet');
            });

            if (!isLoggedIn) {
                this.log('Session seems invalid. Performing login...');
                await this.performLogin();
            } else {
                this.log('Successfully restored session.');
            }
        }
    }

    private async performLogin(): Promise<void> {
        const email = process.env.ECARSTRADE_EMAIL || 'zigaf321@gmail.com';
        const pass = process.env.ECARSTRADE_PASSWORD || 'Fvgth2007@';

        await this.page.goto('https://ecarstrade.com/login', { waitUntil: 'domcontentloaded', timeout: 30000 });
        await this.page.waitForTimeout(3000);

        // Accept cookies if present
        try {
            const cookieBtn = await this.page.$('button:has-text("Accept"), button:has-text("Принять")');
            if (cookieBtn) await cookieBtn.click({ force: true });
        } catch (e) { }

        this.log('Filling login credentials...');

        // Fill and click via evaluate to bypass visibility issues
        await this.page.evaluate(({ e, p }: { e: string; p: string }) => {
            const getVisible = (selectors: string) => {
                const els = Array.from(document.querySelectorAll(selectors)) as HTMLElement[];
                return els.find(el => el.offsetWidth > 0 && el.offsetHeight > 0);
            };
            const emailInput = getVisible('input[name="login"], input[type="email"]') as HTMLInputElement;
            if (emailInput) { emailInput.value = e; emailInput.dispatchEvent(new Event('input', { bubbles: true })); }

            const passInput = getVisible('input[name="pass"], input[type="password"]') as HTMLInputElement;
            if (passInput) { passInput.value = p; passInput.dispatchEvent(new Event('input', { bubbles: true })); }

            const submitBtn = getVisible('input[type="submit"], button[type="submit"]');
            if (submitBtn) submitBtn.click();
        }, { e: email, p: pass });

        this.log('Waiting for login to complete...');
        await this.page.waitForTimeout(5000);

        // Save session state
        await this.context.storageState({ path: this.sessionPath });
        this.log('Session saved successfully.');
    }

    async getLiveAuctions(): Promise<any[]> {
        if (!this.page) throw new Error('Browser not initialized');

        this.log('Navigating to Open Auctions list...');
        await this.page.goto('https://ecarstrade.com/auctions/cars', { waitUntil: 'domcontentloaded', timeout: 60000 });
        await this.page.waitForTimeout(5000); // Allow DOM to build

        this.log('Extracting vehicle URLs from page...');
        // We will extract the URLs of the cars to scrape their detail pages
        const carLinks = await this.page.evaluate(() => {
            const links = Array.from(document.querySelectorAll('a'));
            // eCarsTrade car URLs visually look like /cars/1234567
            return Array.from(new Set(links
                .map(a => a.href)
                .filter(href => href && /\/cars\/\d+/.test(href))
            ));
        });

        this.log(`Found ${carLinks.length} potential car links in DOM.`);
        return carLinks;
    }

    async scrapeVehicleDetail(url: string, vehicleId?: string): Promise<any> {
        if (!this.page) throw new Error('Browser not initialized');
        this.log(`Scraping detail page: ${url}`);

        try {
            await this.page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });
            await this.page.waitForTimeout(3000);

            // Extract Data from JSON-LD and DOM
            const extractedData = await this.page.evaluate(() => {
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

                const title = document.querySelector('h1')?.innerText?.trim();

                // Image extraction
                const pswpSources = Array.from(document.querySelectorAll('picture[data-pswp-srcset]'));
                let images = pswpSources.map(p => {
                    const srcSet = p.getAttribute('data-pswp-srcset') || '';
                    const parts = srcSet.split(',').map(s => s.trim());
                    if (parts.length > 0) {
                        let best = parts[parts.length - 1]; // get the highest resolution
                        best = best.split(' ')[0];
                        if (best && best.startsWith('//')) best = 'https:' + best;
                        return best;
                    }
                    return null;
                }).filter(Boolean);

                if (images.length === 0) {
                    images = Array.from(document.querySelectorAll('img'))
                        .map(img => img.src || img.getAttribute('data-src'))
                        .filter(src => src && (src.includes('carsphotos') || src.includes('vehicles')))
                        .map(src => (src ? src.replace('/thumbnails', '') : null));
                }
                images = [...new Set(images)];

                // Gather table/grid specs for manual parsing if JSON-LD is missing
                const specs: Record<string, string> = {};
                const specItems = Array.from(document.querySelectorAll('.item_description_item, .spec-item, li, tr'));
                specItems.forEach(item => {
                    const parts = (item as HTMLElement).innerText.split('\\n').map(s => s.trim()).filter(s => s);
                    if (parts.length >= 2) {
                        specs[parts[0]] = parts.slice(1).join(' ');
                    } else if (item.children.length === 2) {
                        specs[(item.children[0] as HTMLElement).innerText.trim()] = (item.children[1] as HTMLElement).innerText.trim();
                    }
                });

                // Extract price
                const priceEl = document.querySelector('.price, [class*="price"], .amount, [class*="amount"]');
                const priceText = priceEl ? (priceEl as HTMLElement).innerText : null;

                return { jsonLd, title, images, specs, price: priceText };
            });

            return extractedData;
        } catch (error) {
            this.log(`Failed to scrape ${url}: ${error.message}`);
            return null;
        }
    }

    async destroy(): Promise<void> {
        if (this.context) {
            this.log('Saving session state before exit...');
            await this.context.storageState({ path: this.sessionPath }).catch(() => { });
        }
        if (this.browser) {
            await this.browser.close();
            this.log('Browser closed.');
        }
        this.browser = null;
        this.context = null;
        this.page = null;
    }

    async onModuleDestroy() {
        await this.destroy();
    }
}
