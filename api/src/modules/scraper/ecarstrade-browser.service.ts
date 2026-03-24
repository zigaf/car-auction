import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';

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

        let storageState = undefined;
        if (fs.existsSync(this.sessionPath)) {
            this.log('Found existing session. Attempting to restore...');
            storageState = this.sessionPath;
        }

        this.context = await this.browser.newContext({
            ignoreHTTPSErrors: true,
            userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
            locale: 'ru-RU',
            viewport: { width: 1920, height: 1080 },
            storageState
        });

        this.page = await this.context.newPage();
        await this.ensureLogin();
    }

    private async ensureLogin(): Promise<void> {
        this.log('Verifying login status...');
        await this.page.goto('https://ecarstrade.com/search', { waitUntil: 'domcontentloaded', timeout: 30000 });

        if (this.page.url().includes('login')) {
            this.log('Not logged in. Performing login...');
            await this.performLogin();
        } else {
            const isLoggedIn = await this.page.evaluate(() => {
                return document.documentElement.innerHTML.includes('logout') ||
                    document.documentElement.innerHTML.includes('/cabinet') ||
                    document.documentElement.innerHTML.includes('Личная Страница');
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

        try {
            const cookieBtn = await this.page.$('button:has-text("Accept"), button:has-text("Reject"), button:has-text("Принять")');
            if (cookieBtn) await cookieBtn.click({ force: true });
        } catch (e) { }

        this.log('Filling login credentials...');

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

        await this.context.storageState({ path: this.sessionPath });
        this.log('Session saved successfully.');
    }

    async getSearchPage(pageNumber: number): Promise<{ carLinks: string[]; totalPages: number }> {
        if (!this.page) throw new Error('Browser not initialized');

        this.log(`Navigating to search page ${pageNumber}...`);
        await this.page.goto(`https://ecarstrade.com/search?page=${pageNumber}`, {
            waitUntil: 'domcontentloaded',
            timeout: 60000,
        });
        await this.page.waitForTimeout(5000);

        // Close any modals that might appear
        try {
            const laterBtn = await this.page.$('button:has-text("Позже"), button:has-text("Later"), button:has-text("Close")');
            if (laterBtn) await laterBtn.click({ force: true });
        } catch (e) { }

        const result = await this.page.evaluate(() => {
            const links = Array.from(document.querySelectorAll('a'));
            const carLinks = Array.from(new Set(
                links
                    .map(a => a.href)
                    .filter(href => href && /\/cars\/\d+/.test(href))
            ));

            // Extract total pages from pagination
            let totalPages = 1;
            const paginationLinks = Array.from(document.querySelectorAll('.pagination a, [class*="pagination"] a, nav a'));
            for (const link of paginationLinks) {
                const text = (link as HTMLElement).innerText.trim();
                const num = parseInt(text, 10);
                if (!isNaN(num) && num > totalPages) {
                    totalPages = num;
                }
            }

            // Fallback: look for "last page" link
            if (totalPages <= 1) {
                const lastLink = document.querySelector('.pagination li:last-child a, [class*="pagination"] a:last-child');
                if (lastLink) {
                    const href = (lastLink as HTMLAnchorElement).href || '';
                    const pageMatch = href.match(/page=(\d+)/);
                    if (pageMatch) totalPages = parseInt(pageMatch[1], 10);
                }
            }

            // Fallback: count from text like "РЕЗУЛЬТАТЫ ПОИСКА (5757 АВТО)"
            if (totalPages <= 1) {
                const headerText = document.body.innerText;
                const countMatch = headerText.match(/(\d[\d\s]*)\s*(?:АВТО|авто|cars|results)/i);
                if (countMatch) {
                    const total = parseInt(countMatch[1].replace(/\s/g, ''), 10);
                    if (total > 0) totalPages = Math.ceil(total / 20);
                }
            }

            return { carLinks, totalPages };
        });

        this.log(`Page ${pageNumber}: found ${result.carLinks.length} car links, totalPages=${result.totalPages}`);
        return result;
    }

    async scrapeVehicleDetail(url: string, vehicleId?: string): Promise<any> {
        if (!this.page) throw new Error('Browser not initialized');
        this.log(`Scraping detail page: ${url}`);

        try {
            await this.page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });
            await this.page.waitForTimeout(3000);

            // Close any modals
            try {
                const laterBtn = await this.page.$('button:has-text("Позже"), button:has-text("Later")');
                if (laterBtn) await laterBtn.click({ force: true });
            } catch (e) { }

            const extractedData = await this.page.evaluate(() => {
                // --- JSON-LD ---
                let jsonLd: any = null;
                document.querySelectorAll('script[type="application/ld+json"]').forEach(s => {
                    try {
                        const parsed = JSON.parse(s.innerHTML);
                        if (parsed['@type'] === 'Car' || parsed['@type'] === 'Product') jsonLd = parsed;
                    } catch (e) { }
                });

                // --- Title ---
                const title = document.querySelector('h1')?.innerText?.trim() || null;

                // --- Images ---
                const pswpSources = Array.from(document.querySelectorAll('picture[data-pswp-srcset]'));
                let images: string[] = pswpSources.map(p => {
                    const srcSet = p.getAttribute('data-pswp-srcset') || '';
                    const parts = srcSet.split(',').map(s => s.trim());
                    if (parts.length > 0) {
                        let best = parts[parts.length - 1].split(' ')[0];
                        if (best && best.startsWith('//')) best = 'https:' + best;
                        return best;
                    }
                    return '';
                }).filter(Boolean);

                if (images.length === 0) {
                    images = Array.from(document.querySelectorAll('img'))
                        .map(img => img.src || img.getAttribute('data-src') || '')
                        .filter(src => src.includes('carsphotos') || src.includes('vehicles'))
                        .map(src => src.replace('/thumbnails', ''));
                }
                images = [...new Set(images)];

                // --- Vehicle Profile (text-based extraction) ---
                const allText = document.body.innerText;
                const specs: Record<string, string> = {};

                // Known spec labels (RU + EN)
                const knownLabels = [
                    'Марка и модель', 'Тип коробки передач', 'Коробка передач',
                    'Пробег', 'Категория', 'Объем двигателя', 'Мощность', 'Мест',
                    'Номер блока', 'Страна производства', 'Дата первой регистрации',
                    'Дверей', 'Тип топлива', 'Класс эмиссии', 'CO₂', 'Цвет', 'VIN',
                    'Make and model', 'Transmission type', 'Gearbox', 'Mileage',
                    'Category', 'Engine capacity', 'Power', 'Seats', 'Block number',
                    'Country of production', 'First registration date', 'Doors',
                    'Fuel type', 'Emission class', 'Color', 'Colour',
                ];

                // Strategy 1: Find profile section and parse label-value pairs
                const profileHeaders = ['Профиль автомобиля', 'Car profile', 'Vehicle profile'];
                const remarkHeaders = ['Важные замечания', 'Important remarks'];
                let profileStart = -1;
                for (const h of profileHeaders) {
                    const idx = allText.indexOf(h);
                    if (idx > -1) { profileStart = idx; break; }
                }
                let profileEnd = allText.length;
                for (const h of remarkHeaders) {
                    const idx = allText.indexOf(h, profileStart > -1 ? profileStart : 0);
                    if (idx > -1 && idx < profileEnd) profileEnd = idx;
                }

                if (profileStart > -1) {
                    const profileText = allText.substring(profileStart, profileEnd);
                    const lines = profileText.split('\n').map(l => l.trim()).filter(Boolean);

                    for (let i = 0; i < lines.length; i++) {
                        const line = lines[i];
                        const matchedLabel = knownLabels.find(l => line === l || line.startsWith(l));
                        if (matchedLabel) {
                            const afterLabel = line.substring(matchedLabel.length).trim();
                            if (afterLabel) {
                                specs[matchedLabel] = afterLabel;
                            } else if (i + 1 < lines.length) {
                                const nextLine = lines[i + 1];
                                if (!knownLabels.some(l => nextLine === l || nextLine.startsWith(l))) {
                                    specs[matchedLabel] = nextLine;
                                    i++;
                                }
                            }
                        }
                    }
                }

                // Strategy 2: DOM-based — find elements with exactly 2 child spans
                if (Object.keys(specs).length < 5) {
                    document.querySelectorAll('.card-body div, .card-body p, .row div, .d-flex').forEach(el => {
                        const children = el.children;
                        if (children.length === 2) {
                            const label = (children[0] as HTMLElement).innerText?.trim().replace(/:$/, '');
                            const value = (children[1] as HTMLElement).innerText?.trim();
                            if (label && value && label.length > 1 && label.length < 50 && value.length < 100) {
                                if (!specs[label]) specs[label] = value;
                            }
                        }
                    });
                }

                // Strategy 3: Also try h2 siblings in card-body for profile data
                if (Object.keys(specs).length < 5) {
                    document.querySelectorAll('h2').forEach(h2 => {
                        const text = h2.innerText.trim();
                        if (profileHeaders.some(h => text.includes(h))) {
                            const container = h2.closest('.card-body') || h2.parentElement;
                            if (container) {
                                const allSpans = container.querySelectorAll('span');
                                const spanTexts = Array.from(allSpans).map(s => (s as HTMLElement).innerText.trim());
                                for (let si = 0; si < spanTexts.length - 1; si++) {
                                    const label = spanTexts[si].replace(/:$/, '');
                                    if (knownLabels.some(l => label.includes(l))) {
                                        specs[label] = spanTexts[si + 1];
                                        si++;
                                    }
                                }
                            }
                        }
                    });
                }

                // --- Prices ---
                const prices: { oldPrice: string | null; buyNowPrice: string | null; totalPrice: string | null } = {
                    oldPrice: null,
                    buyNowPrice: null,
                    totalPrice: null,
                };

                // Old price from text: "Старая цена:" or "Old price:"
                const oldMatch = allText.match(/(?:Старая цена|Old price)[:\s]*\n?\s*([\d\s.,]+)/i);
                if (oldMatch) prices.oldPrice = oldMatch[1].trim();

                // Buy now price — from button text: "КУПИТЬ 21600€" or "BUY 21600€"
                const buyMatch = allText.match(/(?:КУПИТЬ|BUY)\s*([\d\s.,]+)\s*€/i);
                if (buyMatch) prices.buyNowPrice = buyMatch[1].trim();

                // Fallback: strikethrough element for old price
                if (!prices.oldPrice) {
                    const strikeEl = document.querySelector('s, del, .text-decoration-line-through');
                    if (strikeEl) {
                        const text = (strikeEl as HTMLElement).innerText.trim();
                        if (text.match(/[\d.,]+/)) prices.oldPrice = text;
                    }
                }

                // Fallback: green button for buy now
                if (!prices.buyNowPrice) {
                    document.querySelectorAll('button, .btn, a.btn').forEach(btn => {
                        const text = (btn as HTMLElement).innerText.trim();
                        const match = text.match(/(?:КУПИТЬ|BUY|купить)\s*([\d\s.,]+)/i);
                        if (match && !prices.buyNowPrice) prices.buyNowPrice = match[1].trim();
                    });
                }

                // Total price: "Общая цена" / "Total price" with € amount
                const totalMatch = allText.match(/(?:Общая цена|Total price)[^\d€]*(€?\s*[\d\s.,]+)/i);
                if (totalMatch) prices.totalPrice = totalMatch[1].trim();

                // --- VAT Type ---
                let vatType: string | null = null;
                if (allText.includes('НДС к вычету') || allText.includes('VAT deductible')) {
                    vatType = 'deductible';
                } else if (allText.includes('Маржа') || allText.includes('Margin')) {
                    vatType = 'margin';
                }

                // --- Equipment (text-based by category) ---
                const equipmentByCategory: Record<string, string[]> = {};
                const equipment: string[] = [];

                const categoryHeaders = [
                    'Высокоценные варианты', 'Комфорт', 'Защита и безопасность',
                    'Мультимедиа', 'Интерьер', 'Экстерьер', 'Другие варианты',
                    // English
                    'High-value options', 'Comfort', 'Safety and security',
                    'Multimedia', 'Interior', 'Exterior', 'Other options',
                ];

                const eqStarts = ['Комплектация', 'Equipment', 'Options'].map(h => allText.indexOf(h)).filter(i => i > -1);
                const equipStart = eqStarts.length > 0 ? Math.min(...eqStarts) : -1;
                if (equipStart > -1) {
                    // Find the end of equipment section (footer or next major section)
                    const footerIdx = allText.indexOf('Ecarstrade', equipStart);
                    const nextSectionIdx = allText.indexOf('Похожие', equipStart);
                    const equipEnd = Math.min(
                        footerIdx > equipStart ? footerIdx : allText.length,
                        nextSectionIdx > equipStart ? nextSectionIdx : allText.length
                    );
                    const equipText = allText.substring(equipStart, equipEnd);

                    // Parse each category
                    for (let ci = 0; ci < categoryHeaders.length; ci++) {
                        const header = categoryHeaders[ci];
                        const headerIdx = equipText.indexOf(header);
                        if (headerIdx === -1) continue;

                        // Find next header or end
                        let nextHeaderIdx = equipText.length;
                        for (let nci = 0; nci < categoryHeaders.length; nci++) {
                            if (nci === ci) continue;
                            const idx = equipText.indexOf(categoryHeaders[nci], headerIdx + header.length);
                            if (idx > -1 && idx < nextHeaderIdx) nextHeaderIdx = idx;
                        }

                        const sectionText = equipText.substring(headerIdx + header.length, nextHeaderIdx);
                        const footerJunk = [
                            'Similar cars', 'eCarsTrade', 'Home', 'General Terms',
                            'Privacy', 'Quality', 'Popular', 'About', 'FAQ', 'Blog',
                            'Useful', 'Car catalog', 'Extra services', 'Ways to purchase',
                            'Delivery Service', 'Costs', 'User statuses', 'Become',
                            'Battery lease', 'Contact', 'Tel.:', 'Email:', 'Follow',
                            'Sitemap', '©', 'See all', 'Discover', 'Join our', 'How eCarsTrade',
                            'Rental car', 'Used car', 'Used van', 'Referral',
                            'Welcome to', 'COMPANY DOCUMENT', 'Choose file', 'ID OR PASSPORT',
                            'Later', 'of 3', '€ ', 'CarPromo', 'TRIAL', 'maks',
                        ];
                        const items = sectionText
                            .split('\n')
                            .map(l => l.trim().replace(/^[✔✓☑⊕⊗●]\s*/, '').trim())
                            .filter(l =>
                                l.length > 2 && l.length < 100 &&
                                !categoryHeaders.includes(l) &&
                                !footerJunk.some(junk => l.startsWith(junk)) &&
                                !/^\d+\s*\/\s*\d+$/.test(l) &&
                                !/^\d{4}\s+\d/.test(l)
                            );

                        if (items.length > 0) {
                            equipmentByCategory[header] = items;
                            equipment.push(...items);
                        }
                    }
                }

                // --- Remarks ---
                let remarks: string | null = null;
                const remStarts = ['Важные замечания', 'Important remarks'].map(h => allText.indexOf(h)).filter(i => i > -1);
                const remarkStart = remStarts.length > 0 ? Math.min(...remStarts) : -1;
                if (remarkStart > -1) {
                    const remEnds = ['Комплектация', 'Equipment', 'Options'].map(h => allText.indexOf(h, remarkStart)).filter(i => i > remarkStart);
                    const remarkEnd = remEnds.length > 0 ? Math.min(...remEnds) : remarkStart + 1000;
                    remarks = allText.substring(remarkStart, remarkEnd)
                        .replace(/^(?:Важные замечания|Important remarks)\s*/i, '')
                        .replace(/Auto-translate\s*/i, '')
                        .trim() || null;
                }

                // --- Auction Info ---
                let auctionInfo: string | null = null;
                const aucMatch = allText.match(/Аукцион\s*\n?\s*(.+?)(?:\n|Описание)/);
                if (aucMatch) auctionInfo = aucMatch[1].trim();
                if (!auctionInfo) {
                    const tenderMatch = allText.match(/(Tender[:\s].+?)(?:\n|$)/);
                    if (tenderMatch) auctionInfo = tenderMatch[1].trim();
                }
                if (!auctionInfo) {
                    if (allText.includes('Наш сток') || allText.includes('Our stock')) {
                        auctionInfo = 'Наш сток';
                    }
                }

                // --- Pickup Location & Seller ---
                let pickupLocation: string | null = null;
                let pickupReadiness: string | null = null;
                let sellerName: string | null = null;

                const pickupMatch = allText.match(/(?:Место сбора|Collection point|Pick.?up location)\s*\n*\s*([A-Za-zА-Яа-яёЁ\s-]+?)(?:\n|$)/);
                if (pickupMatch) pickupLocation = pickupMatch[1].trim() || null;

                const readyMatch = allText.match(/(?:Готовность к самовывозу|Ready for collection|Pick.?up ready)\s*\n*\s*(.+?)(?:\n|$)/i);
                if (readyMatch) pickupReadiness = readyMatch[1].trim() || null;

                const sellerMatch = allText.match(/(?:Продавец|Seller)\s*\n*\s*(.+?)(?:\n|$)/);
                if (sellerMatch) sellerName = sellerMatch[1].trim() || null;

                // --- Condition Report URL ---
                let conditionReportUrl: string | null = null;
                const pdfLinks = Array.from(document.querySelectorAll('a[href*=".pdf"], a[href*="diagnosis"], a[href*="report"], a[href*="appraisal"]'));
                for (const link of pdfLinks) {
                    const href = (link as HTMLAnchorElement).href;
                    if (href && (href.includes('diagnosis') || href.includes('appraisal') || href.includes('report'))) {
                        conditionReportUrl = href;
                        break;
                    }
                }

                // --- Documents Info ---
                let documentsType: string | null = null;
                let documentCountry: string | null = null;
                const docTypeMatch = allText.match(/(?:Документы|Documents)\s*\n?\s*([A-Za-z,\s]+?)(?:\n|$)/);
                if (docTypeMatch && !docTypeMatch[1].includes('Скачать')) {
                    documentsType = docTypeMatch[1].trim();
                }
                const docCountryMatch = allText.match(/(?:Document country origin)\s*\n?\s*(.+?)(?:\n|$)/i);
                if (docCountryMatch) documentCountry = docCountryMatch[1].trim();

                // --- Service History ---
                const serviceHistory: any[] = [];
                const tables = Array.from(document.querySelectorAll('table'));
                for (const table of tables) {
                    const headers = Array.from(table.querySelectorAll('th')).map(th => th.innerText.toLowerCase());
                    if (headers.some(h => h.includes('date') || h.includes('дата')) &&
                        headers.some(h => h.includes('mileage') || h.includes('пробег'))) {
                        Array.from(table.querySelectorAll('tbody tr')).forEach(row => {
                            const cells = Array.from(row.querySelectorAll('td')).map(td => td.innerText.trim());
                            if (cells.length >= 4) {
                                serviceHistory.push({
                                    date: cells[0], mileage: cells[1],
                                    company: cells[2], description: cells[3],
                                    price: cells[4] || ''
                                });
                            }
                        });
                        break;
                    }
                }

                return {
                    jsonLd,
                    title,
                    images,
                    specs,
                    prices,
                    vatType,
                    equipment: [...new Set(equipment)],
                    equipmentByCategory,
                    remarks,
                    auctionInfo,
                    pickupLocation,
                    pickupReadiness,
                    sellerName,
                    conditionReportUrl,
                    documentsType,
                    documentCountry,
                    serviceHistory,
                };
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
