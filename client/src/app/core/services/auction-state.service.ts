import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';
import { WebsocketService } from './websocket.service';
import { ApiService } from './api.service';
import { StateService } from './state.service';
import { ILot } from '../../models/lot.model';

export interface LotPriceState {
  currentPrice: number;
  auctionEndAt: string | null;
}

export interface PriceUpdateEvent extends LotPriceState {
  lotId: string;
}

/**
 * Global singleton that tracks live auction prices for all lots visible on
 * screen. Powered by the WebSocket global feed so every page — catalog, lot
 * detail, etc. — shows real-time prices without HTTP polling.
 */
@Injectable({ providedIn: 'root' })
export class AuctionStateService {
  private readonly priceMap = new Map<string, LotPriceState>();
  private readonly _priceUpdate$ = new Subject<PriceUpdateEvent>();
  private initialised = false;

  /** Emits every time a lot's price or endAt changes. */
  readonly priceUpdate$ = this._priceUpdate$.asObservable();

  constructor(
    private readonly wsService: WebsocketService,
    private readonly api: ApiService,
    private readonly stateService: StateService,
  ) {}

  /**
   * Wire up WebSocket subscriptions and connect to the global feed.
   * Safe to call multiple times — subsequent calls are no-ops.
   */
  init(): void {
    if (this.initialised) return;
    this.initialised = true;

    // Only connect WebSocket for authenticated users.
    // The gateway rejects unauthenticated sockets, which would cause a reconnect loop.
    if (this.stateService.snapshot.isAuthenticated) {
      this.wsService.connect();
      this.wsService.connected$.subscribe((connected) => {
        if (connected) {
          this.wsService.joinGlobalFeed();
        }
      });
    }

    // Track prices from the global bid feed
    this.wsService.feedUpdate$.subscribe((update) => {
      const existing = this.priceMap.get(update.lotId);
      const next: LotPriceState = {
        currentPrice: update.amount,
        auctionEndAt: existing?.auctionEndAt ?? null,
      };
      this.priceMap.set(update.lotId, next);
      this._priceUpdate$.next({ lotId: update.lotId, ...next });
    });

    // Mark auction as ended
    this.wsService.auctionEnded$.subscribe((ended) => {
      const next: LotPriceState = {
        currentPrice: ended.finalPrice,
        auctionEndAt: null,
      };
      this.priceMap.set(ended.lotId, next);
      this._priceUpdate$.next({ lotId: ended.lotId, ...next });
    });

    // On reconnect, sync to fill gaps from missed events
    this.wsService.reconnected$.subscribe(() => {
      this.syncActiveLots();
    });
  }

  // ─── Read helpers ─────────────────────────────────────────────────────────

  getLotPrice(lotId: string): number | null {
    const state = this.priceMap.get(lotId);
    return state != null ? state.currentPrice : null;
  }

  getLotEndAt(lotId: string): string | null {
    return this.priceMap.get(lotId)?.auctionEndAt ?? null;
  }

  // ─── Write helpers ────────────────────────────────────────────────────────

  /**
   * Pre-populate the price map from a fresh HTTP lots response.
   * Only sets the value when there is no live WebSocket value yet.
   */
  seedFromLots(lots: ILot[]): void {
    for (const lot of lots) {
      if (!this.priceMap.has(lot.id)) {
        const price = lot.currentPrice
          ? parseFloat(String(lot.currentPrice))
          : lot.startingBid
            ? parseFloat(String(lot.startingBid))
            : 0;
        this.priceMap.set(lot.id, {
          currentPrice: price,
          auctionEndAt: lot.auctionEndAt,
        });
      }
    }
  }

  /**
   * Update only auctionEndAt (triggered by auction_extended events from the
   * auction room subscription in LotDetailComponent / LiveTrading).
   */
  updateEndAt(lotId: string, newEndAt: string): void {
    const existing = this.priceMap.get(lotId);
    this.priceMap.set(lotId, {
      currentPrice: existing?.currentPrice ?? 0,
      auctionEndAt: newEndAt,
    });
  }

  // ─── Internal ─────────────────────────────────────────────────────────────

  private syncActiveLots(): void {
    this.api.get<ILot[]>('/auction/active').subscribe({
      next: (lots) => {
        for (const lot of lots) {
          const price = lot.currentPrice
            ? parseFloat(String(lot.currentPrice))
            : lot.startingBid
              ? parseFloat(String(lot.startingBid))
              : 0;
          const next: LotPriceState = {
            currentPrice: price,
            auctionEndAt: lot.auctionEndAt,
          };
          this.priceMap.set(lot.id, next);
          this._priceUpdate$.next({ lotId: lot.id, ...next });
        }
      },
    });
  }
}
