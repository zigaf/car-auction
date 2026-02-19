import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsNumber,
  IsPositive,
  IsEnum,
  IsDateString,
  IsArray,
  ValidateNested,
  IsUrl,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { FuelType } from '../../../common/enums/fuel-type.enum';
import { AuctionType } from '../../../common/enums/auction-type.enum';
import { LotStatus } from '../../../common/enums/lot-status.enum';
import { ImageCategory } from '../../../common/enums/image-category.enum';

export class CreateLotImageDto {
  @IsUrl()
  @IsNotEmpty()
  url: string;

  @IsEnum(ImageCategory)
  @IsOptional()
  category?: ImageCategory;

  @IsNumber()
  @IsOptional()
  sortOrder?: number;
}

export class CreateLotDto {
  @IsString()
  @IsNotEmpty()
  title: string;

  @IsString()
  @IsNotEmpty()
  brand: string;

  @IsString()
  @IsOptional()
  model?: string;

  @IsString()
  @IsOptional()
  derivative?: string;

  @IsNumber()
  @IsOptional()
  year?: number;

  @IsNumber()
  @IsOptional()
  @Min(0)
  mileage?: number;

  @IsEnum(FuelType)
  @IsOptional()
  fuelType?: FuelType;

  @IsNumber()
  @IsOptional()
  enginePowerKw?: number;

  @IsNumber()
  @IsOptional()
  enginePowerPs?: number;

  @IsString()
  @IsOptional()
  vin?: string;

  @IsString()
  @IsOptional()
  exteriorColor?: string;

  @IsString()
  @IsOptional()
  vehicleType?: string;

  @IsString()
  @IsOptional()
  transmission?: string;

  @IsString()
  @IsOptional()
  saleCountry?: string;

  @IsString()
  @IsOptional()
  saleLocation?: string;

  @IsString()
  @IsOptional()
  description?: string;

  // Pricing
  @IsNumber()
  @IsOptional()
  @IsPositive()
  startingBid?: number;

  @IsNumber()
  @IsOptional()
  @IsPositive()
  buyNowPrice?: number;

  @IsNumber()
  @IsOptional()
  @IsPositive()
  reservePrice?: number;

  @IsNumber()
  @IsOptional()
  @IsPositive()
  bidStep?: number;

  // Auction
  @IsEnum(AuctionType)
  @IsOptional()
  auctionType?: AuctionType;

  @IsDateString()
  @IsOptional()
  auctionStartAt?: string;

  @IsDateString()
  @IsOptional()
  auctionEndAt?: string;

  @IsEnum(LotStatus)
  @IsOptional()
  status?: LotStatus;

  // Condition
  @IsString()
  @IsOptional()
  cosmeticGrade?: string;

  @IsString()
  @IsOptional()
  mechanicalGrade?: string;

  // Images
  @IsArray()
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => CreateLotImageDto)
  images?: CreateLotImageDto[];
}
