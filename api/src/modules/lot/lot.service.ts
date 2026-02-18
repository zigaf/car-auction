import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Lot } from '../../db/entities/lot.entity';

@Injectable()
export class LotService {
  constructor(
    @InjectRepository(Lot)
    private readonly lotRepository: Repository<Lot>,
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
}
