import { Component, inject, OnInit, ChangeDetectorRef } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { environment } from '../../../../environments/environment';
import { UserService } from '../../../core/services/user.service';
import { IUser, IUpdateProfile, Language, Currency } from '../../../models/user.model';

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './settings.html',
  styleUrl: './settings.scss',
})
export class SettingsComponent implements OnInit {
  private readonly userService = inject(UserService);
  private readonly cdr = inject(ChangeDetectorRef);

  profileLoading = true;
  profileSaving = false;
  profileSaveMessage = '';
  profileSaveStatus: 'idle' | 'success' | 'error' = 'idle';

  profile = {
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
  };

  countries = [
    { code: 'UA', name: 'Україна', flag: '\u{1F1FA}\u{1F1E6}' },
    { code: 'DE', name: 'Deutschland', flag: '\u{1F1E9}\u{1F1EA}' },
    { code: 'PL', name: 'Polska', flag: '\u{1F1F5}\u{1F1F1}' },
    { code: 'LT', name: 'Lietuva', flag: '\u{1F1F1}\u{1F1F9}' },
  ];

  languages = [
    { code: 'ru', label: 'Русский' },
    { code: 'ua', label: 'Українська' },
    { code: 'en', label: 'English' },
  ];

  currencies = [
    { code: 'EUR', symbol: '\u{20AC}' },
    { code: 'USD', symbol: '$' },
    { code: 'UAH', symbol: '\u{20B4}' },
  ];

  selectedCountry = 'UA';
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
        this.selectedCountry = user.countryFlag || 'UA';
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
    this.profileSaveMessage = '';
    this.profileSaveStatus = 'idle';

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
        this.profileSaveStatus = 'success';
        this.profileSaveMessage = 'Профиль сохранён';
      },
      error: () => {
        this.profileSaving = false;
        this.profileSaveStatus = 'error';
        this.profileSaveMessage = 'Ошибка сохранения профиля';
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
