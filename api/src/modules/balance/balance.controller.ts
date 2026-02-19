import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  Query,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import { BalanceService } from './balance.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Role } from '../../common/enums/role.enum';
import { User } from '../../db/entities/user.entity';
import { AdjustBalanceDto } from './dto/adjust-balance.dto';
import { GetTransactionsDto } from './dto/get-transactions.dto';

@Controller('balance')
@UseGuards(JwtAuthGuard)
export class BalanceController {
  constructor(private readonly balanceService: BalanceService) {}

  @Get()
  getBalance(@CurrentUser() user: User) {
    return this.balanceService.getBalance(user.id);
  }

  @Get('transactions')
  getTransactions(
    @CurrentUser() user: User,
    @Query() query: GetTransactionsDto,
  ) {
    const page = parseInt(query.page || '1', 10);
    const limit = parseInt(query.limit || '20', 10);
    return this.balanceService.getTransactions(user.id, { page, limit });
  }

  @Post(':userId/adjust')
  @UseGuards(RolesGuard)
  @Roles(Role.MANAGER, Role.ADMIN)
  adjustBalance(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Body() dto: AdjustBalanceDto,
    @CurrentUser() manager: User,
  ) {
    return this.balanceService.adjustBalance(
      userId,
      dto.amount,
      dto.type,
      dto.description,
      manager.id,
      dto.orderId,
    );
  }
}
