import { Component, OnInit, OnDestroy, ChangeDetectorRef, ChangeDetectionStrategy, PLATFORM_ID, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DecimalPipe, isPlatformBrowser } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Subject, interval } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { AuctionService } from '../../core/services/auction.service';
import { WebsocketService } from '../../core/services/websocket.service';
import { BrokerService } from '../../core/services/broker.service';
import { LotService } from '../../core/services/lot.service';
import { StateService } from '../../core/services/state.service';
import { TimeService } from '../../core/services/time.service';
import { LanguageService } from '../../core/services/language.service';
import { ILot } from '../../models/lot.model';
import { IUser } from '../../models/user.model';
import { IBid, IBidUpdate, IFeedUpdate, IWatcherCount } from '../../models/auction.model';

@Component({
  selector: 'app-live-trading',
  standalone: true,
  imports: [FormsModule, DecimalPipe, RouterLink],
  templateUrl: './live-trading.html',
  styleUrl: './live-trading.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LiveTradingComponent implements OnInit, OnDestroy {
  private readonly destroy$ = new Subject<void>();
  private readonly lotTitleMap = new Map<string, string>();
  private bidFlashTimer: ReturnType<typeof setTimeout> | null = null;
  private bidTimeoutTimer: ReturnType<typeof setTimeout> | null = null;
  /** Tracks whether the last bid attempt was a pre-bid (for error cleanup) */
  private lastBidWasPreBid = false;

  customBidAmount: number | null = null;
  maxAutoBidAmount: number | null = null;
  activeTab: 'list' | 'feed' = 'list';

  // Data
  auctionList: ILot[] = [];
  activeLot: ILot | null = null;
  bidHistory: IBid[] = [];
  liveFeed: IFeedUpdate[] = [];

  nextLot: ILot | null = null;
  nextLotLoading = false;
  nextLotLabel = '';

  // UI state
  loading = true;
  bidding = false;
  bidError: string | null = null;
  bidSuccess = false;
  auctionEnded = false;
  wsConnected = false;
  animatingBidLotId: string | null = null;

  // Bidding status
  /** Current authenticated user's ID (extracted from state) */
  currentUserId: string | null = null;
  /** True when the last bid_update on the active lot was placed by this user */
  isWinning = false;
  /** True when another user outbid the current user on the active lot */
  isOutbid = false;
  /** Max amount of the user's active auto-bid on the active lot */
  activeAutoBidMax: number | null = null;
  /** LotId for which the active auto-bid was set */
  activeAutoBidLotId: string | null = null;

  // Broker state
  traders: IUser[] = [];
  selectedTraderId: string | null = null;
  traderPickerOpen = false;

  // Social stats
  watcherCount = 0;
  uniqueBidders = 0;

  // Timer tick (server-aligned via TimeService)
  now = 0;

  // Stats
  stats = {
    activeAuctions: 0,
    totalBids: 0,
  };

  private readonly platformId = inject(PLATFORM_ID);
  readonly ls = inject(LanguageService);

  constructor(
    private readonly auctionService: AuctionService,
    private readonly wsService: WebsocketService,
    private readonly brokerService: BrokerService,
    private readonly lotService: LotService,
    private readonly stateService: StateService,
    private readonly timeService: TimeService,
    private readonly cdr: ChangeDetectorRef,
  ) { }

  ngOnInit(): void {
    if (!isPlatformBrowser(this.platformId)) {
      this.loading = false;
      return;
    }
    this.now = this.timeService.now();
    this.currentUserId = this.stateService.snapshot.user?.id ?? null;
    this.loadGlobalFeedHistory();
    this.loadActiveLots();
    this.connectWebSocket();
    this.startTimerTick();

    if (this.isBroker) {
      this.brokerService.getMyTraders()
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: (traders) => {
            this.traders = traders;
            if (traders.length === 1) {
              this.selectedTraderId = traders[0].id;
            }
            this.cdr.markForCheck();
          },
        });
    }
  }

  ngOnDestroy(): void {
    if (this.activeLot) {
      this.wsService.leaveAuction(this.activeLot.id);
    }
    this.wsService.leaveGlobalFeed();
    if (this.bidFlashTimer) clearTimeout(this.bidFlashTimer);
    if (this.bidTimeoutTimer) clearTimeout(this.bidTimeoutTimer);
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
          lots.forEach(lot => this.lotTitleMap.set(lot.id, lot.title));
          if (lots.length > 0) {
            this.nextLot = null;
            if (!this.activeLot) {
              this.selectLot(lots[0]);
            }
          } else if (!this.nextLot) {
            this.loadNextLot();
          }
          this.cdr.markForCheck();
        },
        error: () => {
          this.loading = false;
          this.cdr.markForCheck();
        },
      });
  }

  private loadNextLot(): void {
    this.nextLotLoading = true;
    const now = new Date().toISOString();
    this.lotService.getAll({ dateFrom: now, sort: 'date_asc', limit: 1 })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res) => {
          this.nextLot = res.data[0] ?? null;
          this.nextLotLabel = this.computeNextLotLabel();
          this.nextLotLoading = false;
          this.cdr.markForCheck();
        },
        error: () => {
          this.nextLotLoading = false;
          this.cdr.markForCheck();
        },
      });
  }

  private loadGlobalFeedHistory(): void {
    this.auctionService.getRecentGlobalBids()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (feedItems: IFeedUpdate[]) => {
          this.liveFeed = feedItems;
          feedItems.forEach(item => {
            if (item.lotTitle) {
              this.lotTitleMap.set(item.lotId, item.lotTitle);
            }
          });
          this.cdr.markForCheck();
        }
      });
  }

  private connectWebSocket(): void {
    this.wsService.connect();

    this.wsService.connected$
      .pipe(takeUntil(this.destroy$))
      .subscribe((connected) => {
        this.wsConnected = connected;
        if (connected && this.activeLot) {
          this.wsService.joinAuction(this.activeLot.id);
          this.wsService.joinGlobalFeed();
        }
        // Reset stuck bidding flag on reconnect (ACK was lost)
        if (connected && this.bidding) {
          this.bidding = false;
          if (this.bidTimeoutTimer) {
            clearTimeout(this.bidTimeoutTimer);
            this.bidTimeoutTimer = null;
          }
          this.bidError = 'Connection interrupted. Please try again.';
          setTimeout(() => { this.bidError = null; this.cdr.markForCheck(); }, 4000);
        }
        this.cdr.markForCheck();
      });

    // Re-sync data on reconnect (lots/prices may have changed)
    this.wsService.reconnected$
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        this.loadActiveLots();
        if (this.activeLot) {
          this.loadBidHistory(this.activeLot.id);
        }
      });

    // Real-time bid updates
    this.wsService.bidUpdate$
      .pipe(takeUntil(this.destroy$))
      .subscribe((update: IBidUpdate) => {
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
        if (lot) lot.auctionEndAt = ext.newEndAt;
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
          this.activeLot = {
            ...this.activeLot,
            currentPrice: ended.finalPrice,
            winnerId: ended.winnerId,
          };
          // Clear auto-bid state when auction ends
          if (this.activeAutoBidLotId === ended.lotId) {
            this.activeAutoBidMax = null;
            this.activeAutoBidLotId = null;
          }
        }
        this.auctionList = this.auctionList.filter(l => l.id !== ended.lotId);
        this.stats.activeAuctions = this.auctionList.length;
        this.cdr.markForCheck();
      });

    // Global feed updates
    this.wsService.feedUpdate$
      .pipe(takeUntil(this.destroy$))
      .subscribe((feed: IFeedUpdate) => {
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
        if (this.bidTimeoutTimer) {
          clearTimeout(this.bidTimeoutTimer);
          this.bidTimeoutTimer = null;
        }
        this.lastBidWasPreBid = false;
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
        if (this.bidTimeoutTimer) {
          clearTimeout(this.bidTimeoutTimer);
          this.bidTimeoutTimer = null;
        }
        // If a pre-bid failed, clear the optimistically-set auto-bid indicator
        if (this.lastBidWasPreBid) {
          this.activeAutoBidMax = null;
          this.activeAutoBidLotId = null;
        }
        this.lastBidWasPreBid = false;
        this.bidding = false;
        this.bidError = err.message;
        setTimeout(() => {
          this.bidError = null;
          this.cdr.markForCheck();
        }, 5000);
        this.cdr.markForCheck();
      });

    // Watcher count updates
    this.wsService.watcherCount$
      .pipe(takeUntil(this.destroy$))
      .subscribe((data: IWatcherCount) => {
        if (data.lotId === this.activeLot?.id) {
          this.watcherCount = data.count;
          this.cdr.markForCheck();
        }
      });

    // Bid rollback (admin removed highest bid)
    this.wsService.bidRollback$
      .pipe(takeUntil(this.destroy$))
      .subscribe((data) => {
        const lot = this.auctionList.find(l => l.id === data.lotId);
        if (lot) lot.currentPrice = data.newCurrentPrice;
        if (this.activeLot?.id === data.lotId) {
          this.activeLot = { ...this.activeLot, currentPrice: data.newCurrentPrice };
          this.loadBidHistory(data.lotId);
        }
        this.cdr.markForCheck();
      });

    // Auction paused
    this.wsService.auctionPaused$
      .pipe(takeUntil(this.destroy$))
      .subscribe((data) => {
        const lot = this.auctionList.find(l => l.id === data.lotId);
        if (lot) lot.isPaused = true;
        if (this.activeLot?.id === data.lotId) {
          this.activeLot = { ...this.activeLot, isPaused: true };
        }
        this.cdr.markForCheck();
      });

    // Auction resumed
    this.wsService.auctionResumed$
      .pipe(takeUntil(this.destroy$))
      .subscribe((data) => {
        const lot = this.auctionList.find(l => l.id === data.lotId);
        if (lot) {
          lot.isPaused = false;
          lot.auctionEndAt = data.newEndAt;
        }
        if (this.activeLot?.id === data.lotId) {
          this.activeLot = { ...this.activeLot, isPaused: false, auctionEndAt: data.newEndAt };
        }
        this.cdr.markForCheck();
      });
  }

  private handleBidUpdate(update: IBidUpdate): void {
    // Update price in the auction list
    const lot = this.auctionList.find(l => l.id === update.lotId);
    if (lot) {
      lot.currentPrice = update.amount;
    }

    // Update active lot
    if (this.activeLot?.id === update.lotId) {
      this.activeLot = { ...this.activeLot, currentPrice: update.amount };

      // Determine winning/outbid status
      if (this.currentUserId) {
        const isMyBid = update.userId === this.currentUserId;
        this.isWinning = isMyBid;
        this.isOutbid = !isMyBid;

        // If someone outbid beyond our auto-bid max, the auto-bid is exhausted
        if (!isMyBid && this.activeAutoBidLotId === update.lotId && this.activeAutoBidMax !== null) {
          if (update.amount > this.activeAutoBidMax) {
            this.activeAutoBidMax = null;
            this.activeAutoBidLotId = null;
          }
        }
      }

      // Trigger price flash animation
      this.animatingBidLotId = update.lotId;
      if (this.bidFlashTimer) clearTimeout(this.bidFlashTimer);
      this.bidFlashTimer = setTimeout(() => {
        this.animatingBidLotId = null;
        this.cdr.markForCheck();
      }, 700);

      // Prepend the new bid directly from the WebSocket payload — no HTTP round-trip.
      // The initial bid history is loaded once via HTTP when the lot is selected.
      const newBid: IBid = {
        id: '',
        lotId: update.lotId,
        userId: update.userId,
        amount: update.amount,
        isPreBid: update.isAutoBid ?? false,
        maxAutoBid: null,
        createdAt: update.timestamp,
        bidderFlag: update.bidderFlag,
      };
      this.bidHistory = [newBid, ...this.bidHistory].slice(0, 10);
      this.stats.totalBids += 1;
    }
  }

  private loadBidHistory(lotId: string): void {
    this.auctionService.getBidsByLot(lotId, 1, 10)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          this.bidHistory = response.data;
          this.stats.totalBids = response.total;
          this.uniqueBidders = response.uniqueBidders ?? 0;

          // Restore auto-bid state from bid history
          if (this.currentUserId && response.data.length > 0) {
            const myPreBid = response.data.find(
              b => b.userId === this.currentUserId && b.isPreBid && b.maxAutoBid
            );
            if (myPreBid?.maxAutoBid) {
              const currentPrice = this.activeLot ? this.getCurrentPrice(this.activeLot) : 0;
              if (myPreBid.maxAutoBid > currentPrice) {
                this.activeAutoBidMax = myPreBid.maxAutoBid;
                this.activeAutoBidLotId = lotId;
              }
            }

            // Restore winning/outbid status
            const topBid = response.data[0];
            if (topBid) {
              this.isWinning = topBid.userId === this.currentUserId;
              this.isOutbid = topBid.userId !== this.currentUserId &&
                response.data.some(b => b.userId === this.currentUserId);
            }
          }

          this.cdr.markForCheck();
        },
      });
  }

  private startTimerTick(): void {
    interval(1000)
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        this.now = this.timeService.now();
        this.cdr.markForCheck();
      });
  }

  selectLot(lot: ILot): void {
    if (this.activeLot && this.activeLot.id !== lot.id) {
      this.wsService.leaveAuction(this.activeLot.id);
    }

    this.activeLot = lot;
    this.auctionEnded = false;
    this.bidError = null;
    this.bidSuccess = false;
    this.customBidAmount = null;
    this.watcherCount = 0;

    // Reset winning/outbid status for the new lot
    this.isWinning = false;
    this.isOutbid = false;

    // Keep auto-bid indicator only if it's for this lot
    if (this.activeAutoBidLotId !== lot.id) {
      this.activeAutoBidMax = null;
      this.activeAutoBidLotId = null;
    }

    this.lotTitleMap.set(lot.id, lot.title);
    this.wsService.joinAuction(lot.id);
    this.loadBidHistory(lot.id);
  }

  /** Returns dynamic quick-bid increments based on current lot price */
  getQuickBidIncrements(): number[] {
    if (!this.activeLot) return [100, 250, 500, 1000];
    const price = this.getCurrentPrice(this.activeLot);
    if (price < 1000) return [50, 100, 200, 500];
    if (price < 5000) return [100, 250, 500, 1000];
    if (price < 20000) return [250, 500, 1000, 2500];
    if (price < 50000) return [500, 1000, 2500, 5000];
    return [1000, 2500, 5000, 10000];
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
      this.bidError = `Minimum bid is €${minBid.toLocaleString()}`;
      return;
    }

    this.lastBidWasPreBid = false;
    this.bidding = true;
    this.bidError = null;

    if (this.bidTimeoutTimer) clearTimeout(this.bidTimeoutTimer);
    this.bidTimeoutTimer = setTimeout(() => {
      if (this.bidding) {
        this.bidding = false;
        this.bidError = 'No response from server. Please try again.';
        setTimeout(() => { this.bidError = null; this.cdr.markForCheck(); }, 4000);
        this.cdr.markForCheck();
      }
    }, 15000);

    this.wsService.placeBid(this.activeLot.id, this.customBidAmount, this.selectedTraderId);
  }

  placePreBid(): void {
    if (!this.activeLot || !this.maxAutoBidAmount || this.bidding) return;

    const minBid = this.getMinBid(this.activeLot);
    if (this.maxAutoBidAmount < minBid) {
      this.bidError = `Max auto-bid must be at least €${minBid.toLocaleString()}`;
      return;
    }

    this.lastBidWasPreBid = true;
    this.bidding = true;
    this.bidError = null;

    // Store optimistically; cleared on error via lastBidWasPreBid flag
    this.activeAutoBidMax = this.maxAutoBidAmount;
    this.activeAutoBidLotId = this.activeLot.id;

    if (this.bidTimeoutTimer) clearTimeout(this.bidTimeoutTimer);
    this.bidTimeoutTimer = setTimeout(() => {
      if (this.bidding) {
        this.bidding = false;
        this.activeAutoBidMax = null;
        this.activeAutoBidLotId = null;
        this.bidError = 'No response from server. Please try again.';
        setTimeout(() => { this.bidError = null; this.cdr.markForCheck(); }, 4000);
        this.cdr.markForCheck();
      }
    }, 15000);

    this.wsService.placePreBid(this.activeLot.id, this.maxAutoBidAmount, this.selectedTraderId);
    this.maxAutoBidAmount = null;
  }

  clearAutoBid(): void {
    this.activeAutoBidMax = null;
    this.activeAutoBidLotId = null;
  }

  buyNow(): void {
    if (!this.activeLot || !this.activeLot.buyNowPrice) return;
    if (!confirm(`Buy now for €${Number(this.activeLot.buyNowPrice).toLocaleString()}?`)) return;

    this.auctionService.buyNow(this.activeLot.id, this.selectedTraderId)
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

  // ─── Template helpers ────────────────────────────────────────────────────

  /** Returns true when this bid was placed by the currently logged-in user */
  isMyBid(bid: IBid): boolean {
    return !!this.currentUserId && bid.userId === this.currentUserId;
  }

  /** Returns true when the current user is the top bidder on the given lot */
  isLeadingOnLot(lot: ILot): boolean {
    return lot.id === this.activeLot?.id && this.isWinning;
  }

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
    if (lot.images && lot.images.length > 0) return lot.images[0].url;
    return lot.sourceImageUrl || null;
  }

  getLotTitle(lotId: string): string {
    return this.lotTitleMap.get(lotId) || `#${lotId.substring(0, 8)}`;
  }

  getRelativeTime(dateStr: string): string {
    const diff = this.timeService.now() - new Date(dateStr).getTime();
    if (diff < 60000) return `${Math.floor(diff / 1000)}s`;
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m`;
    return `${Math.floor(diff / 3600000)}h`;
  }

  isCurrentUser(userId: string): boolean {
    return this.currentUserId === userId;
  }

  private computeNextLotLabel(): string {
    if (!this.nextLot) return '';
    const target = this.nextLot.auctionStartAt ?? this.nextLot.auctionEndAt;
    if (!target) return '';
    const date = new Date(target);
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const tomorrowStart = new Date(todayStart);
    tomorrowStart.setDate(tomorrowStart.getDate() + 1);
    const afterTomorrowStart = new Date(tomorrowStart);
    afterTomorrowStart.setDate(afterTomorrowStart.getDate() + 1);

    const localeMap: Record<string, string> = { ru: 'ru-RU', by: 'be-BY', en: 'en-US' };
    const locale = localeMap[this.ls.lang()] ?? 'ru-RU';
    const time = new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit' }).format(date);

    if (date >= todayStart && date < tomorrowStart) {
      return `${this.ls.t('live.today')} ${time}`;
    }
    if (date >= tomorrowStart && date < afterTomorrowStart) {
      return `${this.ls.t('live.tomorrow')} ${time}`;
    }
    const dayMonth = new Intl.DateTimeFormat(locale, { weekday: 'long', day: 'numeric', month: 'long' }).format(date);
    return `${dayMonth} ${this.ls.t('time.at')} ${time}`;
  }

  // ─── Broker helpers ─────────────────────────────────────────────────────

  get isBroker(): boolean {
    return this.stateService.snapshot.user?.role === 'broker';
  }

  get selectedTrader(): IUser | null {
    return this.traders.find(t => t.id === this.selectedTraderId) ?? null;
  }

  selectTrader(traderId: string | null): void {
    this.selectedTraderId = traderId;
    this.traderPickerOpen = false;
    this.cdr.markForCheck();
  }

  toggleTraderPicker(): void {
    this.traderPickerOpen = !this.traderPickerOpen;
    this.cdr.markForCheck();
  }
}
