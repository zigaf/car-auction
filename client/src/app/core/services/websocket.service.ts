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
} from '../../models/auction.model';

@Injectable({ providedIn: 'root' })
export class WebsocketService implements OnDestroy {
  private socket: Socket | null = null;

  private readonly _connected$ = new BehaviorSubject<boolean>(false);
  private readonly _bidUpdate$ = new Subject<IBidUpdate>();
  private readonly _auctionExtended$ = new Subject<IAuctionExtended>();
  private readonly _auctionEnded$ = new Subject<IAuctionEnded>();
  private readonly _feedUpdate$ = new Subject<IFeedUpdate>();
  private readonly _bidPlaced$ = new Subject<IPlaceBidResult>();
  private readonly _bidError$ = new Subject<{ message: string }>();

  readonly connected$: Observable<boolean> = this._connected$.asObservable();
  readonly bidUpdate$: Observable<IBidUpdate> = this._bidUpdate$.asObservable();
  readonly auctionExtended$: Observable<IAuctionExtended> = this._auctionExtended$.asObservable();
  readonly auctionEnded$: Observable<IAuctionEnded> = this._auctionEnded$.asObservable();
  readonly feedUpdate$: Observable<IFeedUpdate> = this._feedUpdate$.asObservable();
  readonly bidPlaced$: Observable<IPlaceBidResult> = this._bidPlaced$.asObservable();
  readonly bidError$: Observable<{ message: string }> = this._bidError$.asObservable();

  connect(): void {
    if (typeof window === 'undefined') return;
    if (this.socket?.connected) return;

    // Dynamic import to avoid SSR issues with socket.io-client
    import('socket.io-client').then(({ io }) => {
      const token = typeof localStorage !== 'undefined'
        ? localStorage.getItem('accessToken')
        : null;

      const userId = this.getUserIdFromToken(token);

      this.socket = io(`${environment.wsUrl}/auction`, {
        auth: { token, userId },
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionAttempts: 10,
        reconnectionDelay: 1000,
      });

      this.socket.on('connect', () => {
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

  placeBid(lotId: string, amount: number): void {
    if (!this.socket?.connected) return;

    const idempotencyKey = typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;

    this.socket.emit('place_bid', { lotId, amount, idempotencyKey }, (response: any) => {
      if (response?.event === 'bid_placed') {
        this._bidPlaced$.next(response.data);
      } else if (response?.event === 'bid_error') {
        this._bidError$.next(response.data);
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

  ngOnDestroy(): void {
    this.disconnect();
    this._bidUpdate$.complete();
    this._auctionExtended$.complete();
    this._auctionEnded$.complete();
    this._feedUpdate$.complete();
    this._bidPlaced$.complete();
    this._bidError$.complete();
    this._connected$.complete();
  }
}
