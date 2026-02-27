import { Component, Input, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { BotService, IBotUser, IBotConfig, BotPattern } from '../../core/services/bot.service';

@Component({
  selector: 'app-bot-settings',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './bot-settings.component.html',
  styleUrl: './bot-settings.component.scss',
})
export class BotSettingsComponent implements OnInit {
  @Input() lotId = '';

  private readonly botService = inject(BotService);

  botUsers: IBotUser[] = [];
  existingConfig: IBotConfig | null = null;
  loading = true;
  saving = false;
  saved = false;
  saveError = '';

  selectedBotUserId = '';
  maxPrice = 0;
  pattern: BotPattern = 'AGGRESSIVE';
  isActive = true;
  minDelaySec = 2;
  maxDelaySec = 10;

  readonly patterns: { value: BotPattern; label: string; desc: string }[] = [
    { value: 'AGGRESSIVE', label: 'Агрессивный', desc: 'Перебивает через 2–5 сек' },
    { value: 'STEADY', label: 'Регулярный', desc: 'Ставит каждые N секунд' },
    { value: 'SNIPER', label: 'Снайпер', desc: 'Только последние 30 сек' },
    { value: 'RANDOM', label: 'Случайный', desc: 'Случайная задержка' },
  ];

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading = true;
    this.botService.getBotUsers().subscribe({
      next: (users) => {
        this.botUsers = users;
        this.botService.getConfigs(this.lotId).subscribe({
          next: (configs) => {
            this.existingConfig = configs[0] ?? null;
            if (this.existingConfig) this.fillForm(this.existingConfig);
            this.loading = false;
          },
          error: () => (this.loading = false),
        });
      },
      error: () => (this.loading = false),
    });
  }

  fillForm(cfg: IBotConfig): void {
    this.selectedBotUserId = cfg.botUserId;
    this.maxPrice = cfg.maxPrice;
    this.pattern = cfg.pattern;
    this.isActive = cfg.isActive;
    this.minDelaySec = cfg.minDelaySec;
    this.maxDelaySec = cfg.maxDelaySec;
  }

  save(): void {
    if (!this.selectedBotUserId || !this.maxPrice) return;
    this.saving = true;
    this.saved = false;
    this.saveError = '';

    const payload = {
      lotId: this.lotId,
      botUserId: this.selectedBotUserId,
      maxPrice: this.maxPrice,
      pattern: this.pattern,
      isActive: this.isActive,
      minDelaySec: this.minDelaySec,
      maxDelaySec: this.maxDelaySec,
    };

    const obs$ = this.existingConfig
      ? this.botService.updateConfig(this.existingConfig.id, payload)
      : this.botService.createConfig(payload);

    obs$.subscribe({
      next: (cfg) => {
        this.existingConfig = cfg;
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

  toggleActive(): void {
    if (!this.existingConfig) return;
    this.botService
      .updateConfig(this.existingConfig.id, { isActive: !this.existingConfig.isActive })
      .subscribe({
        next: (cfg) => {
          this.existingConfig = cfg;
          this.isActive = cfg.isActive;
        },
      });
  }
}
