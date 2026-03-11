import { Component, inject, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
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
}
