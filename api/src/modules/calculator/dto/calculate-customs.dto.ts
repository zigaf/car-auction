import {
  IsNumber,
  IsPositive,
  IsEnum,
  IsOptional,
  IsString,
  Min,
  Max,
} from 'class-validator';
import { Type } from 'class-transformer';

export enum FuelTypeCalc {
  PETROL = 'petrol',
  DIESEL = 'diesel',
  HYBRID = 'hybrid',
  ELECTRIC = 'electric',
}

export enum CalcCountry {
  RUSSIA = 'russia',
  BELARUS = 'belarus',
}

export class CalculateCustomsDto {
  @IsEnum(CalcCountry)
  country: CalcCountry;

  @Type(() => Number)
  @IsNumber()
  @IsPositive()
  carPrice: number;

  @Type(() => Number)
  @IsNumber()
  @Min(1990)
  @Max(new Date().getFullYear())
  year: number;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(8000)
  engineVolume: number;

  @IsEnum(FuelTypeCalc)
  fuelType: FuelTypeCalc;

  @IsOptional()
  @IsString()
  originCountry?: string;

  @IsOptional()
  @IsString()
  destinationCountry?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  deliveryCost?: number;
}
