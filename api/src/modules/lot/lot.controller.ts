import { Controller, Get, Param, Query, NotFoundException } from '@nestjs/common';
import { LotService } from './lot.service';

@Controller('lots')
export class LotController {
  constructor(private readonly lotService: LotService) {}

  @Get()
  async findAll(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('brand') brand?: string,
    @Query('fuelType') fuelType?: string,
    @Query('yearFrom') yearFrom?: number,
    @Query('yearTo') yearTo?: number,
    @Query('priceFrom') priceFrom?: number,
    @Query('priceTo') priceTo?: number,
    @Query('mileageFrom') mileageFrom?: number,
    @Query('mileageTo') mileageTo?: number,
    @Query('country') country?: string,
    @Query('sort') sort?: string,
    @Query('search') search?: string,
  ) {
    return this.lotService.findAll({
      page,
      limit,
      brand,
      fuelType,
      yearFrom,
      yearTo,
      priceFrom,
      priceTo,
      mileageFrom,
      mileageTo,
      country,
      sort,
      search,
    });
  }

  @Get('brands')
  async getBrands() {
    return this.lotService.getBrands();
  }

  @Get('stats')
  async getStats() {
    return this.lotService.getStats();
  }

  @Get(':id')
  async findById(@Param('id') id: string) {
    const lot = await this.lotService.findById(id);
    if (!lot) {
      throw new NotFoundException('Lot not found');
    }
    return lot;
  }
}
