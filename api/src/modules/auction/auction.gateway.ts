import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Server, Socket } from 'socket.io';
import { AuctionService, PlaceBidResult } from './auction.service';

interface PlaceBidPayload {
  lotId: string;
  amount: number;
  idempotencyKey: string;
}

interface PlacePreBidPayload {
  lotId: string;
  maxAutoBid: number;
}

const WS_CORS_ORIGINS = [
  'http://localhost:4200',
  'http://localhost:4000',
  'https://car-auction-production-5f48.up.railway.app',
];

@WebSocketGateway({
  cors: { origin: WS_CORS_ORIGINS, credentials: true },
  namespace: '/auction',
})
export class AuctionGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(AuctionGateway.name);

  constructor(
    private readonly auctionService: AuctionService,
    private readonly jwtService: JwtService,
  ) {}

  handleConnection(client: Socket) {
    try {
      const token = client.handshake.auth?.token as string | undefined;
      if (!token) {
        this.logger.warn(`Client ${client.id} connected without token, disconnecting`);
        client.disconnect(true);
        return;
      }

      const payload = this.jwtService.verify(token, {
        secret: process.env.JWT_ACCESS_SECRET || 'dev-access-secret',
      });

      const userId = payload.sub as string;
      if (!userId) {
        this.logger.warn(`Client ${client.id} token missing sub claim, disconnecting`);
        client.disconnect(true);
        return;
      }

      client.data.userId = userId;
      this.logger.log(`Client connected: ${client.id} (user: ${userId})`);
    } catch (error) {
      this.logger.warn(`Client ${client.id} invalid token, disconnecting`);
      client.disconnect(true);
    }
  }

  async handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
    // Update watcher count for the room this client was watching
    if (client.data.joinedLotId) {
      const room = `auction:${client.data.joinedLotId}`;
      const sockets = await this.server.in(room).fetchSockets();
      this.server.to(room).emit('watcher_count', {
        lotId: client.data.joinedLotId,
        count: sockets.length,
      });
    }
  }

  @SubscribeMessage('join_auction')
  async handleJoinAuction(
    @ConnectedSocket() client: Socket,
    @MessageBody() lotId: string,
  ) {
    const room = `auction:${lotId}`;
    await client.join(room);
    client.data.joinedLotId = lotId;
    this.logger.log(`Client ${client.id} joined room ${room}`);

    // Broadcast updated watcher count to all in the room
    const sockets = await this.server.in(room).fetchSockets();
    this.server.to(room).emit('watcher_count', { lotId, count: sockets.length });

    return { event: 'joined', data: { lotId, room } };
  }

  @SubscribeMessage('leave_auction')
  async handleLeaveAuction(
    @ConnectedSocket() client: Socket,
    @MessageBody() lotId: string,
  ) {
    const room = `auction:${lotId}`;
    await client.leave(room);
    if (client.data.joinedLotId === lotId) {
      client.data.joinedLotId = null;
    }
    this.logger.log(`Client ${client.id} left room ${room}`);

    // Broadcast updated watcher count
    const sockets = await this.server.in(room).fetchSockets();
    this.server.to(room).emit('watcher_count', { lotId, count: sockets.length });

    return { event: 'left', data: { lotId, room } };
  }

  @SubscribeMessage('join_feed')
  handleJoinFeed(
    @ConnectedSocket() client: Socket,
    @MessageBody() feedId: string,
  ) {
    const room = `feed:${feedId}`;
    client.join(room);
    this.logger.log(`Client ${client.id} joined feed ${room}`);
    return { event: 'joined_feed', data: { feedId, room } };
  }

  @SubscribeMessage('leave_feed')
  handleLeaveFeed(
    @ConnectedSocket() client: Socket,
    @MessageBody() feedId: string,
  ) {
    const room = `feed:${feedId}`;
    client.leave(room);
    this.logger.log(`Client ${client.id} left feed ${room}`);
    return { event: 'left_feed', data: { feedId, room } };
  }

  @SubscribeMessage('place_bid')
  async handlePlaceBid(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: PlaceBidPayload,
  ) {
    try {
      const userId = client.data.userId as string | undefined;

      if (!userId) {
        return { event: 'bid_error', data: { message: 'Authentication required' } };
      }

      const result: PlaceBidResult = await this.auctionService.placeBid(
        userId,
        payload.lotId,
        payload.amount,
        payload.idempotencyKey,
      );

      const room = `auction:${payload.lotId}`;
      const anonymizedBidder = `bidder-${userId.slice(-4)}`;
      const lotTitle = (result.bid as any).lot?.title || `Lot ${payload.lotId.slice(0, 8)}`;

      // Emit initial manual bid to auction room
      this.server.to(room).emit('bid_update', {
        lotId: payload.lotId,
        amount: result.bid.amount,
        bidderFlag: anonymizedBidder,
        userId,
        isAutoBid: false,
        lotTitle,
        timestamp: result.bid.createdAt,
      });

      // Emit anti-sniping extension if triggered
      if (result.auctionExtended && result.newEndAt) {
        this.server.to(room).emit('auction_extended', {
          lotId: payload.lotId,
          newEndAt: result.newEndAt,
        });
      }

      // Emit bid_update for each auto-bid so all clients see the full price chain
      for (const autoBid of result.autoBids) {
        const autoBidderFlag = `bidder-${autoBid.userId.slice(-4)}`;
        this.server.to(room).emit('bid_update', {
          lotId: payload.lotId,
          amount: autoBid.amount,
          bidderFlag: autoBidderFlag,
          userId: autoBid.userId,
          isAutoBid: true,
          lotTitle,
          timestamp: autoBid.createdAt,
        });
        this.server.to('feed:global').emit('feed_update', {
          lotId: payload.lotId,
          amount: autoBid.amount,
          bidderFlag: autoBidderFlag,
          userId: autoBid.userId,
          isAutoBid: true,
          lotTitle,
          timestamp: autoBid.createdAt,
        });
      }

      // Emit initial bid to global feed
      this.server.to('feed:global').emit('feed_update', {
        lotId: payload.lotId,
        amount: result.bid.amount,
        bidderFlag: anonymizedBidder,
        userId,
        isAutoBid: false,
        lotTitle,
        timestamp: result.bid.createdAt,
      });

      return { event: 'bid_placed', data: result.bid };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to place bid';
      return { event: 'bid_error', data: { message } };
    }
  }

  @SubscribeMessage('place_pre_bid')
  async handlePlacePreBid(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: PlacePreBidPayload,
  ) {
    try {
      const userId = client.data.userId as string | undefined;

      if (!userId) {
        return { event: 'bid_error', data: { message: 'Authentication required' } };
      }

      const idempotencyKey = `pre:${payload.lotId}:${userId}:${Date.now()}`;
      const result: PlaceBidResult = await this.auctionService.placePreBid(
        userId,
        payload.lotId,
        payload.maxAutoBid,
        idempotencyKey,
      );

      const room = `auction:${payload.lotId}`;
      const anonymizedBidder = `bidder-${userId.slice(-4)}`;
      const lotTitle = (result.bid as any).lot?.title || `Lot ${payload.lotId.slice(0, 8)}`;

      this.server.to(room).emit('bid_update', {
        lotId: payload.lotId,
        amount: result.bid.amount,
        bidderFlag: anonymizedBidder,
        userId,
        isAutoBid: true,
        lotTitle,
        timestamp: result.bid.createdAt,
      });

      if (result.auctionExtended && result.newEndAt) {
        this.server.to(room).emit('auction_extended', {
          lotId: payload.lotId,
          newEndAt: result.newEndAt,
        });
      }

      // Emit bid_update for each auto-bid in the chain
      for (const autoBid of result.autoBids) {
        const autoBidderFlag = `bidder-${autoBid.userId.slice(-4)}`;
        this.server.to(room).emit('bid_update', {
          lotId: payload.lotId,
          amount: autoBid.amount,
          bidderFlag: autoBidderFlag,
          userId: autoBid.userId,
          isAutoBid: true,
          lotTitle,
          timestamp: autoBid.createdAt,
        });
        this.server.to('feed:global').emit('feed_update', {
          lotId: payload.lotId,
          amount: autoBid.amount,
          bidderFlag: autoBidderFlag,
          userId: autoBid.userId,
          isAutoBid: true,
          lotTitle,
          timestamp: autoBid.createdAt,
        });
      }

      this.server.to('feed:global').emit('feed_update', {
        lotId: payload.lotId,
        amount: result.bid.amount,
        bidderFlag: anonymizedBidder,
        userId,
        isAutoBid: true,
        lotTitle,
        timestamp: result.bid.createdAt,
      });

      return { event: 'bid_placed', data: result.bid };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to place pre-bid';
      return { event: 'bid_error', data: { message } };
    }
  }

  /**
   * Emit auction ended event to the room.
   * Called externally (e.g., from a cron job or service) when an auction concludes.
   */
  emitAuctionEnded(lotId: string, winnerId: string | null, finalPrice: number) {
    const room = `auction:${lotId}`;
    this.server.to(room).emit('auction_ended', {
      lotId,
      winnerId,
      finalPrice,
    });

    this.server.to('feed:global').emit('auction_ended', {
      lotId,
      winnerId,
      finalPrice,
    });
  }
}
