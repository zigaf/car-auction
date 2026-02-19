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
      // Group by vehicleId first, then pick the best link per vehicle
      const vehicleLinks = document.querySelectorAll('a[href*="/element/"]');
      const vehicleMap: Record<
        string,
        { href: string; text: string; link: Element }[]
      > = {};

      vehicleLinks.forEach((link: Element) => {
        const href = (link as HTMLAnchorElement).href;
        if (!href || !href.includes('/element/')) return;

        const idMatch = href.match(/[-/](\d{5,})/);
        if (!idMatch) return;
        const vehicleId = idMatch[1];

        if (!vehicleMap[vehicleId]) vehicleMap[vehicleId] = [];
        vehicleMap[vehicleId].push({
          href,
          text: link.textContent?.trim() || '',
          link,
        });
      });

      // For each unique vehicle, pick the link with the longest text (title link)
      Object.entries(vehicleMap).forEach(([vehicleId, links]) => {
        // Sort by text length descending - the title link has the most text
        links.sort((a, b) => b.text.length - a.text.length);
        const best = links[0];

        // Use the link that has meaningful text for the title
        const title = best.text.substring(0, 150);
        if (title.length < 3) return; // Skip if no link has meaningful text

        // Find the card container by walking up from ANY of the links
        let cardEl: Element | null = best.link;
        for (let i = 0; i < 10; i++) {
          if (
            cardEl.parentElement &&
            cardEl.parentElement.querySelectorAll('a[href*="/element/"]')
              .length <= 3
          ) {
            cardEl = cardEl.parentElement;
          } else {
            break;
          }
          if (!cardEl) break;
        }

        const container = cardEl || best.link;

        // Thumbnail: prefer cdn.autobid.de images within the card
        let thumbnailUrl: string | null = null;
        const cdnImg = container.querySelector(
          'img[src*="cdn.autobid.de"]',
        ) as HTMLImageElement | null;
        if (cdnImg) {
          thumbnailUrl = cdnImg.src;
        } else {
          // Fallback: check <picture> <source> srcset
          const source = container.querySelector(
            'picture source[srcset*="cdn.autobid.de"]',
          );
          if (source) {
            thumbnailUrl =
              source.getAttribute('srcset')?.split(',')[0]?.trim()?.split(' ')[0] ||
              null;
          }
          // Fallback: any img
          if (!thumbnailUrl) {
            const anyImg = container.querySelector('img') as HTMLImageElement | null;
            if (anyImg?.src && !anyImg.src.includes('data:')) {
              thumbnailUrl = anyImg.src;
            }
          }
        }

        // Price: look for text containing € within the card
        let price: string | null = null;
        const allEls = container.querySelectorAll('*');
        for (const el of Array.from(allEls)) {
          const t = el.textContent?.trim();
          if (
            t &&
            t.includes('€') &&
            t.length < 50 &&
            el.children.length === 0
          ) {
            price = t;
            break;
          }
        }

        // Build detail URL (ensure it ends with /podrobnosti)
        const detailHref = best.href.includes('/podrobnosti')
          ? best.href
          : best.href.replace(/\/?$/, '/podrobnosti');

        cards.push({
          title,
          detailUrl: detailHref,
          vehicleId,
          thumbnailUrl,
          price,
        });
      });

      // Extract total count: "Найденные автомобили (2412)" or "Gefundene Fahrzeuge (2412)"
      let totalCount: number | null = null;
      let totalPages: number | null = null;

      const bodyText = document.body?.innerText || '';
      const countMatch = bodyText.match(
        /(?:Найденные\s+автомобили|Gefundene\s+Fahrzeuge)\s*\((\d[\d\s.,]*)\)/i,
      );
      if (countMatch) {
        totalCount = parseInt(countMatch[1].replace(/[\s.,]/g, ''), 10);
      }
      // Fallback: generic patterns
      if (!totalCount) {
        const fallbackMatch = bodyText.match(
          /(?:Найдено|Результат|Gefunden|Results?)[:\s]*(\d[\d\s.,]*)/i,
        );
        if (fallbackMatch) {
          totalCount = parseInt(
            fallbackMatch[1].replace(/[\s.,]/g, ''),
            10,
          );
        }
      }

      // Pagination: look for page links
      const paginationLinks = document.querySelectorAll(
        'a[href*="page="], [class*="pagination"] a, [class*="paging"] a, nav a',
      );
      if (paginationLinks.length > 0) {
        let maxPage = 1;
        paginationLinks.forEach((el) => {
          const text = el.textContent?.trim();
          const num = text ? parseInt(text, 10) : NaN;
          if (!isNaN(num) && num > maxPage) maxPage = num;
          const href = (el as HTMLAnchorElement).href;
          const pageMatch = href?.match(/page=(\d+)/);
          if (pageMatch) {
            const p = parseInt(pageMatch[1], 10);
            if (p > maxPage) maxPage = p;
          }
        });
        totalPages = maxPage;
      }

      // Estimate totalPages from totalCount if not found from links
      if (!totalPages && totalCount && cards.length > 0) {
        totalPages = Math.ceil(totalCount / cards.length);
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

    // Wait for detail content to render (no h1 on autobid, use table/images)
    await this.page
      .waitForSelector(
        'table, img[src*="cdn.autobid.de"], [class*="detail"]',
        { timeout: 15000 },
      )
      .catch(() => {
        this.logger.warn('Detail content selector not found, continuing...');
      });

    await this.page.waitForTimeout(3000);

    // Scroll page to trigger lazy-loaded sections (body, interior, tires, etc.)
    await this.scrollPageForLazyContent();

    const result: AutobidVehicleDetail = await this.page.evaluate(() => {
      const getAll = (sel: string) =>
        Array.from(document.querySelectorAll(sel));

      // Helper: find section by header text on autobid.de.
      // Sections use <header class="...bg-[#EAE7E0]..."> elements containing a
      // <div> with the section title text. The section content follows as
      // siblings of the header's grandparent container.
      const findSectionContainer = (
        keywords: string[],
      ): Element | null => {
        // Strategy 1: Find <header> elements with matching text
        const headers = getAll('header');
        for (const header of headers) {
          const text = header.textContent?.trim()?.toUpperCase() || '';
          if (keywords.some((kw) => text.includes(kw.toUpperCase()))) {
            // The section content is typically a sibling of the header's
            // grandparent (div.mb-2) or the header's parent
            const gp = header.parentElement; // div.mb-2
            if (gp) {
              // Return the closest container that holds both header and content
              const container = gp.parentElement || gp;
              return container;
            }
            return header.parentElement;
          }
        }
        // Strategy 2: Search all elements for matching uppercase text
        const allEls = getAll('div, span, p');
        for (const el of allEls) {
          if (el.children.length > 3) continue;
          const text = el.textContent?.trim()?.toUpperCase() || '';
          if (
            text.length < 80 &&
            keywords.some((kw) => text.includes(kw.toUpperCase()))
          ) {
            const style = window.getComputedStyle(el);
            // Check if it looks like a header (uppercase, bold, background)
            if (
              style.fontWeight === 'bold' ||
              style.fontWeight === '700' ||
              style.textTransform === 'uppercase' ||
              el.className.includes('uppercase') ||
              el.className.includes('font-bold')
            ) {
              const container =
                el.parentElement?.parentElement?.parentElement ||
                el.parentElement?.parentElement ||
                el.parentElement;
              return container;
            }
          }
        }
        return null;
      };

      // ===================== TITLE =====================
      let title = '';
      const docTitle = document.title || '';
      const titleClean = docTitle
        .replace(/\s*[-–|]\s*autobid\.de.*$/i, '')
        .replace(/\s*[-–|]\s*Подробности.*$/i, '')
        .replace(/\s*[-–|]\s*podrobnosti.*$/i, '')
        .trim();
      if (titleClean.length > 3) {
        title = titleClean;
      }
      if (!title) {
        const headings = document.querySelectorAll('h1, h2, h3');
        for (const h of Array.from(headings)) {
          const t = h.textContent?.trim();
          if (t && t.length > 5 && t.length < 200) {
            title = t;
            break;
          }
        }
      }

      // ===================== SPECS (table rows) =====================
      const specs: Record<string, string> = {};
      getAll('table tr').forEach((row) => {
        const cells = row.querySelectorAll('td, th');
        if (cells.length >= 2) {
          let label = cells[0]?.textContent?.trim();
          const value = cells[1]?.textContent?.trim();
          if (label) label = label.replace(/:+$/, '').trim();
          if (label && value && label.length < 80 && label !== value) {
            specs[label] = value;
          }
        }
      });
      // Definition lists
      getAll('dl').forEach((dl) => {
        const dts = dl.querySelectorAll('dt');
        const dds = dl.querySelectorAll('dd');
        dts.forEach((dt, i) => {
          const label = dt.textContent?.trim();
          const value = dds[i]?.textContent?.trim();
          if (label && value) specs[label] = value;
        });
      });

      // ===================== IMAGES (cdn.autobid.de) =====================
      const imageUrls: string[] = [];
      const seenBaseUrls = new Set<string>();

      const addCdnImage = (src: string) => {
        if (!src.includes('cdn.autobid.de')) return;
        if (src.includes('logo') || src.includes('icon')) return;
        const baseUrl = src.replace(
          /_(?:xs|s|m|l)\.(jpg|jpeg|png|webp)/i,
          '_l.$1',
        );
        if (!seenBaseUrls.has(baseUrl)) {
          seenBaseUrls.add(baseUrl);
          imageUrls.push(baseUrl);
        }
      };

      getAll('img').forEach((img) => {
        const src =
          (img as HTMLImageElement).src ||
          img.getAttribute('data-src') ||
          '';
        addCdnImage(src);
      });

      if (imageUrls.length === 0) {
        getAll('picture source').forEach((source) => {
          const srcset = source.getAttribute('srcset') || '';
          srcset
            .split(',')
            .map((s) => s.trim().split(' ')[0])
            .forEach(addCdnImage);
        });
      }

      // ===================== PRICE =====================
      let price: string | null = null;
      const priceElements = document.querySelectorAll('td, span, div, p');
      for (const el of Array.from(priceElements)) {
        const t = el.textContent?.trim();
        if (
          t &&
          t.includes('€') &&
          t.length < 50 &&
          t.length > 3 &&
          el.children.length === 0 &&
          /[\d.,]+\s*€/.test(t)
        ) {
          price = t;
          break;
        }
      }
      if (!price) {
        const bodyText = document.body?.innerText || '';
        const priceMatch = bodyText.match(
          /(?:Стартовая\s+цена|Startpreis|Mindestgebot)[:\s]*([\d.,]+\s*€)/i,
        );
        if (priceMatch) price = priceMatch[1];
      }

      // ===================== EQUIPMENT (Комплектация) =====================
      const equipment: string[] = [];
      const equipContainer = findSectionContainer([
        'КОМПЛЕКТАЦИЯ',
        'AUSSTATTUNG',
        'EQUIPMENT',
      ]);
      if (equipContainer) {
        equipContainer.querySelectorAll('li').forEach((li) => {
          const text = li.textContent?.trim();
          if (text && text.length > 2 && text.length < 200) {
            equipment.push(text);
          }
        });
      }
      // Fallback: find largest cluster of <li> items
      if (equipment.length === 0) {
        const allLi = getAll('li');
        const clusters: Element[][] = [];
        let currentCluster: Element[] = [];
        allLi.forEach((li) => {
          const text = li.textContent?.trim() || '';
          if (text.length > 2 && text.length < 200) {
            currentCluster.push(li);
          } else if (currentCluster.length > 0) {
            clusters.push(currentCluster);
            currentCluster = [];
          }
        });
        if (currentCluster.length > 0) clusters.push(currentCluster);
        const biggest = clusters.sort((a, b) => b.length - a.length)[0];
        if (biggest && biggest.length >= 5) {
          biggest.forEach((li) => {
            equipment.push(li.textContent?.trim() || '');
          });
        }
      }

      // Helper: extract condition table rows from a container
      const extractConditionTable = (
        container: Element | null,
      ): { part: string; issues: string[] }[] => {
        if (!container) return [];
        const items: { part: string; issues: string[] }[] = [];
        container.querySelectorAll('table').forEach((table) => {
          const thead =
            table.querySelector('thead tr') ||
            table.querySelector('tr:first-child');
          const headerCells = thead?.querySelectorAll('td, th');
          table.querySelectorAll('tbody tr, tr').forEach((row) => {
            if (row === thead) return;
            const cells = row.querySelectorAll('td');
            if (cells.length < 1) return;
            const partName = cells[0]?.textContent?.trim();
            if (!partName || partName.length < 2 || partName.length > 100)
              return;
            const issues: string[] = [];
            if (headerCells && cells.length > 1) {
              for (let i = 1; i < cells.length; i++) {
                const cell = cells[i];
                const hasIndicator =
                  cell.querySelector(
                    'svg, [class*="toggle"], [class*="bg-"]',
                  ) ||
                  cell.innerHTML.includes('bg-') ||
                  (cell.querySelector('img') &&
                    !(
                      cell.querySelector('img') as HTMLImageElement
                    )?.src?.includes('cdn.autobid.de'));
                if (hasIndicator && headerCells[i]) {
                  const name = headerCells[i]?.textContent?.trim();
                  if (name) issues.push(name);
                }
              }
            }
            items.push({ part: partName, issues });
          });
        });
        // Also extract "Другие дефекты" paragraphs
        container.querySelectorAll('p').forEach((p) => {
          const t = p.textContent?.trim();
          if (t && t.includes('Другие дефекты')) {
            const next = p.nextElementSibling;
            const defectText = next?.textContent?.trim();
            if (defectText) {
              items.push({
                part: t.replace(/:$/, ''),
                issues: [defectText],
              });
            }
          }
        });
        return items;
      };

      // ===================== BODY CONDITION (Кузов) =====================
      const bodyContainer = findSectionContainer([
        'КУЗОВ',
        'KAROSSERIE',
        'BODY',
      ]);
      const bodyCondition = extractConditionTable(bodyContainer);

      // ===================== INTERIOR (Салон) =====================
      const interiorContainer = findSectionContainer([
        'САЛОН',
        'INNENRAUM',
        'INTERIOR',
      ]);
      const interiorCondition = extractConditionTable(interiorContainer);

      // ===================== TIRES (Шины) =====================
      const tires: {
        position: string;
        treadDepth: string | null;
        size: string | null;
      }[] = [];
      const tiresContainer = findSectionContainer([
        'ШИНЫ',
        'REIFEN',
        'КОЛЕСНЫЕ ДИСКИ',
      ]);
      if (tiresContainer) {
        tiresContainer.querySelectorAll('table tr').forEach((row) => {
          const cells = row.querySelectorAll('td');
          if (cells.length >= 2) {
            const pos = cells[0]?.textContent?.trim();
            if (
              pos &&
              (pos.includes('слева') ||
                pos.includes('справа') ||
                pos.includes('Спереди') ||
                pos.includes('спереди') ||
                pos.includes('сзади') ||
                pos.includes('links') ||
                pos.includes('rechts') ||
                pos.includes('vorn') ||
                pos.includes('hinten'))
            ) {
              const depth = cells[1]?.textContent?.trim() || null;
              const size =
                cells.length >= 3
                  ? cells[2]?.textContent?.trim() || null
                  : null;
              tires.push({ position: pos, treadDepth: depth, size });
            }
          }
        });
      }

      // ===================== STONE CHIPS =====================
      const chipsContainer = findSectionContainer([
        'ВМЯТИНА ОТ КАМНЕЙ',
        'STEINSCHLAG',
        'STONE CHIP',
      ]);
      const stoneChips = extractConditionTable(chipsContainer);

      // ===================== ACCIDENT INFO =====================
      let accidentInfo: string | null = null;
      const accidentContainer = findSectionContainer([
        'АВАРИЯ',
        'ПРЕДШЕСТВУЮЩИЕ ПОВРЕЖДЕНИЯ',
        'UNFALL',
        'VORSCHÄDEN',
      ]);
      if (accidentContainer) {
        const texts: string[] = [];
        accidentContainer
          .querySelectorAll('p, div, span, td')
          .forEach((el) => {
            if (el.children.length === 0) {
              const t = el.textContent?.trim();
              if (
                t &&
                t.length > 3 &&
                !t.toUpperCase().includes('АВАРИЯ') &&
                !t.toUpperCase().includes('ПОВРЕЖДЕНИЯ')
              )
                texts.push(t);
            }
          });
        if (texts.length > 0) accidentInfo = texts.join('. ');
      }

      // ===================== SEATS INFO =====================
      let seats: string | null = null;
      const seatsContainer = findSectionContainer([
        'СИДЕНИЯ',
        'СИДЕНЬЯ',
        'SITZE',
        'SEATS',
      ]);
      if (seatsContainer) {
        const parts: string[] = [];
        seatsContainer.querySelectorAll('li').forEach((li) => {
          const t = li.textContent?.trim();
          if (t) parts.push(t);
        });
        if (parts.length > 0) seats = parts.join('; ');
      }

      // ===================== PARKING FEE =====================
      let parkingFee: string | null = null;
      const parkingContainer = findSectionContainer([
        'ВЗНОС ЗА НАХОЖДЕНИЕ',
        'STANDGELD',
        'PARKING',
      ]);
      if (parkingContainer) {
        const texts: string[] = [];
        parkingContainer
          .querySelectorAll('[class*="whitespace-pre-line"], p, div')
          .forEach((el) => {
            if (el.children.length === 0) {
              const t = el.textContent?.trim();
              if (t && t.length > 5 && !t.toUpperCase().includes('ВЗНОС'))
                texts.push(t);
            }
          });
        if (texts.length > 0) parkingFee = texts.join(' ');
      }

      // ===================== GENERAL INFO =====================
      let generalInfo: string | null = null;
      const generalContainer = findSectionContainer([
        'ОБЩАЯ ИНФОРМАЦИЯ',
        'ALLGEMEINE INFORMATION',
        'GENERAL',
      ]);
      if (generalContainer) {
        const texts: string[] = [];
        generalContainer.querySelectorAll('p, div, span').forEach((el) => {
          if (el.children.length === 0) {
            const t = el.textContent?.trim();
            if (
              t &&
              t.length > 3 &&
              !t.toUpperCase().includes('ОБЩАЯ ИНФОРМАЦИЯ')
            )
              texts.push(t);
          }
        });
        if (texts.length > 0) generalInfo = texts.join('. ');
      }

      // ===================== DESCRIPTION (German text below equipment) =====================
      let description: string | null = null;
      if (equipContainer) {
        const allText: string[] = [];
        let foundList = false;
        Array.from(equipContainer.children).forEach((child) => {
          if (child.tagName === 'UL' || child.querySelector('ul, li')) {
            foundList = true;
            return;
          }
          if (foundList) {
            const t = child.textContent?.trim();
            if (t && t.length > 10) allText.push(t);
          }
        });
        if (allText.length > 0) description = allText.join('\n');
      }
      if (!description) {
        const descEl = document.querySelector(
          '[class*="description"], [class*="comment"], [class*="remark"]',
        );
        if (descEl) description = descEl.textContent?.trim() || null;
      }

      // ===================== AUCTION END DATE =====================
      let auctionEndDate: string | null = null;
      const bodyText = document.body?.innerText || '';
      const dateMatch = bodyText.match(
        /(?:Аукцион|Окончание|Auction|Ende|Endet)[:\s]*(\d{2}\.\d{2}\.\d{4}\s+\d{2}:\d{2})/i,
      );
      if (dateMatch) {
        auctionEndDate = dateMatch[1];
      } else {
        const timerEl = document.querySelector(
          '[class*="timer"], [class*="countdown"], [class*="end"]',
        );
        if (timerEl) {
          auctionEndDate = timerEl.textContent?.trim() || null;
        }
      }

      return {
        title,
        specs,
        imageUrls,
        price,
        description,
        auctionEndDate,
        equipment,
        sections: {
          accidentInfo,
          bodyCondition,
          interiorCondition,
          tires,
          seats,
          stoneChips,
          parkingFee,
          generalInfo,
        },
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
          waitUntil: 'domcontentloaded',
          timeout: 60000,
        });
        const status = response?.status();
        this.logger.log(`Navigation status: ${status}`);
        if (status && status >= 400 && status !== 403) {
          throw new Error(`HTTP ${status}`);
        }

        // Wait for network to settle (JS bundles to load)
        await this.page
          .waitForLoadState('networkidle', { timeout: 30000 })
          .catch(() => {
            this.logger.warn('networkidle timeout, continuing...');
          });

        // Handle cookie consent (OneTrust)
        await this.dismissCookieConsent();

        // Extra wait for SPA to render after JS bundles load
        await this.page.waitForTimeout(5000);
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

  private async dismissCookieConsent(): Promise<void> {
    try {
      // OneTrust cookie consent buttons (common patterns)
      const selectors = [
        '#onetrust-accept-btn-handler',
        'button[id*="accept"]',
        'button[class*="cookie"] button',
        'button:has-text("Akzeptieren")',
        'button:has-text("Принять")',
        'button:has-text("Accept")',
      ];

      for (const selector of selectors) {
        const btn = await this.page.$(selector);
        if (btn) {
          await btn.click();
          this.logger.log(`Cookie consent dismissed via: ${selector}`);
          await this.page.waitForTimeout(2000);
          break;
        }
      }
    } catch (error) {
      this.logger.debug(`Cookie consent handling: ${error.message}`);
    }

    // autobid.de shows a "browser not supported" overlay in headless mode
    // Click "Continue anyway" / "Продолжить в любом случае"
    try {
      const continueSelectors = [
        'text=Продолжить в любом случае',
        'text=Continue anyway',
        'text=Trotzdem fortfahren',
      ];
      for (const selector of continueSelectors) {
        const btn = await this.page.$(selector);
        if (btn) {
          await btn.click();
          this.logger.log(`Browser warning dismissed via: ${selector}`);
          await this.page.waitForTimeout(2000);
          break;
        }
      }
    } catch (error) {
      this.logger.debug(`Browser warning handling: ${error.message}`);
    }
  }

  /**
   * Scroll the page to trigger lazy-loaded content (condition sections, etc.)
   */
  private async scrollPageForLazyContent(): Promise<void> {
    try {
      await this.page.evaluate(async () => {
        let pos = 0;
        const maxScroll = document.body.scrollHeight;
        while (pos < maxScroll) {
          window.scrollTo(0, pos);
          pos += 500;
          await new Promise((r) => setTimeout(r, 200));
        }
        // scroll back to top
        window.scrollTo(0, 0);
      });
      await this.page.waitForTimeout(2000);
    } catch (error) {
      // ignore scroll errors
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

    // Last resort: wait longer for SPA to render
    this.logger.warn(
      'No vehicle content selectors matched, waiting 15s for SPA render...',
    );
    await this.page.waitForTimeout(15000);
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
