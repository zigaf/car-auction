import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { NgFor, NgIf, DecimalPipe } from '@angular/common';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [RouterLink, NgFor, NgIf, DecimalPipe],
  templateUrl: './home.html',
  styleUrl: './home.scss',
})
export class HomeComponent {
  categories = [
    { name: 'Все автомобили', count: 2547, active: true },
    { name: 'Классические', count: 423, active: false },
    { name: 'Спорткары', count: 312, active: false },
    { name: 'Внедорожники', count: 567, active: false },
    { name: 'Седаны', count: 445, active: false },
    { name: 'Купе', count: 234, active: false },
    { name: 'Кабриолеты', count: 156, active: false },
    { name: 'Пикапы', count: 189, active: false },
    { name: 'Электромобили', count: 98, active: false },
    { name: 'Мотоциклы', count: 123, active: false },
  ];

  popularBrands = [
    { name: 'Porsche', count: 342 },
    { name: 'BMW', count: 523 },
    { name: 'Mercedes', count: 467 },
    { name: 'Ferrari', count: 89 },
    { name: 'Land Rover', count: 234 },
    { name: 'Toyota', count: 312 },
    { name: 'Audi', count: 398 },
    { name: 'Lamborghini', count: 45 },
  ];

  activeAuctions = [
    { id: 7, brand: 'Porsche', model: '911 Carrera', year: 2019, mileage: 28000, transmission: 'PDK', city: 'Мюнхен', currentBid: 67500, bidsCount: 34, endTime: new Date(Date.now() + 3600000), noReserve: true, image: 'https://placehold.co/400x260/f0f0f5/4F46E5?text=Porsche+911' },
    { id: 8, brand: 'BMW', model: 'M4 Competition', year: 2022, mileage: 12000, transmission: 'Автомат', city: 'Берлин', currentBid: 52000, bidsCount: 18, endTime: new Date(Date.now() + 7200000), noReserve: false, image: 'https://placehold.co/400x260/f0f0f5/4F46E5?text=BMW+M4' },
    { id: 9, brand: 'Mercedes', model: 'G63 AMG', year: 2021, mileage: 35000, transmission: 'Автомат', city: 'Штутгарт', currentBid: 89000, bidsCount: 42, endTime: new Date(Date.now() + 1800000), noReserve: true, image: 'https://placehold.co/400x260/f0f0f5/4F46E5?text=Mercedes+G63' },
    { id: 10, brand: 'Audi', model: 'RS6 Avant', year: 2023, mileage: 8000, transmission: 'Автомат', city: 'Ингольштадт', currentBid: 78000, bidsCount: 27, endTime: new Date(Date.now() + 5400000), noReserve: false, image: 'https://placehold.co/400x260/f0f0f5/4F46E5?text=Audi+RS6' },
    { id: 11, brand: 'Ferrari', model: 'F8 Tributo', year: 2020, mileage: 9500, transmission: 'Автомат', city: 'Маранелло', currentBid: 195000, bidsCount: 56, endTime: new Date(Date.now() + 900000), noReserve: true, image: 'https://placehold.co/400x260/f0f0f5/4F46E5?text=Ferrari+F8' },
    { id: 12, brand: 'Land Rover', model: 'Defender V8', year: 2022, mileage: 18000, transmission: 'Автомат', city: 'Лондон', currentBid: 62000, bidsCount: 19, endTime: new Date(Date.now() + 4200000), noReserve: false, image: 'https://placehold.co/400x260/f0f0f5/4F46E5?text=Defender+V8' },
  ];

  steps = [
    { title: 'Регистрация', desc: 'Создайте аккаунт и пройдите верификацию' },
    { title: 'Пополните баланс', desc: 'Внесите депозит для участия в торгах' },
    { title: 'Выберите авто', desc: 'Найдите автомобиль в каталоге или на live-торгах' },
    { title: 'Сделайте ставку', desc: 'Участвуйте в аукционе в реальном времени' },
    { title: 'Оплатите лот', desc: 'После победы оплатите автомобиль' },
    { title: 'Доставка и растаможка', desc: 'Мы доставим и растаможим авто для вас' },
    { title: 'Получите авто', desc: 'Заберите автомобиль по вашему адресу' },
  ];

  endingSoon = [
    { id: 1, brand: 'BMW', model: '5 Series', trim: '530d xDrive', year: 2021, mileage: 45200, fuel: 'Дизель', currentBid: 18500, bidsCount: 12, endTime: new Date(Date.now() + 1200000), image: 'https://placehold.co/400x260/f0f0f5/4F46E5?text=BMW+5' },
    { id: 2, brand: 'Mercedes', model: 'E-Class', trim: 'E220d AMG', year: 2020, mileage: 38000, fuel: 'Дизель', currentBid: 22000, bidsCount: 8, endTime: new Date(Date.now() + 540000), image: 'https://placehold.co/400x260/f0f0f5/4F46E5?text=Mercedes+E' },
    { id: 3, brand: 'Audi', model: 'A6 Avant', trim: '40 TDI', year: 2022, mileage: 21000, fuel: 'Дизель', currentBid: 26500, bidsCount: 15, endTime: new Date(Date.now() + 300000), image: 'https://placehold.co/400x260/f0f0f5/4F46E5?text=Audi+A6' },
    { id: 4, brand: 'Porsche', model: 'Cayenne', trim: 'S', year: 2020, mileage: 55000, fuel: 'Бензин', currentBid: 38000, bidsCount: 21, endTime: new Date(Date.now() + 2400000), image: 'https://placehold.co/400x260/f0f0f5/4F46E5?text=Porsche' },
    { id: 5, brand: 'Volvo', model: 'XC60', trim: 'D5 AWD', year: 2021, mileage: 47000, fuel: 'Дизель', currentBid: 24300, bidsCount: 11, endTime: new Date(Date.now() + 1800000), image: 'https://placehold.co/400x260/f0f0f5/4F46E5?text=Volvo+XC60' },
    { id: 6, brand: 'Toyota', model: 'RAV4', trim: 'Hybrid', year: 2021, mileage: 32000, fuel: 'Гибрид', currentBid: 19800, bidsCount: 9, endTime: new Date(Date.now() + 600000), image: 'https://placehold.co/400x260/f0f0f5/4F46E5?text=Toyota+RAV4' },
  ];

  popularTags = ['Porsche 911', 'BMW M3', 'Mercedes W124', 'Land Cruiser', 'Ferrari'];

  platformStats = [
    { icon: 'sell', value: '15,847', label: 'Продано автомобилей', sublabel: 'за все время', color: '#4F46E5' },
    { icon: 'inventory_2', value: '2,547', label: 'Активных аукционов', sublabel: 'прямо сейчас', color: '#22C55E' },
    { icon: 'group', value: '124,500+', label: 'Пользователей', sublabel: 'доверяют нам', color: '#F59E0B' },
    { icon: 'payments', value: '$2.4B', label: 'Общий объём продаж', sublabel: 'с 2018 года', color: '#3B82F6' },
  ];

  getTimeLeft(endTime: Date): string {
    const diff = endTime.getTime() - Date.now();
    if (diff <= 0) return '0:00';
    const h = Math.floor(diff / 3600000);
    const m = Math.floor((diff % 3600000) / 60000);
    const s = Math.floor((diff % 60000) / 1000);
    if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    return `${m}:${String(s).padStart(2, '0')}`;
  }

  getTimerClass(endTime: Date): string {
    const diff = endTime.getTime() - Date.now();
    if (diff < 300000) return 'timer--red';
    if (diff < 900000) return 'timer--yellow';
    return 'timer--green';
  }
}
