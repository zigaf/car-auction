import { Component, afterNextRender } from '@angular/core';
import { RouterLink } from '@angular/router';
import { DecimalPipe } from '@angular/common';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [RouterLink, DecimalPipe],
  templateUrl: './home.html',
  styleUrl: './home.scss',
})
export class HomeComponent {
  loading = true;
  lots: any[] = [];
  recentLots: any[] = [];
  brands: { brand: string; count: number }[] = [];
  stats = { totalLots: 0, totalBrands: 0, countries: 0, withPhotos: 0 };

  steps = [
    { title: 'Регистрация', desc: 'Создайте аккаунт и пройдите верификацию' },
    { title: 'Пополните баланс', desc: 'Внесите депозит для участия в торгах' },
    { title: 'Выберите авто', desc: 'Найдите автомобиль в каталоге или на live-торгах' },
    { title: 'Сделайте ставку', desc: 'Участвуйте в аукционе в реальном времени' },
    { title: 'Оплатите лот', desc: 'После победы оплатите автомобиль' },
    { title: 'Доставка и растаможка', desc: 'Мы доставим и растаможим авто для вас' },
    { title: 'Получите авто', desc: 'Заберите автомобиль по вашему адресу' },
  ];

  popularTags = ['Porsche 911', 'BMW M3', 'Mercedes W124', 'Land Cruiser', 'Ferrari'];

  constructor() {
    afterNextRender(() => {
      this.loadData();
    });
  }

  async loadData(): Promise<void> {
    this.loading = true;
    try {
      const [lotsResp, recentResp, brandsResp, statsResp] = await Promise.all([
        fetch(`${environment.apiUrl}/lots?limit=6&sort=price_desc`),
        fetch(`${environment.apiUrl}/lots?limit=6&sort=date_desc`),
        fetch(`${environment.apiUrl}/lots/brands`),
        fetch(`${environment.apiUrl}/lots/stats`),
      ]);

      if (lotsResp.ok) {
        const data = await lotsResp.json();
        this.lots = data.data || [];
      }
      if (recentResp.ok) {
        const data = await recentResp.json();
        this.recentLots = data.data || [];
      }
      if (brandsResp.ok) {
        this.brands = await brandsResp.json();
      }
      if (statsResp.ok) {
        this.stats = await statsResp.json();
      }
    } catch {
      /* keep defaults */
    } finally {
      this.loading = false;
    }
  }

  getMainImage(lot: any): string | null {
    if (lot.images && lot.images.length > 0) {
      const main = lot.images.find((img: any) => img.category === 'main');
      const img = main || lot.images[0];
      return this.getImageUrl(img.url);
    }
    return null;
  }

  getImageUrl(path: string): string {
    if (!path) return '';
    if (path.startsWith('http')) return path;
    return `${environment.apiUrl.replace('/api', '')}${path}`;
  }

  getFuelLabel(fuelType: string): string {
    const labels: Record<string, string> = {
      petrol: 'Бензин', diesel: 'Дизель', hybrid: 'Гибрид',
      electric: 'Электро', lpg: 'Газ', other: 'Другое',
    };
    return labels[fuelType] || fuelType || '-';
  }
}
