import { IsNotEmpty, IsOptional, IsUUID } from 'class-validator';

export class BuyNowDto {
  @IsUUID()
  @IsNotEmpty()
  lotId: string;

  @IsUUID()
  @IsOptional()
  traderId?: string;
}
