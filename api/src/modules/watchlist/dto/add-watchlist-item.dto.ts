import { IsOptional, IsString, IsUUID, ValidateIf, IsDefined } from 'class-validator';

export class AddWatchlistItemDto {
  @IsOptional()
  @IsUUID()
  lotId?: string;

  @IsOptional()
  @IsString()
  brand?: string;

  @IsOptional()
  @IsString()
  model?: string;

  @ValidateIf((o) => !o.lotId && !o.brand && !o.model)
  @IsDefined({ message: 'At least one of lotId, brand, or model must be provided' })
  readonly _atLeastOne?: never;
}
