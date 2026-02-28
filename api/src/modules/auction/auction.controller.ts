import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import { AuctionService } from './auction.service';
import { AuctionGateway } from './auction.gateway';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Role } from '../../common/enums/role.enum';
import { User } from '../../db/entities/user.entity';
import { PlaceBidDto } from './dto/place-bid.dto';
import { BuyNowDto } from './dto/buy-now.dto';
import { PlacePreBidDto } from './dto/place-pre-bid.dto';
import { GetBidsDto } from './dto/get-bids.dto';

@Controller()
export class AuctionController {
  constructor(
    private readonly auctionService: AuctionService,
    private readonly auctionGateway: AuctionGateway,
  ) { }

  @Post('bids')
  @UseGuards(JwtAuthGuard)
  placeBid(@CurrentUser() user: User, @Body() dto: PlaceBidDto) {
    return this.auctionService.placeBid(
      user.id,
      dto.lotId,
      dto.amount,
      dto.idempotencyKey,
    );
  }

  @Post('bids/pre-bid')
  @UseGuards(JwtAuthGuard)
  placePreBid(@CurrentUser() user: User, @Body() dto: PlacePreBidDto) {
    return this.auctionService.placePreBid(
      user.id,
      dto.lotId,
      dto.maxAutoBid,
      dto.idempotencyKey,
    );
  }

  @Post('bids/buy-now')
  @UseGuards(JwtAuthGuard)
  buyNow(@CurrentUser() user: User, @Body() dto: BuyNowDto) {
    return this.auctionService.buyNow(user.id, dto.lotId);
  }

  @Get('bids/recent')
  getRecentGlobalBids(@Query('limit') limit?: string) {
    const parsedLimit = Math.min(Math.max(parseInt(limit || '50', 10), 1), 100);
    return this.auctionService.getRecentGlobalBids(parsedLimit);
  }

  @Get('bids/lot/:lotId')
  getBidsByLot(
    @Param('lotId', ParseUUIDPipe) lotId: string,
    @Query() query: GetBidsDto,
  ) {
    const page = Math.max(parseInt(query.page || '1', 10), 1);
    const limit = Math.min(Math.max(parseInt(query.limit || '20', 10), 1), 100);
    return this.auctionService.getBidsByLot(lotId, page, limit);
  }

  @Get('bids/my')
  @UseGuards(JwtAuthGuard)
  getMyBids(@CurrentUser() user: User, @Query() query: GetBidsDto) {
    const page = Math.max(parseInt(query.page || '1', 10), 1);
    const limit = Math.min(Math.max(parseInt(query.limit || '20', 10), 1), 100);
    return this.auctionService.getMyBids(user.id, page, limit);
  }

  @Get('auction/active')
  getActiveLots() {
    return this.auctionService.getActiveLots();
  }

  /** Admin: rollback the highest bid on a lot. */
  @Delete('admin/bids/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.MANAGER, Role.ADMIN)
  async rollbackBid(@Param('id', ParseUUIDPipe) id: string) {
    const result = await this.auctionService.rollbackBid(id);
    this.auctionGateway.emitBidRollback(result.lotId, id, result.newCurrentPrice);
    return result;
  }
}
