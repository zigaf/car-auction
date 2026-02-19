import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import {
  AutobidSearchResult,
  AutobidVehicleCard,
  AutobidVehicleDetail,
} from './interfaces/autobid-vehicle.interface';

@Injectable()
export class AutobidBrowserService implements OnModuleDestroy {
  private browser: any = null;
  private context: any = null;
  private page: any = null;
  private readonly logger = new Logger(AutobidBrowserService.name);

  private async getPlaywright() {
    try {
      return await import('playwright');
    } catch {
      throw new Error(
        'Playwright is not installed. Run: npx playwright install chromium',
      );
    }
  }

  async initialize(): Promise<void> {
    const proxyServer = (
      process.env.OXYLABS_PROXY_SERVER || 'http://unblock.oxylabs.io:60000'
    ).replace('https://', 'http://');

    this.logger.log(`Launching browser with proxy: ${proxyServer}`);
    this.logger.log(
      `Proxy user: ${process.env.OXYLABS_PROXY_USERNAME || '(not set)'}`,
    );

    const { chromium } = await this.getPlaywright();

    this.browser = await chromium.launch({
      headless: true,
      proxy: {
        server: proxyServer,
        username: process.env.OXYLABS_PROXY_USERNAME,
        password: process.env.OXYLABS_PROXY_PASSWORD,
      },
      args: [
        '--disable-blink-features=AutomationControlled',
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--disable-extensions',
        '--single-process',
        '--no-zygote',
      ],
    });

    this.context = await this.browser.newContext({
      ignoreHTTPSErrors: true,
      userAgent:
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
      locale: 'ru-RU',
      viewport: { width: 1920, height: 1080 },
    });

    this.page = await this.context.newPage();
    this.logger.log('Browser initialized');
  }

  async fetchSearchPage(pageNumber: number): Promise<AutobidSearchResult> {
    if (!this.page) {
      throw new Error('Browser not initialized. Call initialize() first.');
    }

    const baseUrl = process.env.AUTOBID_BASE_URL || 'https://autobid.de';
    const locale = process.env.AUTOBID_LOCALE || 'ru';
    const searchParams =
      process.env.AUTOBID_SEARCH_PARAMS ||
      'e367=1&sortingType=auctionStartDate-ASCENDING&carList-category=1;2&carList-category=1;1&carList-category=1;77&carList-category=1;17&carList-category=1;33&carList-category=1;6&carList-category=1;608&carList-category=1;34&carList-category=1;3';
    const url = `${baseUrl}/${locale}/rezultaty-poiska?${searchParams}&page=${pageNumber}`;

    this.logger.log(`Fetching search page ${pageNumber}: ${url}`);

    await this.navigateWithRetry(url);

    // Wait for vehicle cards to render
    await this.waitForContent();

    // Log page content snippet for debugging on first page
    if (pageNumber === 1) {
      await this.logPageDebugInfo();
    }

    // Extract vehicle cards from the rendered DOM
    const result = await this.page.evaluate((currentPage: number) => {
      const cards: any[] = [];

      // Strategy: find all links that point to vehicle detail pages
      const vehicleLinks = document.querySelectorAll('a[href*="/element/"]');
      const seenIds = new Set<string>();

      vehicleLinks.forEach((link: Element) => {
        const href = (link as HTMLAnchorElement).href;
        if (!href || !href.includes('/element/')) return;

        // Extract vehicle ID from URL (last numeric segment before /podrobnosti or end)
        const idMatch = href.match(/[-/](\d{4,})/);
        if (!idMatch) return;
        const vehicleId = idMatch[1];

        // Skip duplicates
        if (seenIds.has(vehicleId)) return;
        seenIds.add(vehicleId);

        // Find the card container (walk up to find a reasonable parent)
        let cardEl: Element | null = link;
        for (let i = 0; i < 5; i++) {
          if (
            cardEl.parentElement &&
            cardEl.parentElement.children.length > 1
          ) {
            break;
          }
          cardEl = cardEl.parentElement;
          if (!cardEl) break;
        }

        // Extract data from the card
        const titleEl = (cardEl || link).querySelector(
          'h2, h3, h4, [class*="title"], [class*="name"]',
        );
        const imgEl = (cardEl || link).querySelector('img');
        const priceEl = (cardEl || link).querySelector(
          '[class*="price"], [class*="Price"], [class*="cost"], [class*="bid"]',
        );

        // Fallback: use link text as title
        const title =
          titleEl?.textContent?.trim() ||
          link.textContent?.trim()?.substring(0, 100) ||
          '';

        if (title.length < 3) return; // Skip empty/garbage cards

        cards.push({
          title,
          detailUrl: href.includes('/podrobnosti')
            ? href
            : href.replace(/\/?$/, '/podrobnosti'),
          vehicleId,
          thumbnailUrl:
            imgEl?.getAttribute('src') ||
            imgEl?.getAttribute('data-src') ||
            null,
          price: priceEl?.textContent?.trim() || null,
        });
      });

      // Try to extract pagination info
      let totalCount: number | null = null;
      let totalPages: number | null = null;

      // Look for total count text (e.g., "Найдено: 1234" or "1234 результатов")
      const bodyText = document.body?.innerText || '';
      const countMatch = bodyText.match(
        /(?:Найдено|Результат|Gefunden|Results?)[:\s]*(\d[\d\s.,]*)/i,
      );
      if (countMatch) {
        totalCount = parseInt(countMatch[1].replace(/[\s.,]/g, ''), 10);
      }

      // Look for pagination buttons/links
      const paginationLinks = document.querySelectorAll(
        '[class*="pagination"] a, [class*="paging"] a, nav a[href*="page="]',
      );
      if (paginationLinks.length > 0) {
        let maxPage = 1;
        paginationLinks.forEach((el) => {
          const text = el.textContent?.trim();
          const num = text ? parseInt(text, 10) : NaN;
          if (!isNaN(num) && num > maxPage) maxPage = num;
          // Also check href for page number
          const href = (el as HTMLAnchorElement).href;
          const pageMatch = href?.match(/page=(\d+)/);
          if (pageMatch) {
            const p = parseInt(pageMatch[1], 10);
            if (p > maxPage) maxPage = p;
          }
        });
        totalPages = maxPage;
      }

      return {
        vehicles: cards,
        totalCount,
        currentPage,
        totalPages,
      } as any;
    }, pageNumber);

    this.logger.log(
      `Page ${pageNumber}: ${result.vehicles.length} vehicles found (total: ${result.totalCount || '?'}, pages: ${result.totalPages || '?'})`,
    );

    // If no vehicles found, dump page content for debugging
    if (result.vehicles.length === 0) {
      const html = await this.page.content();
      this.logger.warn(
        `No vehicles found on page ${pageNumber}. Page HTML (first 5000 chars): ${html.substring(0, 5000)}`,
      );
      // Also dump all links for analysis
      const links = await this.page.evaluate(() =>
        Array.from(document.querySelectorAll('a'))
          .slice(0, 50)
          .map((a) => ({ href: a.href, text: a.textContent?.trim()?.substring(0, 60) })),
      );
      this.logger.warn(`Page links sample: ${JSON.stringify(links.slice(0, 20))}`);
    }

    // Log sample vehicle for debugging
    if (result.vehicles.length > 0) {
      const sample = result.vehicles[0];
      this.logger.log(
        `Sample card: title="${sample.title}", id=${sample.vehicleId}, price=${sample.price}, img=${sample.thumbnailUrl?.substring(0, 80)}`,
      );
    }

    // Attach debug HTML if no vehicles found (for caller to save to errorLog)
    if (result.vehicles.length === 0) {
      try {
        (result as any)._debugHtml = await this.page
          .content()
          .then((h: string) => h.substring(0, 8000));
      } catch {
        // ignore
      }
    }

    return result;
  }

  async fetchVehicleDetail(
    detailUrl: string,
  ): Promise<AutobidVehicleDetail> {
    if (!this.page) {
      throw new Error('Browser not initialized. Call initialize() first.');
    }

    this.logger.log(`Fetching detail: ${detailUrl}`);

    await this.navigateWithRetry(detailUrl);

    // Wait for detail content to render
    await this.page
      .waitForSelector('h1, [class*="detail"], [class*="title"]', {
        timeout: 15000,
      })
      .catch(() => {
        this.logger.warn('Detail content selector not found, continuing...');
      });

    await this.page.waitForTimeout(3000);

    const result: AutobidVehicleDetail = await this.page.evaluate(() => {
      const getText = (sel: string) =>
        document.querySelector(sel)?.textContent?.trim() || null;
      const getAll = (sel: string) =>
        Array.from(document.querySelectorAll(sel));

      // Title
      const title = getText('h1') || getText('[class*="title"]') || '';

      // Extract specs from key-value pairs (tables, definition lists, grid rows)
      const specs: Record<string, string> = {};
      // Strategy 1: Table rows
      getAll('table tr').forEach((row) => {
        const cells = row.querySelectorAll('td, th');
        if (cells.length >= 2) {
          const label = cells[0]?.textContent?.trim();
          const value = cells[1]?.textContent?.trim();
          if (label && value && label.length < 80) specs[label] = value;
        }
      });
      // Strategy 2: Definition lists
      getAll('dl').forEach((dl) => {
        const dts = dl.querySelectorAll('dt');
        const dds = dl.querySelectorAll('dd');
        dts.forEach((dt, i) => {
          const label = dt.textContent?.trim();
          const value = dds[i]?.textContent?.trim();
          if (label && value) specs[label] = value;
        });
      });
      // Strategy 3: Label-value divs (common in SPAs)
      getAll(
        '[class*="spec"] [class*="row"], [class*="detail"] [class*="row"], [class*="info"] [class*="row"], [class*="feature"] [class*="item"]',
      ).forEach((row) => {
        const children = row.children;
        if (children.length >= 2) {
          const label = children[0]?.textContent?.trim();
          const value = children[1]?.textContent?.trim();
          if (label && value && label.length < 80) specs[label] = value;
        }
      });
      // Strategy 4: Divs with colon-separated text
      getAll('[class*="spec"], [class*="detail"], [class*="data"]').forEach(
        (el) => {
          const text = el.textContent?.trim();
          if (text && text.includes(':') && text.length < 150) {
            const [label, ...rest] = text.split(':');
            const value = rest.join(':').trim();
            if (label && value && label.length < 80) specs[label.trim()] = value;
          }
        },
      );

      // Extract images from gallery
      const imageUrls: string[] = [];
      const seenUrls = new Set<string>();
      const addImage = (url: string | null | undefined) => {
        if (!url) return;
        if (url.startsWith('data:')) return;
        if (url.includes('placeholder')) return;
        if (url.includes('no-image')) return;
        // Prefer full-size versions
        const fullUrl = url
          .replace(/\/thumb\//, '/large/')
          .replace(/\/small\//, '/large/')
          .replace(/_thumb/, '')
          .replace(/_small/, '');
        if (!seenUrls.has(fullUrl)) {
          seenUrls.add(fullUrl);
          imageUrls.push(fullUrl);
        }
      };

      // Gallery images
      getAll(
        '[class*="gallery"] img, [class*="slider"] img, [class*="carousel"] img, [class*="photo"] img, [class*="swiper"] img, [class*="image"] img',
      ).forEach((img) => {
        addImage(
          (img as HTMLImageElement).src ||
            img.getAttribute('data-src') ||
            img.getAttribute('data-lazy-src'),
        );
        // Check for high-res version
        addImage(
          img.getAttribute('data-zoom-image') ||
            img.getAttribute('data-full') ||
            img.getAttribute('data-large'),
        );
      });

      // Background images in slides
      getAll(
        '[class*="slide"] [style*="background"], [class*="gallery"] [style*="background"]',
      ).forEach((el) => {
        const style = el.getAttribute('style');
        const match = style?.match(/url\(['"]?(.+?)['"]?\)/);
        if (match) addImage(match[1]);
      });

      // If no gallery images found, try all images on the page
      if (imageUrls.length === 0) {
        getAll('img').forEach((img) => {
          const src =
            (img as HTMLImageElement).src || img.getAttribute('data-src');
          if (
            src &&
            !src.includes('logo') &&
            !src.includes('icon') &&
            !src.includes('avatar') &&
            !src.includes('flag') &&
            (img as HTMLImageElement).naturalWidth > 100
          ) {
            addImage(src);
          }
        });
      }

      // Price
      const priceEl = document.querySelector(
        '[class*="price"], [class*="Price"], [class*="cost"], [class*="bid"]',
      );
      const price = priceEl?.textContent?.trim() || null;

      // Description
      const descEl = document.querySelector(
        '[class*="description"], [class*="comment"], [class*="remark"]',
      );
      const description = descEl?.textContent?.trim() || null;

      // Auction end date
      const timerEl = document.querySelector(
        '[class*="timer"], [class*="countdown"], [class*="auction"] [class*="date"], [class*="end"]',
      );
      const auctionEndDate = timerEl?.textContent?.trim() || null;

      return {
        title,
        specs,
        imageUrls,
        price,
        description,
        auctionEndDate,
      };
    });

    this.logger.log(
      `Detail extracted: title="${result.title?.substring(0, 60)}", specs=${Object.keys(result.specs).length}, images=${result.imageUrls.length}, price=${result.price}`,
    );

    // Log all spec keys for debugging
    if (Object.keys(result.specs).length > 0) {
      this.logger.debug(
        `Spec keys: ${Object.keys(result.specs).join(', ')}`,
      );
    }

    return result;
  }

  private async navigateWithRetry(
    url: string,
    maxRetries: number = 3,
  ): Promise<void> {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const response = await this.page.goto(url, {
          waitUntil: 'commit',
          timeout: 60000,
        });
        const status = response?.status();
        if (status && status >= 400 && status !== 403) {
          throw new Error(`HTTP ${status}`);
        }
        // Wait for DOM
        await this.page
          .waitForLoadState('domcontentloaded', { timeout: 30000 })
          .catch(() => {
            this.logger.warn('domcontentloaded timeout, continuing...');
          });
        return;
      } catch (error) {
        this.logger.warn(
          `Navigation attempt ${attempt}/${maxRetries} failed for ${url}: ${error.message}`,
        );
        if (attempt === maxRetries) throw error;
        const delay = 10000 * Math.pow(2, attempt - 1);
        this.logger.log(`Waiting ${delay}ms before retry...`);
        await this.page.waitForTimeout(delay);
      }
    }
  }

  private async waitForContent(): Promise<void> {
    // Wait for any vehicle-related content to appear
    const selectors = [
      'a[href*="/element/"]',
      '[class*="vehicle"]',
      '[class*="car"]',
      '[class*="listing"]',
      '[class*="result"]',
    ];

    for (const selector of selectors) {
      try {
        await this.page.waitForSelector(selector, { timeout: 10000 });
        this.logger.debug(`Content found via selector: ${selector}`);
        // Give extra time for all cards to render
        await this.page.waitForTimeout(3000);
        return;
      } catch {
        // Try next selector
      }
    }

    // Last resort: just wait
    this.logger.warn(
      'No vehicle content selectors matched, waiting 10s...',
    );
    await this.page.waitForTimeout(10000);
  }

  private async logPageDebugInfo(): Promise<void> {
    try {
      const debugInfo = await this.page.evaluate(() => {
        const content = document.body?.innerText?.substring(0, 3000) || '';
        const linkCount = document.querySelectorAll(
          'a[href*="/element/"]',
        ).length;
        const imgCount = document.querySelectorAll('img').length;
        const title = document.title;
        return { content, linkCount, imgCount, title };
      });
      this.logger.log(`Page title: ${debugInfo.title}`);
      this.logger.log(
        `Found ${debugInfo.linkCount} vehicle links, ${debugInfo.imgCount} images`,
      );
      this.logger.debug(
        `Page text (first 1000 chars): ${debugInfo.content.substring(0, 1000)}`,
      );
    } catch (error) {
      this.logger.warn(`Debug info extraction failed: ${error.message}`);
    }
  }

  async destroy(): Promise<void> {
    if (this.page) {
      try {
        await this.page.close();
      } catch {
        // ignore
      }
      this.page = null;
    }
    if (this.context) {
      try {
        await this.context.close();
      } catch {
        // ignore
      }
      this.context = null;
    }
    if (this.browser) {
      try {
        await this.browser.close();
      } catch {
        // ignore
      }
      this.browser = null;
    }
    this.logger.log('Browser closed');
  }

  async onModuleDestroy(): Promise<void> {
    await this.destroy();
  }
}
