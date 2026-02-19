import { IsEnum, IsOptional, IsString, IsDateString } from 'class-validator';
import { OrderStatus } from '../../../common/enums/order-status.enum';

export class UpdateOrderStatusDto {
  @IsEnum(OrderStatus)
  status: OrderStatus;

  @IsOptional()
  @IsString()
  comment?: string;

  @IsOptional()
  @IsDateString()
  estimatedDate?: string;
}
