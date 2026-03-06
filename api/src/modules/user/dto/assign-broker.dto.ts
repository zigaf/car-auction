import { IsUUID, IsOptional, ValidateIf } from 'class-validator';

export class AssignBrokerDto {
  @ValidateIf((o) => o.brokerId !== null)
  @IsUUID()
  @IsOptional()
  brokerId: string | null;
}
