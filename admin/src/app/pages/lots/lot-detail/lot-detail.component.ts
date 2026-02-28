import { Component, OnInit, inject } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { DecimalPipe, DatePipe } from '@angular/common';
import { LotService, ILot, IBid } from '../../../core/services/lot.service';
import { BotSettingsComponent } from '../../../components/bot-settings/bot-settings.component';

const STATUS_LABELS: Record<string, string> = {
  imported: 'Импортирован',
  active: 'Активный',
  trading: 'Торги',
  sold: 'Продан',
  cancelled: 'Отменён',
};

const FUEL_LABELS: Record<string, string> = {
  petrol: 'Бензин',
  diesel: 'Дизель',
  hybrid: 'Гибрид',
  electric: 'Электро',
  lpg: 'Газ',
  mild_hybrid: 'Мягкий гибрид',
  plug_in_hybrid: 'Плагин-гибрид',
};

const AUCTION_TYPE_LABELS: Record<string, string> = {
  timed: 'Таймерный',
  buy_now: 'Купить сейчас',
  both: 'Таймерный + Купить сейчас',
};

function toLocalDatetime(iso: string | null | undefined): string {
  if (!iso) return '';
  // Convert ISO string to local datetime-local format (YYYY-MM-DDTHH:mm)
  return new Date(iso).toISOString().slice(0, 16);
}

@Component({
  selector: 'app-lot-detail',
  standalone: true,
  imports: [FormsModule, DecimalPipe, DatePipe, RouterLink, BotSettingsComponent],
  templateUrl: './lot-detail.component.html',
  styleUrl: './lot-detail.component.scss',
})
export class LotDetailComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly lotService = inject(LotService);

  lotId = '';
  lot: ILot | null = null;
  loading = true;
  error = '';

  activeTab: 'info' | 'bids' | 'bot' = 'info';

  // Status edit
  editStatus = '';
  statusSaving = false;
  statusSaved = false;

  // Schedule edit
  editStartAt = '';
  editEndAt = '';
  editAuctionType = 'timed';
  scheduleSaving = false;
  scheduleSaved = false;
  scheduleError = '';

  // Bids tab
  bids: IBid[] = [];
  bidsTotal = 0;
  bidsPage = 1;
  bidsLimit = 20;
  bidsLoading = false;

  // Auction control (pause/resume/extend/rollback)
  controlSaving = false;
  controlError = '';
  controlSuccess = '';
  extendMinutes = 5;
  rollbackBidId: string | null = null;

  readonly statuses = ['imported', 'active', 'trading', 'sold', 'cancelled'];
  readonly statusLabels = STATUS_LABELS;
  readonly fuelLabels = FUEL_LABELS;
  readonly auctionTypeLabels = AUCTION_TYPE_LABELS;
  readonly auctionTypes = ['timed', 'buy_now', 'both'];

  ngOnInit(): void {
    this.lotId = this.route.snapshot.paramMap.get('id') ?? '';
    this.loadLot();
  }

  loadLot(): void {
    this.loading = true;
    this.error = '';
    this.lotService.getLot(this.lotId).subscribe({
      next: (lot) => {
        this.lot = lot;
        this.editStatus = lot.status;
        this.editStartAt = toLocalDatetime(lot.auctionStartAt ?? lot.auctionStart);
        this.editEndAt = toLocalDatetime(lot.auctionEndAt ?? lot.auctionEnd);
        this.editAuctionType = lot.auctionType ?? 'timed';
        this.loading = false;
      },
      error: () => {
        this.error = 'Не удалось загрузить лот';
        this.loading = false;
      },
    });
  }

  openBidsTab(): void {
    this.activeTab = 'bids';
    if (this.bids.length === 0) {
      this.loadBids();
    }
  }

  loadBids(): void {
    this.bidsLoading = true;
    this.lotService.getBids(this.lotId, this.bidsPage, this.bidsLimit).subscribe({
      next: (res) => {
        this.bids = res.data;
        this.bidsTotal = res.total;
        this.bidsLoading = false;
      },
      error: () => (this.bidsLoading = false),
    });
  }

  get bidsPages(): number {
    return Math.ceil(this.bidsTotal / this.bidsLimit);
  }

  prevBidsPage(): void {
    if (this.bidsPage > 1) { this.bidsPage--; this.loadBids(); }
  }

  nextBidsPage(): void {
    if (this.bidsPage < this.bidsPages) { this.bidsPage++; this.loadBids(); }
  }

  saveStatus(): void {
    if (!this.lot || this.editStatus === this.lot.status) return;
    this.statusSaving = true;
    this.lotService.updateStatus(this.lotId, this.editStatus).subscribe({
      next: (updated) => {
        this.lot = updated;
        this.statusSaving = false;
        this.statusSaved = true;
        setTimeout(() => (this.statusSaved = false), 3000);
      },
      error: () => (this.statusSaving = false),
    });
  }

  saveSchedule(): void {
    if (!this.editStartAt || !this.editEndAt) return;
    this.scheduleSaving = true;
    this.scheduleSaved = false;
    this.scheduleError = '';
    this.lotService.scheduleLot(this.lotId, {
      auctionStartAt: new Date(this.editStartAt).toISOString(),
      auctionEndAt: new Date(this.editEndAt).toISOString(),
      auctionType: this.editAuctionType,
    }).subscribe({
      next: (updated) => {
        this.lot = updated;
        this.scheduleSaving = false;
        this.scheduleSaved = true;
        setTimeout(() => (this.scheduleSaved = false), 3000);
      },
      error: (err) => {
        this.scheduleError = err?.error?.message ?? 'Ошибка сохранения';
        this.scheduleSaving = false;
      },
    });
  }

  get currentPriceDisplay(): number {
    if (!this.lot) return 0;
    return this.lot.currentPrice ?? this.lot.currentBid ?? this.lot.startingBid ?? 0;
  }

  get reserveMet(): boolean {
    if (!this.lot?.reservePrice) return true;
    return this.currentPriceDisplay >= this.lot.reservePrice;
  }

  get isTrading(): boolean {
    return this.lot?.status === 'trading';
  }

  pauseAuction(): void {
    this.controlSaving = true;
    this.controlError = '';
    this.lotService.pauseAuction(this.lotId).subscribe({
      next: (lot) => {
        this.lot = lot;
        this.controlSaving = false;
        this.controlSuccess = 'Аукцион приостановлен';
        setTimeout(() => (this.controlSuccess = ''), 3000);
      },
      error: (err) => {
        this.controlError = err?.error?.message ?? 'Ошибка';
        this.controlSaving = false;
      },
    });
  }

  resumeAuction(): void {
    this.controlSaving = true;
    this.controlError = '';
    this.lotService.resumeAuction(this.lotId).subscribe({
      next: (lot) => {
        this.lot = lot;
        this.editEndAt = lot.auctionEndAt ? new Date(lot.auctionEndAt).toISOString().slice(0, 16) : '';
        this.controlSaving = false;
        this.controlSuccess = 'Аукцион возобновлён';
        setTimeout(() => (this.controlSuccess = ''), 3000);
      },
      error: (err) => {
        this.controlError = err?.error?.message ?? 'Ошибка';
        this.controlSaving = false;
      },
    });
  }

  extendAuction(): void {
    if (!this.extendMinutes) return;
    this.controlSaving = true;
    this.controlError = '';
    this.lotService.extendAuction(this.lotId, this.extendMinutes).subscribe({
      next: (lot) => {
        this.lot = lot;
        this.editEndAt = lot.auctionEndAt ? new Date(lot.auctionEndAt).toISOString().slice(0, 16) : '';
        this.controlSaving = false;
        this.controlSuccess = `Таймер изменён на ${this.extendMinutes} мин`;
        setTimeout(() => (this.controlSuccess = ''), 3000);
      },
      error: (err) => {
        this.controlError = err?.error?.message ?? 'Ошибка';
        this.controlSaving = false;
      },
    });
  }

  rollbackBid(bidId: string): void {
    if (!confirm('Откатить эту ставку?')) return;
    this.lotService.rollbackBid(bidId).subscribe({
      next: (result) => {
        if (this.lot) {
          this.lot = { ...this.lot, currentPrice: result.newCurrentPrice };
        }
        this.loadBids();
        this.controlSuccess = 'Ставка откатана';
        setTimeout(() => (this.controlSuccess = ''), 3000);
      },
      error: (err) => {
        this.controlError = err?.error?.message ?? 'Ошибка отката ставки';
      },
    });
  }
}
