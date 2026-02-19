import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Query,
  Body,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  ParseUUIDPipe,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { LotService } from './lot.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Role } from '../../common/enums/role.enum';
import { User } from '../../db/entities/user.entity';
import { CreateLotDto } from './dto/create-lot.dto';
import { UpdateLotDto, UpdateLotStatusDto } from './dto/update-lot.dto';

@Controller('lots')
export class LotController {
  constructor(private readonly lotService: LotService) {}

  // --- Public endpoints ---

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
  async findById(@Param('id', ParseUUIDPipe) id: string) {
    const lot = await this.lotService.findById(id);
    if (!lot) {
      throw new NotFoundException('Lot not found');
    }
    return lot;
  }

  // --- Manager endpoints ---

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.MANAGER, Role.ADMIN)
  async create(@CurrentUser() user: User, @Body() dto: CreateLotDto) {
    return this.lotService.create(dto, user.id);
  }

  @Post('import')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.MANAGER, Role.ADMIN)
  @UseInterceptors(FileInterceptor('file'))
  async importCsv(
    @CurrentUser() user: User,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) {
      throw new BadRequestException('CSV file is required');
    }

    const csvContent = file.buffer.toString('utf-8');
    return this.lotService.importFromCsv(csvContent, user.id);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.MANAGER, Role.ADMIN)
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateLotDto,
  ) {
    return this.lotService.update(id, dto);
  }

  @Patch(':id/status')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.MANAGER, Role.ADMIN)
  async updateStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateLotStatusDto,
  ) {
    return this.lotService.updateStatus(id, dto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.MANAGER, Role.ADMIN)
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    await this.lotService.remove(id);
    return { message: 'Lot deleted' };
  }
}
