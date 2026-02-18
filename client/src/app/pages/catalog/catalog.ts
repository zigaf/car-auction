import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { DecimalPipe } from '@angular/common';

@Component({
  selector: 'app-catalog',
  standalone: true,
  imports: [RouterLink, FormsModule, DecimalPipe],
  templateUrl: './catalog.html',
  styleUrl: './catalog.scss',
})
export class CatalogComponent {
  showAdvancedFilters = false;
  viewMode: 'grid' | 'list' = 'grid';
  sortBy = 'date_desc';

  filters = {
    brand: '',
    model: '',
    yearFrom: null as number | null,
    yearTo: null as number | null,
    priceFrom: null as number | null,
    priceTo: null as number | null,
    fuelType: '',
    transmission: '',
    bodyType: '',
    mileageFrom: null as number | null,
    mileageTo: null as number | null,
    damageType: '',
    documentStatus: '',
    condition: '',
  };

  sortOptions = [
    { value: 'date_desc', label: 'Новые' },
    { value: 'price_asc', label: 'Цена ↑' },
    { value: 'price_desc', label: 'Цена ↓' },
    { value: 'year_desc', label: 'Год ↓' },
    { value: 'mileage_asc', label: 'Пробег ↑' },
    { value: 'ending_soon', label: 'Скоро завершение' },
    { value: 'bids_desc', label: 'По ставкам ↓' },
  ];

  brands = ['BMW', 'Mercedes-Benz', 'Audi', 'Volkswagen', 'Toyota', 'Porsche', 'Volvo', 'Peugeot', 'Renault', 'Skoda'];
  fuelTypes = ['Бензин', 'Дизель', 'Гибрид', 'Электро'];
  transmissions = ['Автомат', 'Механика'];
  bodyTypes = ['Седан', 'Хэтчбек', 'SUV', 'Универсал', 'Купе', 'Кабриолет', 'Минивэн'];
  damageTypes = ['Без повреждений', 'Фронтальный', 'Задний', 'Боковой', 'Затопление', 'Пожар'];
  documentStatuses = ['Clean Title', 'Salvage', 'Rebuilt', 'Parts Only'];
  conditions = ['Run & Drive', 'Enhanced', 'Stationary'];

  lots = [
    { id: 1, brand: 'BMW', model: '5 Series', year: 2021, currentBid: 18500, bidsCount: 12, endTime: new Date(Date.now() + 7200000), damageType: 'none', documentStatus: 'Clean Title', fuelType: 'Дизель', mileage: 45000, transmission: 'Автомат', hasBuyNow: true, buyNowPrice: 24000 },
    { id: 2, brand: 'Mercedes-Benz', model: 'E-Class', year: 2020, currentBid: 22000, bidsCount: 8, endTime: new Date(Date.now() + 18000000), damageType: 'none', documentStatus: 'Clean Title', fuelType: 'Бензин', mileage: 38000, transmission: 'Автомат', hasBuyNow: false, buyNowPrice: null },
    { id: 3, brand: 'Audi', model: 'A6', year: 2022, currentBid: 26500, bidsCount: 15, endTime: new Date(Date.now() + 1800000), damageType: 'none', documentStatus: 'Clean Title', fuelType: 'Гибрид', mileage: 21000, transmission: 'Автомат', hasBuyNow: true, buyNowPrice: 31000 },
    { id: 4, brand: 'Volkswagen', model: 'Tiguan', year: 2019, currentBid: 14200, bidsCount: 6, endTime: new Date(Date.now() + 7200000), damageType: 'rear', documentStatus: 'Salvage', fuelType: 'Дизель', mileage: 82000, transmission: 'Автомат', hasBuyNow: false, buyNowPrice: null },
    { id: 5, brand: 'Porsche', model: 'Cayenne', year: 2020, currentBid: 38000, bidsCount: 21, endTime: new Date(Date.now() + 900000), damageType: 'none', documentStatus: 'Clean Title', fuelType: 'Бензин', mileage: 55000, transmission: 'Автомат', hasBuyNow: true, buyNowPrice: 45000 },
    { id: 6, brand: 'Toyota', model: 'RAV4', year: 2021, currentBid: 19800, bidsCount: 9, endTime: new Date(Date.now() + 14400000), damageType: 'side', documentStatus: 'Rebuilt', fuelType: 'Гибрид', mileage: 32000, transmission: 'Автомат', hasBuyNow: false, buyNowPrice: null },
    { id: 7, brand: 'Volvo', model: 'XC60', year: 2021, currentBid: 24300, bidsCount: 11, endTime: new Date(Date.now() + 5400000), damageType: 'none', documentStatus: 'Clean Title', fuelType: 'Дизель', mileage: 47000, transmission: 'Автомат', hasBuyNow: true, buyNowPrice: 29000 },
    { id: 8, brand: 'Peugeot', model: '3008', year: 2020, currentBid: 12800, bidsCount: 4, endTime: new Date(Date.now() + 36000000), damageType: 'front', documentStatus: 'Salvage', fuelType: 'Дизель', mileage: 68000, transmission: 'Автомат', hasBuyNow: false, buyNowPrice: null },
  ];

  getTimeLeft(endTime: Date): string {
    const diff = endTime.getTime() - Date.now();
    if (diff <= 0) return 'Завершён';
    const h = Math.floor(diff / 3600000);
    const m = Math.floor((diff % 3600000) / 60000);
    const s = Math.floor((diff % 60000) / 1000);
    if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    return `${m}:${String(s).padStart(2, '0')}`;
  }

  getTimerClass(endTime: Date): string {
    const diff = endTime.getTime() - Date.now();
    if (diff < 30000) return 'timer--red';
    if (diff < 120000) return 'timer--yellow';
    return 'timer--green';
  }

  getDamageLabel(type: string): string {
    const map: Record<string, string> = { none: 'Без повреждений', front: 'Фронтальный', rear: 'Задний', side: 'Боковой', flood: 'Затопление', fire: 'Пожар' };
    return map[type] || type;
  }

  resetFilters(): void {
    this.filters = { brand: '', model: '', yearFrom: null, yearTo: null, priceFrom: null, priceTo: null, fuelType: '', transmission: '', bodyType: '', mileageFrom: null, mileageTo: null, damageType: '', documentStatus: '', condition: '' };
  }
}
