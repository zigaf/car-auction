import {
  IsNumber,
  IsPositive,
  IsEnum,
  IsOptional,
  Min,
  Max,
} from 'class-validator';

export enum FuelTypeCalc {
  PETROL = 'petrol',
  DIESEL = 'diesel',
  HYBRID = 'hybrid',
  ELECTRIC = 'electric',
}

export class CalculateCustomsDto {
  /** Стоимость автомобиля в EUR */
  @IsNumber()
  @IsPositive()
  carPrice: number;

  /** Год выпуска */
  @IsNumber()
  @Min(1990)
  @Max(new Date().getFullYear())
  year: number;

  /** Объём двигателя в см³ (0 для электро) */
  @IsNumber()
  @Min(0)
  @Max(8000)
  engineVolume: number;

  /** Тип топлива */
  @IsEnum(FuelTypeCalc)
  fuelType: FuelTypeCalc;

  /** Стоимость доставки в EUR (необязательно, по умолчанию 0) */
  @IsOptional()
  @IsNumber()
  @Min(0)
  deliveryCost?: number;

  /** Комиссия компании в EUR (необязательно, по умолчанию 0) */
  @IsOptional()
  @IsNumber()
  @Min(0)
  companyCost?: number;
}
