import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DecimalPipe, DatePipe } from '@angular/common';
import { LotService, ILot } from '../../core/services/lot.service';
import { BotSettingsComponent } from '../../components/bot-settings/bot-settings.component';

type Tab = 'upcoming' | 'current' | 'past' | 'plan';

@Component({
  selector: 'app-schedule',
  standalone: true,
  imports: [FormsModule, DecimalPipe, DatePipe, BotSettingsComponent],
  templateUrl: './schedule.component.html',
  styleUrl: './schedule.component.scss',
})
export class SchedulePage implements OnInit {
  private readonly lotService = inject(LotService);

  activeTab: Tab = 'upcoming';

  // ─── Auction lists ─────────────────────────────────────────────────────────
  upcomingLots: ILot[] = [];
  currentLots: ILot[] = [];
  pastLots: ILot[] = [];
  listsLoading = false;

  // ─── Lot picker for planning ────────────────────────────────────────────────
  planLots: ILot[] = [];
  planLotsLoading = false;
  lotSearch = '';
  selectedLot: ILot | null = null;

  // ─── Schedule form ──────────────────────────────────────────────────────────
  auctionStartAt = '';
  auctionEndAt = '';
  auctionType = 'timed';
  enableBot = false;
  saving = false;
  saved = false;
  saveError = '';

  readonly auctionTypes = [
    { value: 'timed', label: 'Тендер (по времени)' },
    { value: 'buy_now', label: 'Купить сейчас' },
    { value: 'both', label: 'Тендер + Купить сейчас' },
  ];

  ngOnInit(): void {
    this.loadAuctionLists();
    this.loadPlanLots();
  }

  setTab(tab: Tab): void {
    this.activeTab = tab;
    if (tab !== 'plan' && !this.listsLoading) {
      this.loadAuctionLists();
    }
  }

  loadAuctionLists(): void {
    this.listsLoading = true;
    let loaded = 0;
    const done = () => { if (++loaded === 3) this.listsLoading = false; };

    this.lotService.getLots({ limit: 50, status: 'active' }).subscribe({
      next: (res) => {
        const now = Date.now();
        this.upcomingLots = res.data.filter(l => {
          const start = l.auctionStartAt || l.auctionStart;
          return start && new Date(start).getTime() > now;
        });
        done();
      },
      error: done,
    });

    this.lotService.getLots({ limit: 50, status: 'trading' }).subscribe({
      next: (res) => { this.currentLots = res.data; done(); },
      error: done,
    });

    this.lotService.getLots({ limit: 50, status: 'sold' }).subscribe({
      next: (res) => { this.pastLots = res.data; done(); },
      error: done,
    });
  }

  loadPlanLots(): void {
    this.planLotsLoading = true;
    this.lotService.getLots({ limit: 100, search: this.lotSearch || undefined }).subscribe({
      next: (res) => {
        this.planLots = res.data.filter(l => ['imported', 'active'].includes(l.status));
        this.planLotsLoading = false;
      },
      error: () => (this.planLotsLoading = false),
    });
  }

  selectLot(lot: ILot): void {
    this.selectedLot = lot;
    const start = lot.auctionStartAt || lot.auctionStart;
    const end = lot.auctionEndAt || lot.auctionEnd;
    if (start) this.auctionStartAt = start.slice(0, 16);
    if (end) this.auctionEndAt = end.slice(0, 16);
  }

  save(): void {
    if (!this.selectedLot || !this.auctionStartAt || !this.auctionEndAt) return;
    this.saving = true;
    this.saved = false;
    this.saveError = '';

    this.lotService
      .scheduleLot(this.selectedLot.id, {
        auctionStartAt: new Date(this.auctionStartAt).toISOString(),
        auctionEndAt: new Date(this.auctionEndAt).toISOString(),
        auctionType: this.auctionType,
      })
      .subscribe({
        next: (lot) => {
          this.selectedLot = lot;
          this.saving = false;
          this.saved = true;
          setTimeout(() => (this.saved = false), 3000);
        },
        error: (err) => {
          this.saveError = err?.error?.message ?? 'Ошибка сохранения';
          this.saving = false;
        },
      });
  }

  getTimeLeft(endAt: string | null): string {
    if (!endAt) return '—';
    const diff = new Date(endAt).getTime() - Date.now();
    if (diff <= 0) return 'завершён';
    const h = Math.floor(diff / 3600000);
    const m = Math.floor((diff % 3600000) / 60000);
    if (h > 0) return `${h}ч ${m}м`;
    return `${m}м`;
  }

  getTimeUntil(startAt: string | null): string {
    if (!startAt) return '—';
    const diff = new Date(startAt).getTime() - Date.now();
    if (diff <= 0) return 'скоро';
    const d = Math.floor(diff / 86400000);
    const h = Math.floor((diff % 86400000) / 3600000);
    const m = Math.floor((diff % 3600000) / 60000);
    if (d > 0) return `через ${d}д ${h}ч`;
    if (h > 0) return `через ${h}ч ${m}м`;
    return `через ${m}м`;
  }
}
