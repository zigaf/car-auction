import {
  IsUUID,
  IsNumber,
  IsEnum,
  IsOptional,
  IsBoolean,
  IsInt,
  Min,
  Max,
} from 'class-validator';
import { BotPattern } from '../../../db/entities/auction-bot-config.entity';

export class CreateBotConfigDto {
  @IsUUID()
  lotId: string;

  @IsUUID()
  botUserId: string;

  @IsNumber()
  @Min(0)
  maxPrice: number;

  @IsEnum(BotPattern)
  pattern: BotPattern;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(600)
  minDelaySec?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(600)
  maxDelaySec?: number;
}
