import { Component, inject, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { UserService } from '../../../core/services/user.service';
import { ToastService } from '../../../core/services/toast.service';
import { LanguageService } from '../../../core/services/language.service';
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
  readonly ls = inject(LanguageService);

  profileLoading = true;
  profileSaving = false;
  regionalSaving = false;

  profile = {
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
  };

  countries = [
    { flag: '🇺🇦', name: 'Украина' },
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

  languages: { code: Language; label: string }[] = [
    { code: Language.RU, label: 'Русский' },
    { code: Language.BY, label: 'Беларуская' },
  ];

  currencies: { code: Currency; symbol: string }[] = [
    { code: Currency.EUR, symbol: '€' },
    { code: Currency.USD, symbol: '$' },
    { code: Currency.BYN, symbol: 'Br' },
  ];

  selectedCountry = '🇧🇾';
  selectedLanguage: Language = Language.RU;
  selectedCurrency: Currency = Currency.EUR;

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
        this.selectedCountry = user.countryFlag || '🇧🇾';
        this.selectedLanguage = user.preferredLanguage || Language.RU;
        this.selectedCurrency = user.preferredCurrency || Currency.EUR;
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
      preferredLanguage: this.selectedLanguage,
      preferredCurrency: this.selectedCurrency,
    };

    this.userService.updateProfile(data).subscribe({
      next: () => {
        this.profileSaving = false;
        this.ls.setLang(this.selectedLanguage);
        this.toastService.success(this.ls.t('settings.saved.profile'));
      },
      error: () => {
        this.profileSaving = false;
        this.toastService.error(this.ls.t('settings.error.profile'));
      },
    });
  }

  saveRegional(): void {
    this.regionalSaving = true;

    const data: IUpdateProfile = {
      countryFlag: this.selectedCountry,
      preferredLanguage: this.selectedLanguage,
      preferredCurrency: this.selectedCurrency,
    };

    this.userService.updateProfile(data).subscribe({
      next: () => {
        this.regionalSaving = false;
        this.ls.setLang(this.selectedLanguage);
        this.toastService.success(this.ls.t('settings.saved.regional'));
      },
      error: () => {
        this.regionalSaving = false;
        this.toastService.error(this.ls.t('settings.error.regional'));
      },
    });
  }
}
