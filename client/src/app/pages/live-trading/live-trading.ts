import { Component, OnInit, OnDestroy, ChangeDetectorRef, ChangeDetectionStrategy } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DecimalPipe } from '@angular/common';
import { Subject, interval } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { AuctionService } from '../../core/services/auction.service';
import { WebsocketService } from '../../core/services/websocket.service';
import { StateService } from '../../core/services/state.service';
import { ILot } from '../../models/lot.model';
import { IBid, IBidUpdate, IFeedUpdate } from '../../models/auction.model';

@Component({
  selector: 'app-live-trading',
  standalone: true,
  imports: [FormsModule, DecimalPipe],
  templateUrl: './live-trading.html',
  styleUrl: './live-trading.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LiveTradingComponent implements OnInit, OnDestroy {
  private readonly destroy$ = new Subject<void>();
  private readonly lotTitleMap = new Map<string, string>();
  private bidFlashTimer: ReturnType<typeof setTimeout> | null = null;

  customBidAmount: number | null = null;
  maxAutoBidAmount: number | null = null;
  activeTab: 'list' | 'feed' = 'list';

  // Data
  auctionList: ILot[] = [];
  activeLot: ILot | null = null;
  bidHistory: IBid[] = [];
  liveFeed: IFeedUpdate[] = [];

  // UI state
  loading = true;
  bidding = false;
  bidError: string | null = null;
  bidSuccess = false;
  auctionEnded = false;
  wsConnected = false;
  animatingBidLotId: string | null = null;

  // Stats
  stats = {
    activeAuctions: 0,
    totalBids: 0,
  };

  // Timer tick
  now = Date.now();

  constructor(
    private readonly auctionService: AuctionService,
    private readonly wsService: WebsocketService,
    private readonly stateService: StateService,
    private readonly cdr: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    this.loadActiveLots();
    this.connectWebSocket();
    this.startTimerTick();
  }

  ngOnDestroy(): void {
    if (this.activeLot) {
      this.wsService.leaveAuction(this.activeLot.id);
    }
    this.wsService.leaveGlobalFeed();
    if (this.bidFlashTimer) {
      clearTimeout(this.bidFlashTimer);
    }
    this.destroy$.next();
    this.destroy$.complete();
  }

  private loadActiveLots(): void {
    this.loading = true;
    this.auctionService.getActiveLots()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (lots) => {
          this.auctionList = lots;
          this.stats.activeAuctions = lots.length;
          this.loading = false;

          // Build lot title map for Live Feed labels
          lots.forEach(lot => this.lotTitleMap.set(lot.id, lot.title));

          // Auto-select first lot
          if (lots.length > 0 && !this.activeLot) {
            this.selectLot(lots[0]);
          }
          this.cdr.markForCheck();
        },
        error: () => {
          this.loading = false;
          this.cdr.markForCheck();
        },
      });
  }

  private connectWebSocket(): void {
    this.wsService.connect();

    // Track WS connection status
    this.wsService.connected$
      .pipe(takeUntil(this.destroy$))
      .subscribe((connected) => {
        this.wsConnected = connected;
        if (connected && this.activeLot) {
          this.wsService.joinAuction(this.activeLot.id);
          this.wsService.joinGlobalFeed();
        }
        this.cdr.markForCheck();
      });

    // Real-time bid updates
    this.wsService.bidUpdate$
      .pipe(takeUntil(this.destroy$))
      .subscribe((update: IBidUpdate) => {
        // Cache lot title from WS event if available
        if (update.lotTitle) {
          this.lotTitleMap.set(update.lotId, update.lotTitle);
        }
        this.handleBidUpdate(update);
        this.cdr.markForCheck();
      });

    // Auction time extensions (anti-sniping)
    this.wsService.auctionExtended$
      .pipe(takeUntil(this.destroy$))
      .subscribe((ext) => {
        const lot = this.auctionList.find(l => l.id === ext.lotId);
        if (lot) {
          lot.auctionEndAt = ext.newEndAt;
        }
        if (this.activeLot?.id === ext.lotId) {
          this.activeLot = { ...this.activeLot, auctionEndAt: ext.newEndAt };
        }
        this.cdr.markForCheck();
      });

    // Auction ended
    this.wsService.auctionEnded$
      .pipe(takeUntil(this.destroy$))
      .subscribe((ended) => {
        if (this.activeLot?.id === ended.lotId) {
          this.auctionEnded = true;
          this.activeLot = { ...this.activeLot, currentPrice: ended.finalPrice, winnerId: ended.winnerId };
        }
        // Remove from active list
        this.auctionList = this.auctionList.filter(l => l.id !== ended.lotId);
        this.stats.activeAuctions = this.auctionList.length;
        this.cdr.markForCheck();
      });

    // Global feed updates
    this.wsService.feedUpdate$
      .pipe(takeUntil(this.destroy$))
      .subscribe((feed: IFeedUpdate) => {
        // Cache lot title from feed event if available
        if (feed.lotTitle) {
          this.lotTitleMap.set(feed.lotId, feed.lotTitle);
        }
        this.liveFeed = [feed, ...this.liveFeed].slice(0, 50);
        this.cdr.markForCheck();
      });

    // Bid placed acknowledgement
    this.wsService.bidPlaced$
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        this.bidding = false;
        this.bidSuccess = true;
        this.bidError = null;
        this.customBidAmount = null;
        setTimeout(() => {
          this.bidSuccess = false;
          this.cdr.markForCheck();
        }, 3000);
        this.cdr.markForCheck();
      });

    // Bid errors
    this.wsService.bidError$
      .pipe(takeUntil(this.destroy$))
      .subscribe((err) => {
        this.bidding = false;
        this.bidError = err.message;
        setTimeout(() => {
          this.bidError = null;
          this.cdr.markForCheck();
        }, 5000);
        this.cdr.markForCheck();
      });
  }

  private handleBidUpdate(update: IBidUpdate): void {
    // Update the lot in the list
    const lot = this.auctionList.find(l => l.id === update.lotId);
    if (lot) {
      lot.currentPrice = update.amount;
    }

    // Update active lot
    if (this.activeLot?.id === update.lotId) {
      this.activeLot = { ...this.activeLot, currentPrice: update.amount };

      // Trigger price flash animation
      this.animatingBidLotId = update.lotId;
      if (this.bidFlashTimer) clearTimeout(this.bidFlashTimer);
      this.bidFlashTimer = setTimeout(() => {
        this.animatingBidLotId = null;
        this.cdr.markForCheck();
      }, 700);

      // Reload bid history for the active lot
      this.loadBidHistory(update.lotId);
    }
  }

  private loadBidHistory(lotId: string): void {
    this.auctionService.getBidsByLot(lotId, 1, 10)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          this.bidHistory = response.data;
          this.stats.totalBids = response.total;
          this.cdr.markForCheck();
        },
      });
  }

  private startTimerTick(): void {
    interval(1000)
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        this.now = Date.now();
        this.cdr.markForCheck();
      });
  }

  selectLot(lot: ILot): void {
    // Leave previous auction room
    if (this.activeLot && this.activeLot.id !== lot.id) {
      this.wsService.leaveAuction(this.activeLot.id);
    }

    this.activeLot = lot;
    this.auctionEnded = false;
    this.bidError = null;
    this.bidSuccess = false;
    this.customBidAmount = null;

    // Cache lot title
    this.lotTitleMap.set(lot.id, lot.title);

    // Join new auction room
    this.wsService.joinAuction(lot.id);

    // Load bid history for selected lot
    this.loadBidHistory(lot.id);
  }

  quickBid(increment: number): void {
    if (!this.activeLot) return;
    const currentPrice = this.getCurrentPrice(this.activeLot);
    this.customBidAmount = currentPrice + increment;
  }

  placeBid(): void {
    if (!this.activeLot || !this.customBidAmount || this.bidding) return;

    const minBid = this.getMinBid(this.activeLot);
    if (this.customBidAmount < minBid) {
      this.bidError = `Minimum bid is ${minBid} EUR`;
      return;
    }

    this.bidding = true;
    this.bidError = null;

    // Use WebSocket for real-time bid placement
    this.wsService.placeBid(this.activeLot.id, this.customBidAmount);
  }

  placePreBid(): void {
    if (!this.activeLot || !this.maxAutoBidAmount || this.bidding) return;

    const minBid = this.getMinBid(this.activeLot);
    if (this.maxAutoBidAmount < minBid) {
      this.bidError = `Max auto-bid must be at least ${minBid} EUR`;
      return;
    }

    this.bidding = true;
    this.bidError = null;

    this.wsService.placePreBid(this.activeLot.id, this.maxAutoBidAmount);
    this.maxAutoBidAmount = null;
  }

  buyNow(): void {
    if (!this.activeLot || !this.activeLot.buyNowPrice) return;

    if (!confirm(`Buy now for ${this.activeLot.buyNowPrice} EUR?`)) return;

    this.auctionService.buyNow(this.activeLot.id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.auctionEnded = true;
          this.cdr.markForCheck();
        },
        error: (err) => {
          this.bidError = err.error?.message || 'Buy now failed';
          this.cdr.markForCheck();
        },
      });
  }

  // Helper methods
  getCurrentPrice(lot: ILot): number {
    return lot.currentPrice
      ? parseFloat(String(lot.currentPrice))
      : lot.startingBid
        ? parseFloat(String(lot.startingBid))
        : 0;
  }

  getBidStep(lot: ILot): number {
    return parseFloat(String(lot.bidStep)) || 100;
  }

  getMinBid(lot: ILot): number {
    return this.getCurrentPrice(lot) + this.getBidStep(lot);
  }

  getTimeLeft(endAt: string | null): string {
    if (!endAt) return '--:--';
    const diff = new Date(endAt).getTime() - this.now;
    if (diff <= 0) return '0:00';
    const h = Math.floor(diff / 3600000);
    const m = Math.floor((diff % 3600000) / 60000);
    const s = Math.floor((diff % 60000) / 1000);
    if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    return `${m}:${String(s).padStart(2, '0')}`;
  }

  getTimerClass(endAt: string | null): string {
    if (!endAt) return 'timer--green';
    const diff = new Date(endAt).getTime() - this.now;
    if (diff < 30000) return 'timer--red';
    if (diff < 120000) return 'timer--yellow';
    return 'timer--green';
  }

  getLotImage(lot: ILot): string | null {
    if (lot.images && lot.images.length > 0) {
      return lot.images[0].url;
    }
    return lot.sourceImageUrl || null;
  }

  getLotTitle(lotId: string): string {
    return this.lotTitleMap.get(lotId) || `#${lotId.substring(0, 8)}`;
  }

  getRelativeTime(dateStr: string): string {
    const diff = this.now - new Date(dateStr).getTime();
    if (diff < 60000) return `${Math.floor(diff / 1000)}s`;
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m`;
    return `${Math.floor(diff / 3600000)}h`;
  }

  isCurrentUser(userId: string): boolean {
    const user = this.stateService.snapshot.user;
    return user?.id === userId;
  }
}
