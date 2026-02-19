import { IsEnum, IsNotEmpty, IsNumber, IsOptional, IsString, IsUUID } from 'class-validator';
import { BalanceTransactionType } from '../../../common/enums/balance-transaction-type.enum';

export class AdjustBalanceDto {
  @IsNumber()
  @IsNotEmpty()
  amount: number;

  @IsEnum(BalanceTransactionType)
  type: BalanceTransactionType;

  @IsString()
  @IsNotEmpty()
  description: string;

  @IsOptional()
  @IsUUID()
  orderId?: string;
}
