import { Injectable, OnDestroy } from '@angular/core';
import { Subject, BehaviorSubject, Observable } from 'rxjs';
import { Socket } from 'socket.io-client';
import { environment } from '../../../environments/environment';
import {
  IBidUpdate,
  IAuctionExtended,
  IAuctionEnded,
  IFeedUpdate,
  IPlaceBidResult,
  IWatcherCount,
  IBidRollback,
  IAuctionPaused,
  IAuctionResumed,
} from '../../models/auction.model';

@Injectable({ providedIn: 'root' })
export class WebsocketService implements OnDestroy {
  private socket: Socket | null = null;
  /** Tracks whether the socket was ever connected (to detect re-connects). */
  private wasConnected = false;

  private readonly _connected$ = new BehaviorSubject<boolean>(false);
  private readonly _reconnected$ = new Subject<void>();
  private readonly _bidUpdate$ = new Subject<IBidUpdate>();
  private readonly _auctionExtended$ = new Subject<IAuctionExtended>();
  private readonly _auctionEnded$ = new Subject<IAuctionEnded>();
  private readonly _feedUpdate$ = new Subject<IFeedUpdate>();
  private readonly _bidPlaced$ = new Subject<IPlaceBidResult>();
  private readonly _bidError$ = new Subject<{ message: string }>();
  private readonly _watcherCount$ = new Subject<IWatcherCount>();
  private readonly _bidRollback$ = new Subject<IBidRollback>();
  private readonly _auctionPaused$ = new Subject<IAuctionPaused>();
  private readonly _auctionResumed$ = new Subject<IAuctionResumed>();

  readonly connected$: Observable<boolean> = this._connected$.asObservable();
  readonly reconnected$: Observable<void> = this._reconnected$.asObservable();
  readonly bidUpdate$: Observable<IBidUpdate> = this._bidUpdate$.asObservable();
  readonly auctionExtended$: Observable<IAuctionExtended> = this._auctionExtended$.asObservable();
  readonly auctionEnded$: Observable<IAuctionEnded> = this._auctionEnded$.asObservable();
  readonly feedUpdate$: Observable<IFeedUpdate> = this._feedUpdate$.asObservable();
  readonly bidPlaced$: Observable<IPlaceBidResult> = this._bidPlaced$.asObservable();
  readonly bidError$: Observable<{ message: string }> = this._bidError$.asObservable();
  readonly watcherCount$: Observable<IWatcherCount> = this._watcherCount$.asObservable();
  readonly bidRollback$: Observable<IBidRollback> = this._bidRollback$.asObservable();
  readonly auctionPaused$: Observable<IAuctionPaused> = this._auctionPaused$.asObservable();
  readonly auctionResumed$: Observable<IAuctionResumed> = this._auctionResumed$.asObservable();

  connect(): void {
    if (typeof window === 'undefined') return;
    if (this.socket?.connected) return;

    // Dynamic import to avoid SSR issues with socket.io-client
    import('socket.io-client').then(({ io }) => {
      const token = typeof localStorage !== 'undefined'
        ? localStorage.getItem('accessToken')
        : null;

      const userId = this.getUserIdFromToken(token);
      const role = this.getRoleFromToken(token);

      this.socket = io(`${environment.wsUrl}/auction`, {
        auth: { token, userId, role },
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionAttempts: 10,
        reconnectionDelay: 1000,
      });

      this.socket.on('connect', () => {
        if (this.wasConnected) {
          // This is a re-connect after a prior disconnect
          this._reconnected$.next();
        }
        this.wasConnected = true;
        this._connected$.next(true);
      });

      this.socket.on('disconnect', () => {
        this._connected$.next(false);
      });

      this.socket.on('bid_update', (data: IBidUpdate) => {
        this._bidUpdate$.next(data);
      });

      this.socket.on('auction_extended', (data: IAuctionExtended) => {
        this._auctionExtended$.next(data);
      });

      this.socket.on('auction_ended', (data: IAuctionEnded) => {
        this._auctionEnded$.next(data);
      });

      this.socket.on('feed_update', (data: IFeedUpdate) => {
        this._feedUpdate$.next(data);
      });

      this.socket.on('watcher_count', (data: IWatcherCount) => {
        this._watcherCount$.next(data);
      });

      this.socket.on('bid_rollback', (data: IBidRollback) => {
        this._bidRollback$.next(data);
      });

      this.socket.on('auction_paused', (data: IAuctionPaused) => {
        this._auctionPaused$.next(data);
      });

      this.socket.on('auction_resumed', (data: IAuctionResumed) => {
        this._auctionResumed$.next(data);
      });

      this.socket.on('connect_error', (err: Error) => {
        console.error('[WebSocket] Connection error:', err.message);
        this._connected$.next(false);
      });
    });
  }

  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this._connected$.next(false);
    }
  }

  joinAuction(lotId: string): void {
    if (this.socket?.connected) {
      this.socket.emit('join_auction', lotId);
    }
  }

  leaveAuction(lotId: string): void {
    if (this.socket?.connected) {
      this.socket.emit('leave_auction', lotId);
    }
  }

  joinGlobalFeed(): void {
    if (this.socket?.connected) {
      this.socket.emit('join_feed', 'global');
    }
  }

  leaveGlobalFeed(): void {
    if (this.socket?.connected) {
      this.socket.emit('leave_feed', 'global');
    }
  }

  placeBid(lotId: string, amount: number, traderId?: string | null): void {
    if (!this.socket?.connected) return;

    const idempotencyKey = typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;

    const payload: Record<string, unknown> = { lotId, amount, idempotencyKey };
    if (traderId) payload['traderId'] = traderId;

    this.socket.emit('place_bid', payload, (response: any) => {
      if (response?.status === 'success') {
        this._bidPlaced$.next(response.data);
      } else if (response?.status === 'error') {
        this._bidError$.next({ message: response.message });
      }
    });
  }

  placePreBid(lotId: string, maxAutoBid: number, traderId?: string | null): void {
    if (!this.socket?.connected) return;

    const payload: Record<string, unknown> = { lotId, maxAutoBid };
    if (traderId) payload['traderId'] = traderId;

    this.socket.emit('place_pre_bid', payload, (response: any) => {
      if (response?.status === 'success') {
        this._bidPlaced$.next(response.data);
      } else if (response?.status === 'error') {
        this._bidError$.next({ message: response.message });
      }
    });
  }

  /**
   * Extracts the user ID from a JWT token (client-side only, no signature verification).
   * The project uses `sub` as the standard JWT subject claim.
   */
  private getUserIdFromToken(token: string | null): string | null {
    if (!token) return null;
    try {
      const payload = token.split('.')[1];
      const decoded = JSON.parse(atob(payload));
      return decoded.sub || null;
    } catch {
      return null;
    }
  }

  private getRoleFromToken(token: string | null): string | null {
    if (!token) return null;
    try {
      const payload = token.split('.')[1];
      const decoded = JSON.parse(atob(payload));
      return decoded.role || null;
    } catch {
      return null;
    }
  }

  ngOnDestroy(): void {
    this.disconnect();
    this._bidUpdate$.complete();
    this._auctionExtended$.complete();
    this._auctionEnded$.complete();
    this._feedUpdate$.complete();
    this._bidPlaced$.complete();
    this._bidError$.complete();
    this._connected$.complete();
    this._reconnected$.complete();
    this._watcherCount$.complete();
    this._bidRollback$.complete();
    this._auctionPaused$.complete();
    this._auctionResumed$.complete();
  }
}
