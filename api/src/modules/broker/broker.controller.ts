import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Query,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import { BrokerService } from './broker.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Role } from '../../common/enums/role.enum';
import { User } from '../../db/entities/user.entity';

@Controller('broker')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.BROKER, Role.ADMIN)
export class BrokerController {
  constructor(private readonly brokerService: BrokerService) {}

  @Get('traders')
  getMyTraders(@CurrentUser() user: User) {
    return this.brokerService.getMyTraders(user.id);
  }

  @Get('traders/:traderId/favorites')
  getTraderFavorites(
    @CurrentUser() user: User,
    @Param('traderId', ParseUUIDPipe) traderId: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.brokerService.getTraderFavorites(user.id, traderId, {
      page: Math.max(parseInt(page || '1', 10), 1),
      limit: Math.min(Math.max(parseInt(limit || '20', 10), 1), 100),
    });
  }

  @Post('traders/:traderId/favorites/:lotId')
  addToTraderFavorites(
    @CurrentUser() user: User,
    @Param('traderId', ParseUUIDPipe) traderId: string,
    @Param('lotId', ParseUUIDPipe) lotId: string,
  ) {
    return this.brokerService.addToTraderWishlist(user.id, traderId, lotId);
  }

  @Delete('traders/:traderId/favorites/:lotId')
  removeFromTraderFavorites(
    @CurrentUser() user: User,
    @Param('traderId', ParseUUIDPipe) traderId: string,
    @Param('lotId', ParseUUIDPipe) lotId: string,
  ) {
    return this.brokerService.removeFromTraderWishlist(user.id, traderId, lotId);
  }
}
