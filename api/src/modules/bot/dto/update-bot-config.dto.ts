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

  /** Bid step multiplier (e.g. 1.0 = one step, 2.0 = two steps per bid). */
  @IsOptional()
  @IsNumber()
  @Min(0.1)
  @Max(10)
  intensity?: number;

  /** Minutes before auction end when bot starts bidding (SNIPER / RANDOM). Null resets to default 0.5 min. */
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(60)
  startMinutesBeforeEnd?: number | null;
}
