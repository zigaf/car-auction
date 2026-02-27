import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { LotService, ILot } from '../../core/services/lot.service';
import { BotSettingsComponent } from '../../components/bot-settings/bot-settings.component';

@Component({
  selector: 'app-schedule',
  standalone: true,
  imports: [FormsModule, BotSettingsComponent],
  templateUrl: './schedule.component.html',
  styleUrl: './schedule.component.scss',
})
export class SchedulePage implements OnInit {
  private readonly lotService = inject(LotService);

  // Lot search
  lots: ILot[] = [];
  lotsLoading = false;
  lotSearch = '';

  selectedLot: ILot | null = null;

  // Schedule form
  auctionStartAt = '';
  auctionEndAt = '';
  auctionType = 'timed';

  // Bot section
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
    this.loadLots();
  }

  loadLots(): void {
    this.lotsLoading = true;
    this.lotService.getLots({ limit: 100, search: this.lotSearch || undefined }).subscribe({
      next: (res) => {
        this.lots = res.data.filter((l) => ['imported', 'active'].includes(l.status));
        this.lotsLoading = false;
      },
      error: () => (this.lotsLoading = false),
    });
  }

  selectLot(lot: ILot): void {
    this.selectedLot = lot;
    if (lot.auctionStart) this.auctionStartAt = lot.auctionStart.slice(0, 16);
    if (lot.auctionEnd) this.auctionEndAt = lot.auctionEnd.slice(0, 16);
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
}
