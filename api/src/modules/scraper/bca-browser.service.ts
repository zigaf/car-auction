import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { BcaSearchResponse } from './interfaces/bca-vehicle.interface';

@Injectable()
export class BcaBrowserService implements OnModuleDestroy {
  private browser: any = null;
  private context: any = null;
  private page: any = null;
  private readonly logger = new Logger(BcaBrowserService.name);

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
    const proxyServer = (process.env.OXYLABS_PROXY_SERVER || 'http://unblock.oxylabs.io:60000')
      .replace('https://', 'http://');

    this.logger.log(`Launching browser with proxy: ${proxyServer}`);
    this.logger.log(`Proxy user: ${process.env.OXYLABS_PROXY_USERNAME || '(not set)'}`);

    const { chromium } = await this.getPlaywright();

    this.browser = await chromium.launch({
      headless: true,
      proxy: {
        server: proxyServer,
        username: process.env.OXYLABS_PROXY_USERNAME,
        password: process.env.OXYLABS_PROXY_PASSWORD,
      },
      args: ['--disable-blink-features=AutomationControlled'],
    });

    this.context = await this.browser.newContext({
      ignoreHTTPSErrors: true,
      userAgent:
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      locale: 'en-US',
      viewport: { width: 1920, height: 1080 },
    });

    this.page = await this.context.newPage();

    // Establish session by loading the search page
    const baseUrl = process.env.BCA_BASE_URL || 'https://be.bca-europe.com';
    this.logger.log('Establishing session...');
    await this.page.goto(`${baseUrl}/Search`, {
      waitUntil: 'domcontentloaded',
      timeout: 90000,
    });
    await this.page.waitForTimeout(8000);
    this.logger.log('Session established');
  }

  async fetchVehiclePage(pageNumber: number): Promise<BcaSearchResponse> {
    if (!this.page) {
      throw new Error('Browser not initialized. Call initialize() first.');
    }

    this.logger.log(`Fetching vehicle page ${pageNumber}...`);

    const result = await this.page.evaluate(async (pageNum: number) => {
      const resp = await fetch(
        `/buyer/facetedsearch/GetViewModel?page=${pageNum}&sort=SaleDate&cultureCode=en`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
            'X-Requested-With': 'XMLHttpRequest',
          },
          body: '{}',
        },
      );
      const json = await resp.json();
      return {
        VehicleResults: json.VehicleResults,
        TotalVehicleCount: json.TotalVehicleCount,
        PageSize: json.PageSize,
        _topLevelKeys: Object.keys(json),
        _sampleVehicle: json.VehicleResults?.[0] ? JSON.stringify(json.VehicleResults[0]).substring(0, 2000) : null,
      };
    }, pageNumber);

    this.logger.log(`API top-level keys: ${JSON.stringify((result as any)._topLevelKeys)}`);
    if ((result as any)._sampleVehicle) {
      this.logger.log(`Sample vehicle: ${(result as any)._sampleVehicle}`);
    }
    this.logger.log(
      `Page ${pageNumber}: ${result.VehicleResults?.length || 0} vehicles (total: ${result.TotalVehicleCount})`,
    );

    return result;
  }

  async extractPhotoDocIds(lotViewUrl: string): Promise<string[]> {
    if (!this.context) {
      throw new Error('Browser not initialized. Call initialize() first.');
    }

    this.logger.debug(`Extracting photo docIds from ${lotViewUrl}`);

    const lotPage = await this.context.newPage();
    try {
      await lotPage.goto(lotViewUrl, {
        waitUntil: 'domcontentloaded',
        timeout: 60000,
      });
      await lotPage.waitForTimeout(20000);

      const docIds = await lotPage.evaluate(() => {
        const html = document.documentElement.innerHTML;
        const matches: string[] = html.match(/docId[=:]["']?(\d+)/g) || [];

        // Also check script tags
        document.querySelectorAll('script').forEach((s) => {
          const text = s.textContent || '';
          if (
            text.includes('docId') ||
            text.includes('galleryImages') ||
            text.includes('VehicleImage')
          ) {
            const scriptMatches = text.match(/docId[=:]["']?(\d+)/g) || [];
            matches.push(...scriptMatches);
          }
        });

        // Extract numeric IDs and deduplicate
        const ids = matches
          .map((m) => {
            const numMatch = m.match(/\d+/);
            return numMatch ? numMatch[0] : null;
          })
          .filter((id): id is string => id !== null);

        return [...new Set(ids)];
      });

      this.logger.debug(`Found ${docIds.length} photo docIds`);
      return docIds;
    } catch (error) {
      this.logger.warn(`Failed to extract docIds from ${lotViewUrl}: ${error.message}`);
      return [];
    } finally {
      await lotPage.close();
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
