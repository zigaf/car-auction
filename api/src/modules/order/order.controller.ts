import {
  Controller,
  Get,
  Patch,
  Param,
  Body,
  Query,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import { OrderService } from './order.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Role } from '../../common/enums/role.enum';
import { User } from '../../db/entities/user.entity';
import { GetOrdersDto } from './dto/get-orders.dto';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';

@Controller('orders')
@UseGuards(JwtAuthGuard)
export class OrderController {
  constructor(private readonly orderService: OrderService) {}

  @Get()
  getOrders(
    @CurrentUser() user: User,
    @Query() query: GetOrdersDto,
  ) {
    const page = Math.max(parseInt(query.page || '1', 10), 1);
    const limit = Math.min(Math.max(parseInt(query.limit || '20', 10), 1), 100);

    if (user.role === Role.MANAGER || user.role === Role.ADMIN) {
      return this.orderService.getAllOrders({ page, limit });
    }

    return this.orderService.getMyOrders(user.id, { page, limit });
  }

  @Get(':id')
  getOrderById(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: User,
  ) {
    const isManager =
      user.role === Role.MANAGER || user.role === Role.ADMIN;
    return this.orderService.getOrderById(id, user.id, isManager);
  }

  @Patch(':id/status')
  @UseGuards(RolesGuard)
  @Roles(Role.MANAGER, Role.ADMIN)
  updateStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateOrderStatusDto,
    @CurrentUser() manager: User,
  ) {
    return this.orderService.updateStatus(
      id,
      manager.id,
      dto.status,
      dto.comment,
      dto.estimatedDate,
    );
  }

  @Get(':id/tracking')
  getOrderTracking(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: User,
  ) {
    const isManager =
      user.role === Role.MANAGER || user.role === Role.ADMIN;
    return this.orderService.getOrderTracking(id, user.id, isManager);
  }
}
