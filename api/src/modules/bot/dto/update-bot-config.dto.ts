import {
  IsNumber,
  IsEnum,
  IsOptional,
  IsBoolean,
  IsInt,
  Min,
  Max,
} from 'class-validator';
import { BotPattern } from '../../../db/entities/auction-bot-config.entity';

export class UpdateBotConfigDto {
  @IsOptional()
  @IsNumber()
  @Min(0)
  maxPrice?: number;

  @IsOptional()
  @IsEnum(BotPattern)
  pattern?: BotPattern;

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
