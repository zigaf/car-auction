import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { BotService, IBotUser, IBotConfig } from '../../core/services/bot.service';

@Component({
  selector: 'app-bots',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './bots.component.html',
  styleUrl: './bots.component.scss',
})
export class BotsPage implements OnInit {
  private readonly botService = inject(BotService);

  botUsers: IBotUser[] = [];
  configs: IBotConfig[] = [];
  loading = true;

  // Create bot user form
  showCreateForm = false;
  newEmail = '';
  newFirstName = '';
  newLastName = '';
  newCountryFlag = '';
  creating = false;
  createError = '';

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading = true;
    this.botService.getBotUsers().subscribe({
      next: (users) => {
        this.botUsers = users;
        this.botService.getConfigs().subscribe({
          next: (cfgs) => {
            this.configs = cfgs;
            this.loading = false;
          },
          error: () => (this.loading = false),
        });
      },
      error: () => (this.loading = false),
    });
  }

  createBot(): void {
    if (!this.newEmail || !this.newFirstName || !this.newLastName) return;
    this.creating = true;
    this.createError = '';
    this.botService
      .createBotUser({
        email: this.newEmail,
        firstName: this.newFirstName,
        lastName: this.newLastName,
        countryFlag: this.newCountryFlag || undefined,
      })
      .subscribe({
        next: (bot) => {
          this.botUsers = [bot, ...this.botUsers];
          this.newEmail = '';
          this.newFirstName = '';
          this.newLastName = '';
          this.newCountryFlag = '';
          this.showCreateForm = false;
          this.creating = false;
        },
        error: (err) => {
          this.createError = err?.error?.message ?? 'Ошибка создания';
          this.creating = false;
        },
      });
  }

  deleteBot(id: string): void {
    this.botService.deleteBotUser(id).subscribe({
      next: () => {
        this.botUsers = this.botUsers.filter((b) => b.id !== id);
        this.configs = this.configs.filter((c) => c.botUserId !== id);
      },
    });
  }

  toggleConfig(cfg: IBotConfig): void {
    this.botService
      .updateConfig(cfg.id, { isActive: !cfg.isActive })
      .subscribe({
        next: (updated) => {
          const idx = this.configs.findIndex((c) => c.id === cfg.id);
          if (idx !== -1) this.configs[idx] = updated;
        },
      });
  }

  deleteConfig(id: string): void {
    this.botService.deleteConfig(id).subscribe({
      next: () => {
        this.configs = this.configs.filter((c) => c.id !== id);
      },
    });
  }

  configsForBot(botId: string): IBotConfig[] {
    return this.configs.filter((c) => c.botUserId === botId);
  }
}
