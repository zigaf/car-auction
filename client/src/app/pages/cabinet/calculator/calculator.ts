import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DecimalPipe } from '@angular/common';
import {
  CalculatorService,
  CustomsBreakdown,
  FuelTypeCalc,
} from '../../../core/services/calculator.service';
import { AppButtonComponent } from '../../../shared/components/button/button.component';
import { AppInputComponent } from '../../../shared/components/input/input.component';

interface FuelOption {
  value: FuelTypeCalc;
  label: string;
}

@Component({
  selector: 'app-calculator',
  standalone: true,
  imports: [FormsModule, DecimalPipe, AppButtonComponent, AppInputComponent],
  templateUrl: './calculator.html',
  styleUrl: './calculator.scss',
})
export class CalculatorComponent {
  private readonly calculatorService = inject(CalculatorService);

  // Form
  carPrice = 0;
  year = new Date().getFullYear() - 3;
  engineVolume = 1600;
  fuelType: FuelTypeCalc = 'petrol';
  deliveryCost = 800;
  companyCost = 0;

  // State
  loading = false;
  result: CustomsBreakdown | null = null;
  error = '';

  readonly currentYear = new Date().getFullYear();

  readonly fuelOptions: FuelOption[] = [
    { value: 'petrol', label: 'Бензин' },
    { value: 'diesel', label: 'Дизель' },
    { value: 'hybrid', label: 'Гибрид' },
    { value: 'electric', label: 'Электро' },
  ];

  calculate(): void {
    if (!this.carPrice || this.carPrice <= 0) {
      this.error = 'Введите стоимость автомобиля';
      return;
    }

    this.loading = true;
    this.error = '';
    this.result = null;

    this.calculatorService
      .calculateCustoms({
        carPrice: this.carPrice,
        year: this.year,
        engineVolume: this.fuelType === 'electric' ? 0 : this.engineVolume,
        fuelType: this.fuelType,
        deliveryCost: this.deliveryCost,
        companyCost: this.companyCost,
      })
      .subscribe({
        next: (res) => {
          this.result = res;
          this.loading = false;
        },
        error: () => {
          this.error = 'Ошибка при расчёте. Попробуйте ещё раз.';
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
}
