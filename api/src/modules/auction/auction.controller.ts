import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import { AuctionService } from './auction.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User } from '../../db/entities/user.entity';
import { PlaceBidDto } from './dto/place-bid.dto';
import { BuyNowDto } from './dto/buy-now.dto';
import { PlacePreBidDto } from './dto/place-pre-bid.dto';
import { GetBidsDto } from './dto/get-bids.dto';

@Controller()
export class AuctionController {
  constructor(private readonly auctionService: AuctionService) {}

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
}
