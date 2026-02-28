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
            // eCarsTrade car URLs usually look like /auctions/xx-xxxx/car-name-id
            return Array.from(new Set(links
                .map(a => a.href)
                .filter(href => href.includes('/auctions/') && href.split('/').length > 5)
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

            // Extract Data from SSR script tag
            // Sites like eCarsTrade often inject their React/Vue state in a script tag
            const ssrData = await this.page.evaluate(() => {
                let data = null;
                const scripts = Array.from(document.querySelectorAll('script'));
                for (const s of scripts) {
                    const text = s.textContent;
                    // Look for common window assignments or Vue initial state
                    if (text && text.includes('window.__INITIAL_STATE__')) {
                        try {
                            const match = text.match(/window\.__INITIAL_STATE__\s*=\s*(\{.*?\});/s);
                            if (match) data = JSON.parse(match[1]);
                        } catch (e) { }
                    }
                }

                // If no SSR data, we scrape the DOM
                const title = (document.querySelector('h1') as HTMLElement)?.innerText?.trim();
                const specsStr = Array.from(document.querySelectorAll('li, div')).map(e => (e as HTMLElement).innerText.trim()).join(' | ');

                // Collect images
                const images = Array.from(document.querySelectorAll('img')).map(img => img.src).filter(src => src.includes('http') && !src.includes('logo') && !src.includes('icon'));
                // Collect price
                const priceEl = Array.from(document.querySelectorAll('span, div')).find(el => (el as HTMLElement).innerText.includes('€') && el.children.length === 0);
                const price = priceEl ? (priceEl as HTMLElement).innerText : null;

                return { ssr: data, title, specsStr, images, price };
            });

            return ssrData;
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
