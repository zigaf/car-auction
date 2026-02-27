import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, DeepPartial } from 'typeorm';
import { Lot } from '../../db/entities/lot.entity';
import { LotImage } from '../../db/entities/lot-image.entity';
import { LotStatus } from '../../common/enums/lot-status.enum';
import { FuelType } from '../../common/enums/fuel-type.enum';
import { ImageCategory } from '../../common/enums/image-category.enum';
import { CreateLotDto } from './dto/create-lot.dto';
import { UpdateLotDto, UpdateLotStatusDto } from './dto/update-lot.dto';
import { ScheduleLotDto } from './dto/schedule-lot.dto';

@Injectable()
export class LotService {
  constructor(
    @InjectRepository(Lot)
    private readonly lotRepository: Repository<Lot>,
    @InjectRepository(LotImage)
    private readonly imageRepository: Repository<LotImage>,
    private readonly dataSource: DataSource,
  ) {}

  async findAll(query: {
    page?: number;
    limit?: number;
    brand?: string;
    fuelType?: string;
    yearFrom?: number;
    yearTo?: number;
    priceFrom?: number;
    priceTo?: number;
    mileageFrom?: number;
    mileageTo?: number;
    country?: string;
    sort?: string;
    search?: string;
  }): Promise<{ data: Lot[]; total: number; page: number; limit: number }> {
    const page = query.page || 1;
    const limit = query.limit || 20;

    const qb = this.lotRepository
      .createQueryBuilder('lot')
      .leftJoinAndSelect('lot.images', 'images')
      .where('lot.deletedAt IS NULL');

    if (query.brand) {
      qb.andWhere('LOWER(lot.brand) = LOWER(:brand)', { brand: query.brand });
    }

    if (query.fuelType) {
      qb.andWhere('lot.fuelType = :fuelType', { fuelType: query.fuelType });
    }

    if (query.yearFrom) {
      qb.andWhere('lot.year >= :yearFrom', { yearFrom: query.yearFrom });
    }

    if (query.yearTo) {
      qb.andWhere('lot.year <= :yearTo', { yearTo: query.yearTo });
    }

    if (query.priceFrom) {
      qb.andWhere('lot.startingBid >= :priceFrom', { priceFrom: query.priceFrom });
    }

    if (query.priceTo) {
      qb.andWhere('lot.startingBid <= :priceTo', { priceTo: query.priceTo });
    }

    if (query.mileageFrom) {
      qb.andWhere('lot.mileage >= :mileageFrom', { mileageFrom: query.mileageFrom });
    }

    if (query.mileageTo) {
      qb.andWhere('lot.mileage <= :mileageTo', { mileageTo: query.mileageTo });
    }

    if (query.country) {
      qb.andWhere('lot.saleCountry = :country', { country: query.country });
    }

    if (query.search) {
      qb.andWhere(
        '(LOWER(lot.title) LIKE LOWER(:search) OR LOWER(lot.brand) LIKE LOWER(:search) OR LOWER(lot.model) LIKE LOWER(:search) OR lot.vin LIKE :search)',
        { search: `%${query.search}%` },
      );
    }

    // Sorting
    switch (query.sort) {
      case 'price_asc':
        qb.orderBy('lot.startingBid', 'ASC', 'NULLS LAST');
        break;
      case 'price_desc':
        qb.orderBy('lot.startingBid', 'DESC', 'NULLS LAST');
        break;
      case 'year_desc':
        qb.orderBy('lot.year', 'DESC', 'NULLS LAST');
        break;
      case 'mileage_asc':
        qb.orderBy('lot.mileage', 'ASC', 'NULLS LAST');
        break;
      default:
        qb.orderBy('lot.createdAt', 'DESC');
    }

    const [data, total] = await qb
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    return { data, total, page, limit };
  }

  async findById(id: string): Promise<Lot | null> {
    return this.lotRepository.findOne({
      where: { id },
      relations: ['images'],
    });
  }

  async getBrands(): Promise<{ brand: string; count: number }[]> {
    const result = await this.lotRepository
      .createQueryBuilder('lot')
      .select('lot.brand', 'brand')
      .addSelect('COUNT(*)', 'count')
      .where('lot.brand IS NOT NULL')
      .andWhere('lot.deletedAt IS NULL')
      .groupBy('lot.brand')
      .orderBy('count', 'DESC')
      .getRawMany();

    return result;
  }

  async getStats(): Promise<{
    totalLots: number;
    totalBrands: number;
    countries: number;
    withPhotos: number;
  }> {
    const totalLots = await this.lotRepository.count({
      where: { deletedAt: undefined },
    });

    const brandsResult = await this.lotRepository
      .createQueryBuilder('lot')
      .select('COUNT(DISTINCT lot.brand)', 'count')
      .where('lot.deletedAt IS NULL')
      .getRawOne();

    const countriesResult = await this.lotRepository
      .createQueryBuilder('lot')
      .select('COUNT(DISTINCT lot.saleCountry)', 'count')
      .where('lot.deletedAt IS NULL')
      .getRawOne();

    const withPhotos = await this.lotRepository
      .createQueryBuilder('lot')
      .innerJoin('lot.images', 'img')
      .where('lot.deletedAt IS NULL')
      .getCount();

    return {
      totalLots,
      totalBrands: parseInt(brandsResult?.count || '0', 10),
      countries: parseInt(countriesResult?.count || '0', 10),
      withPhotos,
    };
  }

  async create(dto: CreateLotDto, managerId: string): Promise<Lot> {
    const { images, auctionStartAt, auctionEndAt, ...lotData } = dto;

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const lot = queryRunner.manager.create(Lot, {
        ...lotData,
        createdBy: managerId,
        status: dto.status || LotStatus.ACTIVE,
        auctionStartAt: auctionStartAt ? new Date(auctionStartAt) : null,
        auctionEndAt: auctionEndAt ? new Date(auctionEndAt) : null,
      });

      const savedLot = await queryRunner.manager.save(Lot, lot);

      if (images && images.length > 0) {
        const lotImages = images.map((img, index) =>
          queryRunner.manager.create(LotImage, {
            lotId: savedLot.id,
            url: img.url,
            category: img.category || ImageCategory.EXTERIOR,
            sortOrder: img.sortOrder ?? index,
          }),
        );
        await queryRunner.manager.save(LotImage, lotImages);
      }

      await queryRunner.commitTransaction();

      return this.lotRepository.findOne({
        where: { id: savedLot.id },
        relations: ['images'],
      }) as Promise<Lot>;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async update(id: string, dto: UpdateLotDto): Promise<Lot> {
    const lot = await this.lotRepository.findOne({
      where: { id },
      relations: ['images'],
    });

    if (!lot) {
      throw new NotFoundException('Lot not found');
    }

    const { images, auctionStartAt, auctionEndAt, ...lotData } = dto;

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Update lot fields
      Object.assign(lot, lotData);
      if (auctionStartAt !== undefined) {
        lot.auctionStartAt = auctionStartAt ? new Date(auctionStartAt) : null;
      }
      if (auctionEndAt !== undefined) {
        lot.auctionEndAt = auctionEndAt ? new Date(auctionEndAt) : null;
      }

      await queryRunner.manager.save(Lot, lot);

      // Replace images if provided
      if (images !== undefined) {
        await queryRunner.manager.delete(LotImage, { lotId: id });

        if (images.length > 0) {
          const lotImages = images.map((img, index) =>
            queryRunner.manager.create(LotImage, {
              lotId: id,
              url: img.url,
              category: img.category || ImageCategory.EXTERIOR,
              sortOrder: img.sortOrder ?? index,
            }),
          );
          await queryRunner.manager.save(LotImage, lotImages);
        }
      }

      await queryRunner.commitTransaction();

      return this.lotRepository.findOne({
        where: { id },
        relations: ['images'],
      }) as Promise<Lot>;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async remove(id: string): Promise<void> {
    const lot = await this.lotRepository.findOne({ where: { id } });
    if (!lot) {
      throw new NotFoundException('Lot not found');
    }

    await this.lotRepository.softDelete(id);
  }

  async updateStatus(id: string, dto: UpdateLotStatusDto): Promise<Lot> {
    const lot = await this.lotRepository.findOne({
      where: { id },
      relations: ['images'],
    });

    if (!lot) {
      throw new NotFoundException('Lot not found');
    }

    // Validate status transitions
    const allowedTransitions: Record<LotStatus, LotStatus[]> = {
      [LotStatus.IMPORTED]: [LotStatus.ACTIVE, LotStatus.CANCELLED],
      [LotStatus.ACTIVE]: [LotStatus.TRADING, LotStatus.CANCELLED],
      [LotStatus.TRADING]: [LotStatus.SOLD, LotStatus.CANCELLED],
      [LotStatus.SOLD]: [],
      [LotStatus.CANCELLED]: [LotStatus.ACTIVE],
    };

    const allowed = allowedTransitions[lot.status];
    if (!allowed || !allowed.includes(dto.status)) {
      throw new BadRequestException(
        `Invalid status transition from '${lot.status}' to '${dto.status}'`,
      );
    }

    lot.status = dto.status;
    return this.lotRepository.save(lot);
  }

  async importFromCsv(
    csvContent: string,
    managerId: string,
  ): Promise<{ imported: number; skipped: number; errors: string[] }> {
    const lines = csvContent.split('\n').filter((line) => line.trim());
    if (lines.length < 2) {
      throw new BadRequestException('CSV file is empty or has no data rows');
    }

    const headers = lines[0].split(',').map((h) => h.trim().toLowerCase());
    const errors: string[] = [];
    let imported = 0;
    let skipped = 0;

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      for (let i = 1; i < lines.length; i++) {
        const values = this.parseCsvLine(lines[i]);
        if (values.length !== headers.length) {
          errors.push(`Row ${i}: column count mismatch`);
          skipped++;
          continue;
        }

        const row: Record<string, string> = {};
        headers.forEach((h, idx) => {
          row[h] = values[idx]?.trim() || '';
        });

        // Skip duplicates by sourceId if present
        if (row['source_id'] || row['sourceid']) {
          const sourceId = row['source_id'] || row['sourceid'];
          const existing = await queryRunner.manager.findOne(Lot, {
            where: { sourceId },
          });
          if (existing) {
            skipped++;
            continue;
          }
        }

        const title = row['title'] || `${row['brand'] || ''} ${row['model'] || ''}`.trim();
        if (!title) {
          errors.push(`Row ${i}: title or brand required`);
          skipped++;
          continue;
        }

        const rawFuel = row['fuel_type'] || row['fueltype'] || '';
        const fuelType = Object.values(FuelType).includes(rawFuel as FuelType)
          ? (rawFuel as FuelType)
          : undefined;

        const lotData: DeepPartial<Lot> = {
          title,
          brand: row['brand'] || undefined,
          model: row['model'] || undefined,
          year: row['year'] ? parseInt(row['year'], 10) : undefined,
          mileage: row['mileage'] ? parseInt(row['mileage'], 10) : undefined,
          fuelType,
          vin: row['vin'] || undefined,
          exteriorColor: row['color'] || row['exterior_color'] || undefined,
          startingBid: row['starting_bid'] || row['price']
            ? parseFloat(row['starting_bid'] || row['price'])
            : undefined,
          buyNowPrice: row['buy_now_price']
            ? parseFloat(row['buy_now_price'])
            : undefined,
          saleCountry: row['country'] || row['sale_country'] || undefined,
          description: row['description'] || undefined,
          transmission: row['transmission'] || undefined,
          sourceId: row['source_id'] || row['sourceid'] || undefined,
          createdBy: managerId,
          status: LotStatus.ACTIVE,
        };
        const lot = queryRunner.manager.create(Lot, lotData);

        await queryRunner.manager.save(Lot, lot);

        // Handle image URL if present
        const imageUrl = row['image_url'] || row['image'] || row['photo'];
        if (imageUrl) {
          const img = queryRunner.manager.create(LotImage, {
            lotId: lot.id,
            url: imageUrl,
            category: ImageCategory.EXTERIOR,
            sortOrder: 0,
          });
          await queryRunner.manager.save(LotImage, img);
        }

        imported++;
      }

      await queryRunner.commitTransaction();
      return { imported, skipped, errors };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async scheduleLot(id: string, dto: ScheduleLotDto): Promise<Lot> {
    const lot = await this.lotRepository.findOne({
      where: { id },
      relations: ['images'],
    });
    if (!lot) throw new NotFoundException('Lot not found');

    const startAt = new Date(dto.auctionStartAt);
    const endAt = new Date(dto.auctionEndAt);

    if (endAt <= startAt) {
      throw new BadRequestException('auctionEndAt must be after auctionStartAt');
    }
    if (endAt <= new Date()) {
      throw new BadRequestException('auctionEndAt must be in the future');
    }

    lot.auctionStartAt = startAt;
    lot.auctionEndAt = endAt;
    if (dto.auctionType) lot.auctionType = dto.auctionType;

    // Ensure the lot is in ACTIVE state so the auto-start cron can pick it up
    if (lot.status === LotStatus.IMPORTED) {
      lot.status = LotStatus.ACTIVE;
    }

    return this.lotRepository.save(lot);
  }

  private parseCsvLine(line: string): string[] {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        result.push(current);
        current = '';
      } else {
        current += char;
      }
    }
    result.push(current);
    return result;
  }
}
