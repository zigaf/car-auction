import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';

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

  toggleNotification(index: number, channel: 'email' | 'push'): void {
    this.notificationSettings[index][channel] = !this.notificationSettings[index][channel];
  }
}
