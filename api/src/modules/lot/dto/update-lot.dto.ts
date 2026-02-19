import { PartialType } from '@nestjs/mapped-types';
import { IsEnum, IsNotEmpty } from 'class-validator';
import { CreateLotDto } from './create-lot.dto';
import { LotStatus } from '../../../common/enums/lot-status.enum';

export class UpdateLotDto extends PartialType(CreateLotDto) {}

export class UpdateLotStatusDto {
  @IsEnum(LotStatus)
  @IsNotEmpty()
  status: LotStatus;
}
