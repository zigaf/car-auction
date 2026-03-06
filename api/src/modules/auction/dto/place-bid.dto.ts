import { IsNotEmpty, IsNumber, IsOptional, IsPositive, IsString, IsUUID } from 'class-validator';

export class PlaceBidDto {
  @IsUUID()
  @IsNotEmpty()
  lotId: string;

  @IsNumber()
  @IsPositive()
  amount: number;

  @IsString()
  @IsNotEmpty()
  idempotencyKey: string;

  @IsUUID()
  @IsOptional()
  traderId?: string;
}
