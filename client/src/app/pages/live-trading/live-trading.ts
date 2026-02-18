import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DecimalPipe } from '@angular/common';

@Component({
  selector: 'app-live-trading',
  standalone: true,
  imports: [FormsModule, DecimalPipe],
  templateUrl: './live-trading.html',
  styleUrl: './live-trading.scss',
})
export class LiveTradingComponent {
  customBidAmount: number | null = null;
  activeTab: 'list' | 'feed' = 'list';

  activeLot = {
    id: 1,
    brand: 'BMW',
    model: '5 Series',
    trim: '530d xDrive',
    year: 2021,
    engine: '3.0L Дизель',
    transmission: 'Автомат',
    drivetrain: 'Полный',
    mileage: 45200,
    fuel: 'Дизель',
    color: 'Sophisto Grey',
    currentBid: 18500,
    bidStep: 100,
    bidsCount: 12,
    endTime: new Date(Date.now() + 1800000),
    leaderFlag: '🇺🇦',
    leaderId: 'Bidder 7',
    lastIncrement: 300,
    documentStatus: 'Clean Title',
    damageType: 'Фронтальный',
    buyNowPrice: 24000,
  };

  auctionList = [
    { id: 1, brand: 'BMW', model: '5 Series', year: 2021, mileage: 45200, fuel: 'Дизель', currentBid: 18500, bidsCount: 12, endTime: new Date(Date.now() + 1800000), leaderFlag: '🇺🇦', active: true },
    { id: 2, brand: 'Mercedes', model: 'E-Class', year: 2020, mileage: 38000, fuel: 'Бензин', currentBid: 22000, bidsCount: 8, endTime: new Date(Date.now() + 5400000), leaderFlag: '🇩🇪', active: false },
    { id: 3, brand: 'Audi', model: 'A6 Avant', year: 2022, mileage: 21000, fuel: 'Гибрид', currentBid: 26500, bidsCount: 15, endTime: new Date(Date.now() + 900000), leaderFlag: '🇵🇱', active: false },
    { id: 4, brand: 'Porsche', model: 'Cayenne', year: 2020, mileage: 55000, fuel: 'Бензин', currentBid: 38000, bidsCount: 21, endTime: new Date(Date.now() + 3600000), leaderFlag: '🇬🇪', active: false },
    { id: 5, brand: 'Volvo', model: 'XC60', year: 2021, mileage: 47000, fuel: 'Дизель', currentBid: 24300, bidsCount: 11, endTime: new Date(Date.now() + 7200000), leaderFlag: '🇱🇹', active: false },
    { id: 6, brand: 'VW', model: 'Tiguan', year: 2019, mileage: 82000, fuel: 'Дизель', currentBid: 14200, bidsCount: 6, endTime: new Date(Date.now() + 10800000), leaderFlag: '🇷🇴', active: false },
    { id: 7, brand: 'Toyota', model: 'RAV4', year: 2021, mileage: 32000, fuel: 'Гибрид', currentBid: 19800, bidsCount: 9, endTime: new Date(Date.now() + 14400000), leaderFlag: '🇺🇦', active: false },
    { id: 8, brand: 'Peugeot', model: '3008', year: 2020, mileage: 68000, fuel: 'Дизель', currentBid: 12800, bidsCount: 4, endTime: new Date(Date.now() + 21600000), leaderFlag: '🇧🇬', active: false },
  ];

  liveFeed = [
    { flag: '🇺🇦', car: 'BMW 5 Series', increment: '+300 EUR', time: '10 сек' },
    { flag: '🇩🇪', car: 'Mercedes E-Class', increment: '+250 EUR', time: '24 сек' },
    { flag: '🇵🇱', car: 'Audi A6 Avant', increment: '+500 EUR', time: '38 сек' },
    { flag: '🇬🇪', car: 'Porsche Cayenne', increment: '+100 EUR', time: '45 сек' },
    { flag: '🇺🇦', car: 'BMW 5 Series', increment: '+200 EUR', time: '1:02' },
    { flag: '🇱🇹', car: 'Volvo XC60', increment: '+250 EUR', time: '1:15' },
    { flag: '🇷🇴', car: 'VW Tiguan', increment: '+100 EUR', time: '1:34' },
    { flag: '🇺🇦', car: 'Toyota RAV4', increment: '+500 EUR', time: '1:58' },
    { flag: '🇩🇪', car: 'Audi A6 Avant', increment: '+250 EUR', time: '2:12' },
    { flag: '🇧🇬', car: 'Peugeot 3008', increment: '+100 EUR', time: '2:40' },
    { flag: '🇵🇱', car: 'Porsche Cayenne', increment: '+1000 EUR', time: '2:55' },
    { flag: '🇺🇦', car: 'Mercedes E-Class', increment: '+250 EUR', time: '3:20' },
  ];

  bidHistory = [
    { flag: '🇺🇦', bidderId: 'Bidder 7', amount: 18500, time: '10 сек' },
    { flag: '🇩🇪', bidderId: 'Bidder 3', amount: 18200, time: '2 мин' },
    { flag: '🇵🇱', bidderId: 'Bidder 12', amount: 18000, time: '5 мин' },
    { flag: '🇱🇹', bidderId: 'Bidder 5', amount: 17500, time: '8 мин' },
    { flag: '🇺🇦', bidderId: 'Bidder 7', amount: 17200, time: '12 мин' },
  ];

  stats = {
    activeAuctions: 8,
    usersOnline: 142,
    dailyVolume: 285000,
    dailyBids: 847,
  };

  selectLot(lot: any): void {
    this.auctionList.forEach(l => l.active = false);
    lot.active = true;
  }

  quickBid(increment: number): void {
    this.customBidAmount = this.activeLot.currentBid + increment;
  }

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
    if (diff < 30000) return 'timer--red';
    if (diff < 120000) return 'timer--yellow';
    return 'timer--green';
  }
}
