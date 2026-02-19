import { IsNotEmpty, IsNumber, IsPositive, IsString, IsUUID } from 'class-validator';

export class PlacePreBidDto {
  @IsUUID()
  @IsNotEmpty()
  lotId: string;

  @IsNumber()
  @IsPositive()
  maxAutoBid: number;

  @IsString()
  @IsNotEmpty()
  idempotencyKey: string;
}
