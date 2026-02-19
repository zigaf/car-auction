import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Order } from '../../db/entities/order.entity';
import { OrderStatusHistory } from '../../db/entities/order-status-history.entity';
import { OrderController } from './order.controller';
import { OrderService } from './order.service';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Order, OrderStatusHistory]),
    AuthModule,
  ],
  controllers: [OrderController],
  providers: [OrderService],
  exports: [OrderService],
})
export class OrderModule {}
