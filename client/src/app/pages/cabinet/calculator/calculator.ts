import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DecimalPipe } from '@angular/common';
import {
  CalculatorService,
  CustomsBreakdown,
  FuelTypeCalc,
  CalcCountry,
} from '../../../core/services/calculator.service';
import { AppButtonComponent } from '../../../shared/components/button/button.component';
import { AppInputComponent } from '../../../shared/components/input/input.component';
import { LanguageService } from '../../../core/services/language.service';

interface FuelOption {
  value: FuelTypeCalc;
  label: string;
}

interface CountryOption {
  value: string;
  label: string;
}

const DELIVERY_TABLE: Record<string, Record<CalcCountry, number>> = {
  belgium:     { russia: 1200, belarus: 800 },
  netherlands: { russia: 1200, belarus: 800 },
  germany:     { russia: 1100, belarus: 700 },
  france:      { russia: 1300, belarus: 900 },
  italy:       { russia: 1400, belarus: 1000 },
  spain:       { russia: 1500, belarus: 1100 },
  poland:      { russia: 900,  belarus: 500 },
  lithuania:   { russia: 800,  belarus: 400 },
};

const ORIGIN_COUNTRIES: CountryOption[] = [
  { value: 'belgium', label: 'Бельгия' },
  { value: 'netherlands', label: 'Нидерланды' },
  { value: 'germany', label: 'Германия' },
  { value: 'france', label: 'Франция' },
  { value: 'italy', label: 'Италия' },
  { value: 'spain', label: 'Испания' },
  { value: 'poland', label: 'Польша' },
  { value: 'lithuania', label: 'Литва' },
];

const DEST_COUNTRIES: CountryOption[] = [
  { value: 'russia', label: 'Россия' },
  { value: 'belarus', label: 'Беларусь' },
];

@Component({
  selector: 'app-calculator',
  standalone: true,
  imports: [FormsModule, DecimalPipe, AppButtonComponent, AppInputComponent],
  templateUrl: './calculator.html',
  styleUrl: './calculator.scss',
})
export class CalculatorComponent {
  ls = inject(LanguageService);
  private readonly calculatorService = inject(CalculatorService);

  // Form
  country: CalcCountry = 'russia';
  carPrice = 0;
  year = new Date().getFullYear() - 3;
  engineVolume = 1600;
  fuelType: FuelTypeCalc = 'petrol';
  originCountry = '';
  destinationCountry = '';
  deliveryCost = 0;

  // State
  loading = false;
  result: CustomsBreakdown | null = null;
  error = '';

  readonly currentYear = new Date().getFullYear();
  readonly originCountries = ORIGIN_COUNTRIES;
  readonly destCountries = DEST_COUNTRIES;

  get fuelOptions(): FuelOption[] {
    return [
      { value: 'petrol', label: this.ls.t('fuel.petrol') },
      { value: 'diesel', label: this.ls.t('fuel.diesel') },
      { value: 'hybrid', label: this.ls.t('fuel.hybrid') },
      { value: 'electric', label: this.ls.t('fuel.electric') },
    ];
  }

  onCountryChange(): void {
    this.destinationCountry = this.country;
    this.updateDeliveryCost();
    this.reset();
  }

  onOriginChange(): void {
    this.updateDeliveryCost();
  }

  onDestinationChange(): void {
    this.updateDeliveryCost();
  }

  private updateDeliveryCost(): void {
    if (this.originCountry && this.destinationCountry) {
      const entry = DELIVERY_TABLE[this.originCountry];
      if (entry && entry[this.destinationCountry as CalcCountry] !== undefined) {
        this.deliveryCost = entry[this.destinationCountry as CalcCountry];
        return;
      }
    }
    this.deliveryCost = 0;
  }

  calculate(): void {
    if (!this.carPrice || this.carPrice <= 0) {
      this.error = this.ls.t('calc.error.price');
      return;
    }

    this.loading = true;
    this.error = '';
    this.result = null;

    this.calculatorService
      .calculateCustoms({
        country: this.country,
        carPrice: this.carPrice,
        year: this.year,
        engineVolume: this.fuelType === 'electric' ? 0 : this.engineVolume,
        fuelType: this.fuelType,
        originCountry: this.originCountry || undefined,
        destinationCountry: this.destinationCountry || undefined,
        deliveryCost: this.deliveryCost,
      })
      .subscribe({
        next: (res) => {
          this.result = res;
          this.loading = false;
        },
        error: () => {
          this.error = this.ls.t('calc.error.calc');
          this.loading = false;
        },
      });
  }

  reset(): void {
    this.result = null;
    this.error = '';
  }

  get isElectric(): boolean {
    return this.fuelType === 'electric';
  }

  getAgeText(years: number): string {
    return this.ls.t('calc.result.age').replace('{n}', String(years));
  }
}
