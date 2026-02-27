import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuctionBotConfig, BotPattern } from '../../db/entities/auction-bot-config.entity';
import { Bid } from '../../db/entities/bid.entity';
import { Lot } from '../../db/entities/lot.entity';
import { LotStatus } from '../../common/enums/lot-status.enum';
import { AuctionService } from '../auction/auction.service';
import { AuctionGateway } from '../auction/auction.gateway';

function randMs(minSec: number, maxSec: number): number {
  return (Math.random() * (maxSec - minSec) + minSec) * 1000;
}

@Injectable()
export class BotEngineService {
  private readonly logger = new Logger(BotEngineService.name);

  /** Timestamp of the last bid the bot placed for each configId */
  private readonly lastBidAt = new Map<string, number>();

  /** Pre-computed random delay (ms) for RANDOM pattern */
  private readonly nextRandomDelay = new Map<string, number>();

  private ticking = false;

  constructor(
    @InjectRepository(AuctionBotConfig)
    private readonly configRepository: Repository<AuctionBotConfig>,
    @InjectRepository(Bid)
    private readonly bidRepository: Repository<Bid>,
    @InjectRepository(Lot)
    private readonly lotRepository: Repository<Lot>,
    private readonly auctionService: AuctionService,
    private readonly auctionGateway: AuctionGateway,
  ) {}

  @Cron(CronExpression.EVERY_5_SECONDS)
  async tick(): Promise<void> {
    if (this.ticking) return;
    this.ticking = true;

    try {
      const configs = await this.configRepository.find({
        where: { isActive: true },
        relations: ['lot'],
      });

      for (const config of configs) {
        if (!config.lot || config.lot.status !== LotStatus.TRADING) continue;

        await this.processConfig(config).catch((err) =>
          this.logger.error(`Bot tick error for config ${config.id}`, err),
        );
      }
    } finally {
      this.ticking = false;
    }
  }

  private async processConfig(config: AuctionBotConfig): Promise<void> {
    const lot = await this.lotRepository.findOne({
      where: { id: config.lotId },
    });
    if (!lot || lot.status !== LotStatus.TRADING) return;

    const currentPrice = parseFloat(String(lot.currentPrice ?? lot.startingBid ?? 0));
    const maxPrice = parseFloat(String(config.maxPrice));

    // Stop bidding if the current price already meets or exceeds our cap
    if (currentPrice >= maxPrice) return;

    // Find the most recent bid on this lot to see if the bot is leading
    const latestBid = await this.bidRepository.findOne({
      where: { lotId: config.lotId },
      order: { amount: 'DESC', createdAt: 'ASC' },
    });
    const botIsLeading = latestBid?.userId === config.botUserId;

    const now = Date.now();
    const bidStep = parseFloat(String(lot.bidStep)) || 100;
    const bidAmount = currentPrice + bidStep;

    if (bidAmount > maxPrice) return;

    if (!this.shouldBid(config, lot, botIsLeading, now)) return;

    // Place the bid via AuctionService (balance check is skipped for bots)
    const idempotencyKey = `bot:${config.id}:${now}`;
    try {
      const result = await this.auctionService.placeBid(
        config.botUserId,
        config.lotId,
        bidAmount,
        idempotencyKey,
      );

      // Record the action time
      this.lastBidAt.set(config.id, Date.now());

      // Regenerate random delay for RANDOM pattern
      if (config.pattern === BotPattern.RANDOM) {
        this.nextRandomDelay.set(
          config.id,
          randMs(config.minDelaySec, config.maxDelaySec),
        );
      }

      // Broadcast WS bid_update (same logic as AuctionGateway.handlePlaceBid)
      const room = `auction:${config.lotId}`;
      const anonymizedBidder = `bidder-${config.botUserId.slice(-4)}`;
      const lotTitle = (result.bid as any).lot?.title || `Lot ${config.lotId.slice(0, 8)}`;

      this.auctionGateway.server.to(room).emit('bid_update', {
        lotId: config.lotId,
        amount: result.bid.amount,
        bidderFlag: anonymizedBidder,
        lotTitle,
        timestamp: result.bid.createdAt,
      });

      if (result.auctionExtended && result.newEndAt) {
        this.auctionGateway.server.to(room).emit('auction_extended', {
          lotId: config.lotId,
          newEndAt: result.newEndAt,
        });
      }

      this.auctionGateway.server.to('feed:global').emit('feed_update', {
        lotId: config.lotId,
        amount: result.bid.amount,
        bidderFlag: anonymizedBidder,
        lotTitle,
        timestamp: result.bid.createdAt,
      });

      this.logger.log(
        `Bot bid placed: configId=${config.id} lot=${config.lotId} amount=${bidAmount} pattern=${config.pattern}`,
      );
    } catch (err) {
      this.logger.warn(
        `Bot bid failed: configId=${config.id} lot=${config.lotId} error=${(err as Error).message}`,
      );
    }
  }

  private shouldBid(
    config: AuctionBotConfig,
    lot: Lot,
    botIsLeading: boolean,
    now: number,
  ): boolean {
    const lastBid = this.lastBidAt.get(config.id) ?? 0;
    const elapsed = now - lastBid;

    switch (config.pattern) {
      case BotPattern.AGGRESSIVE:
        // Respond 2–5 seconds after being outbid
        return !botIsLeading && elapsed > randMs(config.minDelaySec, config.maxDelaySec);

      case BotPattern.STEADY:
        // Bid once every maxDelaySec seconds regardless of who is leading
        return elapsed > config.maxDelaySec * 1000;

      case BotPattern.SNIPER:
        // Only bid in the last 30 seconds of the auction
        if (!lot.auctionEndAt) return false;
        return !botIsLeading && lot.auctionEndAt.getTime() - now <= 30_000;

      case BotPattern.RANDOM: {
        // Use a pre-computed random delay; refresh each time
        if (!this.nextRandomDelay.has(config.id)) {
          this.nextRandomDelay.set(
            config.id,
            randMs(config.minDelaySec, config.maxDelaySec),
          );
        }
        return !botIsLeading && elapsed > (this.nextRandomDelay.get(config.id) ?? 5000);
      }

      default:
        return false;
    }
  }
}
