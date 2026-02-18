import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { DecimalPipe } from '@angular/common';

@Component({
  selector: 'app-lot-detail',
  standalone: true,
  imports: [RouterLink, FormsModule, DecimalPipe],
  templateUrl: './lot-detail.html',
  styleUrl: './lot-detail.scss',
})
export class LotDetailComponent {
  selectedImageTab: 'main' | 'damage' = 'main';
  customBidAmount: number | null = null;

  lot = {
    id: 1,
    brand: 'BMW',
    model: '5 Series',
    trim: '530d xDrive M Sport',
    year: 2021,
    mileage: 45200,
    mileageStatus: 'actual',
    fuelType: 'Дизель',
    engineVolume: '3.0L',
    enginePower: '286 л.с.',
    transmission: 'Автомат (ZF 8HP)',
    drivetrain: 'Полный (xDrive)',
    bodyType: 'Седан',
    exteriorColor: 'Sophisto Grey',
    interiorColor: 'Cognac Dakota Leather',
    countryOfOrigin: 'Германия',
    vin: 'WBAPH5C55BA123456',
    documentStatus: 'Clean Title',
    damageType: 'Фронтальный удар',
    condition: 'Run & Drive',
    startPrice: 15000,
    currentBid: 18500,
    buyNowPrice: 24000,
    bidStep: 100,
    bidsCount: 12,
    endTime: new Date(Date.now() + 7200000),
    videoUrl: 'https://youtube.com/watch?v=example',
  };

  bidHistory = [
    { flag: '🇺🇦', bidderId: 'Bidder 7', amount: 18500, time: '2 мин назад' },
    { flag: '🇩🇪', bidderId: 'Bidder 3', amount: 18200, time: '5 мин назад' },
    { flag: '🇵🇱', bidderId: 'Bidder 12', amount: 18000, time: '8 мин назад' },
    { flag: '🇱🇹', bidderId: 'Bidder 5', amount: 17500, time: '12 мин назад' },
    { flag: '🇺🇦', bidderId: 'Bidder 7', amount: 17200, time: '15 мин назад' },
  ];

  calculator = {
    carPrice: 18500,
    commission: 925,
    delivery: 1200,
    customs: 4800,
    get total(): number { return this.carPrice + this.commission + this.delivery + this.customs; }
  };

  quickBid(increment: number): void {
    this.customBidAmount = this.lot.currentBid + increment;
  }

  getTimeLeft(): string {
    const diff = this.lot.endTime.getTime() - Date.now();
    if (diff <= 0) return '0:00';
    const h = Math.floor(diff / 3600000);
    const m = Math.floor((diff % 3600000) / 60000);
    const s = Math.floor((diff % 60000) / 1000);
    if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    return `${m}:${String(s).padStart(2, '0')}`;
  }

  getTimerClass(): string {
    const diff = this.lot.endTime.getTime() - Date.now();
    if (diff < 30000) return 'timer--red';
    if (diff < 120000) return 'timer--yellow';
    return 'timer--green';
  }
}
