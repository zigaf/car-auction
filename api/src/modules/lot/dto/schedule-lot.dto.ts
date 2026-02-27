import { IsDateString, IsEnum, IsOptional } from 'class-validator';
import { AuctionType } from '../../../common/enums/auction-type.enum';

export class ScheduleLotDto {
  @IsDateString()
  auctionStartAt: string;

  @IsDateString()
  auctionEndAt: string;

  @IsOptional()
  @IsEnum(AuctionType)
  auctionType?: AuctionType;
}
