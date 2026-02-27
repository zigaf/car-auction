import { Component, inject, OnInit, ChangeDetectorRef } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { environment } from '../../../../environments/environment';
import { UserService } from '../../../core/services/user.service';
import { ToastService } from '../../../core/services/toast.service';
import { AppButtonComponent } from '../../../shared/components/button/button.component';
import { AppInputComponent } from '../../../shared/components/input/input.component';
import { IUser, IUpdateProfile, Language, Currency } from '../../../models/user.model';

const RESTRICTED_FLAGS = ['🇷🇺', '🇧🇾'];

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [FormsModule, AppButtonComponent, AppInputComponent],
  templateUrl: './settings.html',
  styleUrl: './settings.scss',
})
export class SettingsComponent implements OnInit {
  private readonly userService = inject(UserService);
  private readonly toastService = inject(ToastService);
  private readonly cdr = inject(ChangeDetectorRef);

  profileLoading = true;
  profileSaving = false;
  regionalSaving = false;

  profile = {
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
  };

  // Option values are emoji flags (matching countryFlag field stored in DB)
  countries = [
    { flag: '🇺🇦', name: 'Україна' },
    { flag: '🇩🇪', name: 'Deutschland' },
    { flag: '🇵🇱', name: 'Polska' },
    { flag: '🇱🇹', name: 'Lietuva' },
    { flag: '🇱🇻', name: 'Latvija' },
    { flag: '🇪🇪', name: 'Eesti' },
    { flag: '🇫🇮', name: 'Suomi' },
    { flag: '🇸🇪', name: 'Sverige' },
    { flag: '🇳🇴', name: 'Norge' },
    { flag: '🇳🇱', name: 'Nederland' },
    { flag: '🇦🇹', name: 'Österreich' },
    { flag: '🇨🇭', name: 'Schweiz' },
    { flag: '🇫🇷', name: 'France' },
    { flag: '🇮🇹', name: 'Italia' },
    { flag: '🇨🇿', name: 'Česká republika' },
    { flag: '🇸🇰', name: 'Slovensko' },
    { flag: '🇷🇴', name: 'România' },
    { flag: '🇭🇺', name: 'Magyarország' },
    { flag: '🇧🇬', name: 'България' },
    { flag: '🇷🇺', name: 'Россия' },
    { flag: '🇧🇾', name: 'Беларусь' },
    { flag: '🇰🇿', name: 'Казахстан' },
    { flag: '🇦🇿', name: 'Azərbaycan' },
    { flag: '🇬🇧', name: 'United Kingdom' },
    { flag: '🇦🇪', name: 'UAE' },
    { flag: '🌍', name: 'Другая страна' },
  ];

  languages = [
    { code: 'ru', label: 'Русский' },
    { code: 'ua', label: 'Українська' },
    { code: 'en', label: 'English' },
  ];

  currencies = [
    { code: 'EUR', symbol: '€' },
    { code: 'USD', symbol: '$' },
    { code: 'UAH', symbol: '₴' },
  ];

  selectedCountry = '🇺🇦';
  selectedLanguage = 'ru';
  selectedCurrency = 'EUR';

  notificationSettings = [
    { label: 'Ставка перебита', email: true, push: true },
    { label: 'Аукцион завершён', email: true, push: false },
    { label: 'Статус заказа', email: true, push: true },
    { label: 'Документы', email: false, push: true },
    { label: 'Новые аукционы', email: false, push: false },
  ];

  // Scraper state
  scraperLoading = false;
  scraperStatus: 'idle' | 'running' | 'success' | 'error' = 'idle';
  scraperMessage = '';
  scraperRun: any = null;
  scraperMaxPages = 1;

  get isRestrictedCountry(): boolean {
    return RESTRICTED_FLAGS.some((f) => this.selectedCountry.includes(f));
  }

  ngOnInit(): void {
    this.loadProfile();
  }

  loadProfile(): void {
    this.profileLoading = true;
    this.userService.getProfile().subscribe({
      next: (user: IUser) => {
        this.profile = {
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
          phone: user.phone || '',
        };
        // countryFlag is stored as emoji — use directly as option value
        this.selectedCountry = user.countryFlag || '🇺🇦';
        this.selectedLanguage = user.preferredLanguage || 'ru';
        this.selectedCurrency = user.preferredCurrency || 'EUR';
        this.profileLoading = false;
      },
      error: () => {
        this.profileLoading = false;
      },
    });
  }

  saveProfile(): void {
    this.profileSaving = true;

    const data: IUpdateProfile = {
      firstName: this.profile.firstName,
      lastName: this.profile.lastName,
      phone: this.profile.phone,
      countryFlag: this.selectedCountry,
      preferredLanguage: this.selectedLanguage as Language,
      preferredCurrency: this.selectedCurrency as Currency,
    };

    this.userService.updateProfile(data).subscribe({
      next: () => {
        this.profileSaving = false;
        this.toastService.success('Профиль сохранён');
      },
      error: () => {
        this.profileSaving = false;
        this.toastService.error('Ошибка сохранения профиля');
      },
    });
  }

  saveRegional(): void {
    this.regionalSaving = true;

    const data: IUpdateProfile = {
      countryFlag: this.selectedCountry,
      preferredLanguage: this.selectedLanguage as Language,
      preferredCurrency: this.selectedCurrency as Currency,
    };

    this.userService.updateProfile(data).subscribe({
      next: () => {
        this.regionalSaving = false;
        this.toastService.success('Региональные настройки сохранены');
      },
      error: () => {
        this.regionalSaving = false;
        this.toastService.error('Ошибка сохранения');
      },
    });
  }

  toggleNotification(index: number, channel: 'email' | 'push'): void {
    this.notificationSettings[index][channel] = !this.notificationSettings[index][channel];
  }

  async startScraper(): Promise<void> {
    this.scraperLoading = true;
    this.scraperStatus = 'running';
    this.scraperMessage = 'Запуск парсера...';
    this.scraperRun = null;

    try {
      const token = typeof localStorage !== 'undefined' ? localStorage.getItem('accessToken') : null;
      const response = await fetch(`${environment.apiUrl}/scraper/run`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ maxPages: this.scraperMaxPages }),
      });

      if (!response.ok) {
        const err = await response.json().catch(() => null);
        throw new Error(err?.message || `HTTP ${response.status}`);
      }

      const data = await response.json();
      this.scraperRun = data;
      this.scraperStatus = 'success';
      this.scraperMessage = `Готово! Создано: ${data.lotsCreated}, обновлено: ${data.lotsUpdated}, фото: ${data.imagesDownloaded}, ошибок: ${data.errorsCount}`;
    } catch (error: any) {
      this.scraperStatus = 'error';
      this.scraperMessage = `Ошибка: ${error.message}`;
    } finally {
      this.scraperLoading = false;
      this.cdr.detectChanges();
    }
  }

  async checkScraperStatus(): Promise<void> {
    try {
      const token = typeof localStorage !== 'undefined' ? localStorage.getItem('accessToken') : null;
      const response = await fetch(`${environment.apiUrl}/scraper/status`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const data = await response.json();
      this.scraperRun = data.latestRun;
      if (data.isRunning) {
        this.scraperStatus = 'running';
        this.scraperMessage = data.latestRun
          ? `Парсинг... Страница ${data.latestRun.pagesScraped}/${data.latestRun.totalPages}`
          : 'Парсинг запущен...';
      } else if (data.latestRun) {
        this.scraperStatus = data.latestRun.status === 'completed' ? 'success' : 'error';
        this.scraperMessage = `Последний запуск: ${data.latestRun.status} | Создано: ${data.latestRun.lotsCreated}, обновлено: ${data.latestRun.lotsUpdated}`;
      }
      this.cdr.detectChanges();
    } catch (error: any) {
      this.scraperMessage = `Не удалось получить статус: ${error.message}`;
      this.cdr.detectChanges();
    }
  }
}
