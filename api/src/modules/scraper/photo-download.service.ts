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
   * Save image URL references without downloading files.
   * Stores external URLs directly in the database.
   */
  createImageRefsFromUrls(
    imageUrls: string[],
    damageImageUrls: string[] = [],
  ): Partial<LotImage>[] {
    const galleryRefs = imageUrls
      .filter((url) => url && url.startsWith('http'))
      .map((url, index) => ({
        url,
        originalUrl: url,
        category: index === 0 ? ImageCategory.MAIN : ImageCategory.EXTERIOR,
        sortOrder: index,
      }));

    const damageStartIndex = galleryRefs.length;
    const damageRefs = damageImageUrls
      .filter((url) => url && url.startsWith('http'))
      .map((url, index) => ({
        url,
        originalUrl: url,
        category: ImageCategory.DAMAGE,
        sortOrder: damageStartIndex + index,
      }));

    return [...galleryRefs, ...damageRefs];
  }

  async downloadLotPhotos(
    lotId: string,
    vin: string,
    imageUrls: string[],
  ): Promise<Partial<LotImage>[]> {
    const lotDir = path.join(this.uploadDir, 'lots', lotId);
    await fs.promises.mkdir(lotDir, { recursive: true });

    const images: Partial<LotImage>[] = [];
    const safeVin = vin.replace(/[^a-zA-Z0-9_-]/g, '_');

    for (let i = 0; i < imageUrls.length; i++) {
      const url = imageUrls[i];
      if (!url) continue;

      const filename = `${safeVin}_${i + 1}.jpg`;
      const downloaded = await this.downloadFile(url, lotDir, filename);
      if (downloaded) {
        images.push({
          url: `${this.servePath}/lots/${lotId}/${filename}`,
          originalUrl: url,
          category: i === 0 ? ImageCategory.MAIN : ImageCategory.EXTERIOR,
          sortOrder: i,
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
      this.logger.debug(
        `Downloaded: ${filename} (${(response.data.length / 1024).toFixed(1)} KB)`,
      );
      return true;
    } catch (error) {
      this.logger.warn(`Failed to download ${url}: ${error.message}`);
      return false;
    }
  }

  private randomDelay(min: number, max: number): Promise<void> {
    const ms = Math.floor(Math.random() * (max - min + 1)) + min;
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
