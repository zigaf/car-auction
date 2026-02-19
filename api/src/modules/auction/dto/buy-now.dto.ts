import { IsNotEmpty, IsUUID } from 'class-validator';

export class BuyNowDto {
  @IsUUID()
  @IsNotEmpty()
  lotId: string;
}
