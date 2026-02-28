import {
  Component,
  OnInit,
  OnDestroy,
  inject,
  ChangeDetectorRef,
  ChangeDetectionStrategy,
} from '@angular/core';
import { DecimalPipe, DatePipe, NgClass } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { io, Socket } from 'socket.io-client';
import { environment } from '../../../environments/environment';
import { LotService, ILot } from '../../core/services/lot.service';
import { ApiService } from '../../core/services/api.service';

interface FeedEntry {
  id: string;
  lotId: string;
  lotTitle: string;
  amount: number;
  bidderFlag: string;
  isAutoBid: boolean;
  timestamp: string;
}

interface MonitorLot {
  lot: ILot;
  remainingMs: number;
  isPaused: boolean;
  saving: boolean;
  extendMinutes: number;
}

@Component({
  selector: 'app-monitor',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DecimalPipe, DatePipe, NgClass, FormsModule, RouterLink],
  templateUrl: './monitor.component.html',
  styleUrl: './monitor.component.scss',
})
export class MonitorComponent implements OnInit, OnDestroy {
  private readonly lotService = inject(LotService);
  private readonly api = inject(ApiService);
  private readonly cdr = inject(ChangeDetectorRef);

  monitorLots: MonitorLot[] = [];
  feedEntries: FeedEntry[] = [];
  wsStatus: 'connecting' | 'connected' | 'error' = 'connecting';

  private socket: Socket | null = null;
  private tickInterval: ReturnType<typeof setInterval> | null = null;
  private feedCounter = 0;

  ngOnInit(): void {
    this.loadActiveLots();
    this.connectSocket();
    this.tickInterval = setInterval(() => this.tick(), 1000);
  }

  ngOnDestroy(): void {
    if (this.tickInterval) clearInterval(this.tickInterval);
    if (this.socket) {
      this.socket.emit('leave_feed', 'global');
      this.socket.disconnect();
    }
  }

  loadActiveLots(): void {
    this.lotService.getActiveLots().subscribe({
      next: (lots) => {
        const now = Date.now();
        this.monitorLots = lots.map((lot) => ({
          lot,
          remainingMs: lot.isPaused
            ? (lot.pausedRemainingMs ?? 0)
            : lot.auctionEndAt
              ? Math.max(0, new Date(lot.auctionEndAt).getTime() - now)
              : 0,
          isPaused: lot.isPaused,
          saving: false,
          extendMinutes: 5,
        }));
        this.cdr.markForCheck();
      },
    });
  }

  private connectSocket(): void {
    const token = localStorage.getItem('accessToken');
    if (!token) {
      this.wsStatus = 'error';
      return;
    }

    this.socket = io(`${environment.wsUrl}/auction`, {
      auth: { token },
      transports: ['websocket'],
    });

    this.socket.on('connect', () => {
      this.wsStatus = 'connected';
      this.socket!.emit('join_feed', 'global');
      this.cdr.markForCheck();
    });

    this.socket.on('disconnect', () => {
      this.wsStatus = 'error';
      this.cdr.markForCheck();
    });

    this.socket.on('connect_error', () => {
      this.wsStatus = 'error';
      this.cdr.markForCheck();
    });

    this.socket.on('feed_update', (data: {
      lotId: string;
      amount: number;
      bidderFlag: string;
      isAutoBid: boolean;
      lotTitle: string;
      timestamp: string;
    }) => {
      this.addFeedEntry({
        id: `${++this.feedCounter}`,
        lotId: data.lotId,
        lotTitle: data.lotTitle,
        amount: data.amount,
        bidderFlag: data.bidderFlag,
        isAutoBid: data.isAutoBid,
        timestamp: data.timestamp,
      });
      // Update lot current price in monitor list
      const ml = this.monitorLots.find((m) => m.lot.id === data.lotId);
      if (ml) {
        ml.lot = { ...ml.lot, currentPrice: data.amount };
      }
      this.cdr.markForCheck();
    });

    this.socket.on('auction_ended', (data: { lotId: string; winnerId: string | null; finalPrice: number }) => {
      this.monitorLots = this.monitorLots.filter((m) => m.lot.id !== data.lotId);
      this.cdr.markForCheck();
    });

    this.socket.on('auction_paused', (data: { lotId: string; pausedRemainingMs: number }) => {
      const ml = this.monitorLots.find((m) => m.lot.id === data.lotId);
      if (ml) {
        ml.isPaused = true;
        ml.remainingMs = data.pausedRemainingMs;
        ml.lot = { ...ml.lot, isPaused: true };
      }
      this.cdr.markForCheck();
    });

    this.socket.on('auction_resumed', (data: { lotId: string; newEndAt: string }) => {
      const ml = this.monitorLots.find((m) => m.lot.id === data.lotId);
      if (ml) {
        ml.isPaused = false;
        ml.remainingMs = Math.max(0, new Date(data.newEndAt).getTime() - Date.now());
        ml.lot = { ...ml.lot, isPaused: false, auctionEndAt: data.newEndAt };
      }
      this.cdr.markForCheck();
    });
  }

  private addFeedEntry(entry: FeedEntry): void {
    this.feedEntries.unshift(entry);
    if (this.feedEntries.length > 100) {
      this.feedEntries = this.feedEntries.slice(0, 100);
    }
  }

  private tick(): void {
    let changed = false;
    for (const ml of this.monitorLots) {
      if (!ml.isPaused && ml.remainingMs > 0) {
        ml.remainingMs = Math.max(0, ml.remainingMs - 1000);
        changed = true;
      }
    }
    if (changed) this.cdr.markForCheck();
  }

  formatRemaining(ms: number): string {
    if (ms <= 0) return '00:00:00';
    const s = Math.floor(ms / 1000);
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    return [h, m, sec].map((v) => String(v).padStart(2, '0')).join(':');
  }

  pauseLot(ml: MonitorLot): void {
    ml.saving = true;
    this.lotService.pauseAuction(ml.lot.id).subscribe({
      next: (lot) => {
        ml.lot = lot;
        ml.isPaused = true;
        ml.remainingMs = lot.pausedRemainingMs ?? ml.remainingMs;
        ml.saving = false;
        this.cdr.markForCheck();
      },
      error: () => { ml.saving = false; this.cdr.markForCheck(); },
    });
  }

  resumeLot(ml: MonitorLot): void {
    ml.saving = true;
    this.lotService.resumeAuction(ml.lot.id).subscribe({
      next: (lot) => {
        ml.lot = lot;
        ml.isPaused = false;
        ml.remainingMs = lot.auctionEndAt
          ? Math.max(0, new Date(lot.auctionEndAt).getTime() - Date.now())
          : 0;
        ml.saving = false;
        this.cdr.markForCheck();
      },
      error: () => { ml.saving = false; this.cdr.markForCheck(); },
    });
  }

  extendLot(ml: MonitorLot): void {
    if (!ml.extendMinutes) return;
    ml.saving = true;
    this.lotService.extendAuction(ml.lot.id, ml.extendMinutes).subscribe({
      next: (lot) => {
        ml.lot = lot;
        if (lot.isPaused) {
          ml.remainingMs = lot.pausedRemainingMs ?? ml.remainingMs;
        } else {
          ml.remainingMs = lot.auctionEndAt
            ? Math.max(0, new Date(lot.auctionEndAt).getTime() - Date.now())
            : 0;
        }
        ml.saving = false;
        this.cdr.markForCheck();
      },
      error: () => { ml.saving = false; this.cdr.markForCheck(); },
    });
  }

  trackByLotId(_: number, ml: MonitorLot): string {
    return ml.lot.id;
  }

  trackByFeedId(_: number, entry: FeedEntry): string {
    return entry.id;
  }
}
