import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { environment } from '../../../../environments/environment';

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './settings.html',
  styleUrl: './settings.scss',
})
export class SettingsComponent {
  profile = {
    firstName: 'Максим',
    lastName: 'Наливайко',
    email: 'maks.nalyvaiko@gmail.com',
    phone: '+380 67 123 4567',
  };

  countries = [
    { code: 'UA', name: 'Україна', flag: '🇺🇦' },
    { code: 'DE', name: 'Deutschland', flag: '🇩🇪' },
    { code: 'PL', name: 'Polska', flag: '🇵🇱' },
    { code: 'LT', name: 'Lietuva', flag: '🇱🇹' },
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

  toggleNotification(index: number, channel: 'email' | 'push'): void {
    this.notificationSettings[index][channel] = !this.notificationSettings[index][channel];
  }

  async startScraper(): Promise<void> {
    this.scraperLoading = true;
    this.scraperStatus = 'running';
    this.scraperMessage = 'Запуск парсера...';
    this.scraperRun = null;

    try {
      const token = localStorage.getItem('accessToken');
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
    }
  }

  async checkScraperStatus(): Promise<void> {
    try {
      const token = localStorage.getItem('accessToken');
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
    } catch (error: any) {
      this.scraperMessage = `Не удалось получить статус: ${error.message}`;
    }
  }
}
