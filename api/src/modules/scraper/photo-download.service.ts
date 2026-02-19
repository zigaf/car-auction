import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import * as fs from 'fs';
import * as path from 'path';
import { LotImage } from '../../db/entities/lot-image.entity';
import { ImageCategory } from '../../common/enums/image-category.enum';

@Injectable()
export class PhotoDownloadService {
  private readonly logger = new Logger(PhotoDownloadService.name);
  private readonly uploadDir: string;
  private readonly servePath: string;

  constructor(private readonly httpService: HttpService) {
    this.uploadDir = process.env.UPLOAD_DIR || './uploads';
    this.servePath = process.env.UPLOAD_SERVE_PATH || '/uploads';
  }

  /**
   * Save image URL references from BCA API response without downloading files.
   * This is the fast path used during scraping — images are stored as external URLs.
   */
  createImageRefsFromApi(
    previewImageUrl: string | null,
    imageKey: string | null,
  ): Partial<LotImage>[] {
    const images: Partial<LotImage>[] = [];

    if (previewImageUrl) {
      const normalizedUrl = this.normalizeUrl(previewImageUrl);
      images.push({
        url: normalizedUrl,
        originalUrl: normalizedUrl,
        category: ImageCategory.MAIN,
        sortOrder: 0,
      });
    }

    // Construct higher-resolution image URL from imageKey if available
    if (imageKey) {
      const hiResUrl = `https://www1.bcaimage.com/GetDoc.aspx?DocType=VehicleImage&docId=${imageKey}`;
      images.push({
        url: hiResUrl,
        originalUrl: hiResUrl,
        bcaDocId: imageKey,
        category: ImageCategory.EXTERIOR,
        sortOrder: 1,
      });
    }

    return images;
  }

  async downloadLotPhotos(
    lotId: string,
    vin: string,
    docIds: string[],
    previewImageUrl: string | null,
  ): Promise<Partial<LotImage>[]> {
    const lotDir = path.join(this.uploadDir, 'lots', lotId);
    await fs.promises.mkdir(lotDir, { recursive: true });

    const images: Partial<LotImage>[] = [];
    const safeVin = vin.replace(/[^a-zA-Z0-9_-]/g, '_');

    // Download preview image
    if (previewImageUrl) {
      const normalizedUrl = this.normalizeUrl(previewImageUrl);
      const filename = `${safeVin}_preview.jpg`;
      const downloaded = await this.downloadFile(normalizedUrl, lotDir, filename);
      if (downloaded) {
        images.push({
          url: `${this.servePath}/lots/${lotId}/${filename}`,
          originalUrl: normalizedUrl,
          category: ImageCategory.MAIN,
          sortOrder: 0,
        });
      }
    }

    // Download gallery photos from docIds
    for (let i = 0; i < docIds.length; i++) {
      const cdnUrl = `https://www1.bcaimage.com/GetDoc.aspx?DocType=VehicleImage&docId=${docIds[i]}`;
      const filename = `${safeVin}_gallery_${i + 1}.jpg`;
      const downloaded = await this.downloadFile(cdnUrl, lotDir, filename);
      if (downloaded) {
        images.push({
          url: `${this.servePath}/lots/${lotId}/${filename}`,
          originalUrl: cdnUrl,
          bcaDocId: docIds[i],
          category: ImageCategory.EXTERIOR,
          sortOrder: i + 1,
        });
      }

      // Rate limit between image downloads
      await this.randomDelay(
        parseInt(process.env.SCRAPER_IMAGE_DELAY_MIN || '1000', 10),
        parseInt(process.env.SCRAPER_IMAGE_DELAY_MAX || '3000', 10),
      );
    }

    return images;
  }

  private async downloadFile(
    url: string,
    dir: string,
    filename: string,
  ): Promise<boolean> {
    try {
      const response = await firstValueFrom(
        this.httpService.get(url, {
          responseType: 'arraybuffer',
          timeout: 30000,
        }),
      );
      const filePath = path.join(dir, filename);
      await fs.promises.writeFile(filePath, response.data);
      this.logger.debug(`Downloaded: ${filename} (${(response.data.length / 1024).toFixed(1)} KB)`);
      return true;
    } catch (error) {
      this.logger.warn(`Failed to download ${url}: ${error.message}`);
      return false;
    }
  }

  private normalizeUrl(url: string): string {
    if (url.startsWith('//')) {
      return 'https:' + url;
    }
    return url;
  }

  private randomDelay(min: number, max: number): Promise<void> {
    const ms = Math.floor(Math.random() * (max - min + 1)) + min;
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
