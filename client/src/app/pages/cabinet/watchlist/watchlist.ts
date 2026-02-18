import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { DecimalPipe } from '@angular/common';

@Component({
  selector: 'app-watchlist',
  standalone: true,
  imports: [RouterLink, DecimalPipe],
  templateUrl: './watchlist.html',
  styleUrl: './watchlist.scss',
})
export class WatchlistComponent {
  trackedBrands = [
    { id: 1, name: 'BMW' },
    { id: 2, name: 'Porsche' },
    { id: 3, name: 'Audi' },
  ];

  watchedLots = [
    { id: 1, brand: 'BMW', model: '5 Series', year: 2021, mileage: 42000, fuel: 'Дизель', currentBid: 18500, endTime: '1:45:22', bids: 12, image: null },
    { id: 4, brand: 'Porsche', model: 'Macan', year: 2022, mileage: 28000, fuel: 'Бензин', currentBid: 38200, endTime: '3:12:05', bids: 8, image: null },
    { id: 6, brand: 'Audi', model: 'Q5', year: 2021, mileage: 51000, fuel: 'Дизель', currentBid: 22800, endTime: '0:55:40', bids: 15, image: null },
  ];

  removeBrand(id: number): void {
    this.trackedBrands = this.trackedBrands.filter(b => b.id !== id);
  }

  removeLot(id: number): void {
    this.watchedLots = this.watchedLots.filter(l => l.id !== id);
  }
}
